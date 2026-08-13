use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, PoisonError};
use std::time::Duration;

use tauri::{AppHandle, Manager, RunEvent, State, WindowEvent};
use tauri::menu::{Menu, MenuItem};
use tauri::path::BaseDirectory;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

mod proxyctl;

/// Tauri 2 桌面壳（Oxelia51 本地优先桌面应用，P3）。
///
/// 职责：开一个窗口加载桌面 UI（desktop/ui），并在应用生命周期内托管
/// 本地 Go sidecar（LOCAL_MODE 网关，默认 :17800）。sidecar 负责代理转发 +
/// SQLite 落账；UI 通过 /api/* 读取。
///
/// sidecar 位置解析顺序：
/// 1. OXELIA_SIDECAR env
/// 2. Tauri 资源目录（打包后 externalBin 放置处）
/// 3. exe 同目录 → ../sidecar → desktop/sidecar（开发布局）
///
/// 托盘驻留（UI Polish v1）：关闭窗口 = 隐藏到系统托盘，程序后台常驻；
/// 托盘左键/「打开」重新显示窗口，「退出」才真正结束（并杀掉 sidecar）。

struct Sidecar(Mutex<Option<Child>>);

/// 托盘「退出」已点击（显式退出）；否则窗口关闭一律阻止退出（驻留托盘）。
static QUIT: AtomicBool = AtomicBool::new(false);

fn find_sidecar(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(p) = std::env::var("OXELIA_SIDECAR") {
        let t = p.trim();
        if !t.is_empty() {
            let pb = PathBuf::from(t);
            if pb.exists() {
                return Some(pb);
            }
        }
    }
    // 打包后：外部 sidecar 在资源目录（Windows 为 proxy.exe）
    if let Ok(pb) = app.path().resolve("proxy", BaseDirectory::Resource) {
        if pb.exists() {
            return Some(pb);
        }
        let with_exe = pb.with_extension("exe");
        if with_exe.exists() {
            return Some(with_exe);
        }
    }
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let candidates = [
        exe_dir.join("proxy.exe"),
        exe_dir.join("..").join("sidecar").join("proxy.exe"),
        exe_dir.join("..").join("..").join("sidecar").join("proxy.exe"),
        exe_dir.join("..").join("..").join("..").join("sidecar").join("proxy.exe"),
    ];
    candidates.into_iter().find(|p| p.exists())
}

fn spawn_sidecar(app: &AppHandle) -> Option<Child> {
    let path = find_sidecar(app)?;

    // #9：端口探测——若 17800 已有 sidecar 在跑（另一实例残留 / macOS 无单实例锁），
    // 不再启动第二个（否则 bind 冲突静默失败，UI 显示「代理离线」）。复用已有实例。
    // 使用 500ms 连接超时避免 OS 默认 TCP SYN 超时（Win ~20-60s / Linux ~127s）
    // 导致启动时主线程长时间阻塞。
    if std::net::TcpStream::connect_timeout(
        &"127.0.0.1:17800".parse().ok()?,
        Duration::from_millis(500),
    )
    .is_ok()
    {
        log_sidecar("sidecar 已在 17800 运行，复用现有实例");
        return None;
    }

    let mut cmd = Command::new(&path);
    cmd.env("LOCAL_MODE", "true").env("PROXY_PORT", "17800");
    // Windows：CREATE_NO_WINDOW —— 不让 sidecar 控制台窗口弹出（用户反馈的「打开就多个终端」）
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    cmd.spawn().ok()
}

/// sidecar 日志：Tauri 无标准 log 宏时写 stderr（便于 dev 控制台查看）。
fn log_sidecar(msg: &str) {
    eprintln!("[oxelia51] {msg}");
}

fn kill_sidecar(state: &State<'_, Sidecar>) {
    // PoisonError::into_inner 确保即使锁被毒化也能清理 sidecar 进程，
    // 避免孤儿进程残留。
    let mut guard = state.0.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

// ---------- 独立后台代理（方案 C）----------
// 所有权不变式：独立模式 ON 时应用持有 None（代理为外部进程，退出不杀）；
// OFF 时持有自己的 Child（退出即杀）。

/// 应用启动时确保独立代理已安装且运行最新版本。
/// 在 spawn_sidecar 之前调用：独立代理先占 17800，spawn_sidecar 探测命中即复用。
fn ensure_independent_proxy(app: &AppHandle) {
    if !proxyctl::autostart_installed() {
        return;
    }
    let Some(bundled) = find_sidecar(app) else { return };
    if let Ok(installed) = proxyctl::ensure_installed(&bundled) {
        let stale = !proxyctl::is_running()
            || proxyctl::binary_version(&bundled)
                != proxyctl::running_version().unwrap_or_default();
        if stale {
            let _ = proxyctl::kill_listener(proxyctl::PROXY_PORT);
            let _ = proxyctl::launch_independent(&installed);
        }
    }
}

/// 开启独立后台代理：装二进制 → 注册自启 → 若持有自己的子进程先杀掉（让出 17800）→ 启动独立实例。
fn proxy_install(app: &AppHandle) -> Result<proxyctl::ProxyStatus, String> {
    let bundled = find_sidecar(app).ok_or("未找到打包的代理组件")?;
    let installed = proxyctl::ensure_installed(&bundled)?;
    proxyctl::autostart_install(&installed)?;
    // 释放应用自己持有的 sidecar（若开启前是随应用模式）
    let state = app.state::<Sidecar>();
    {
        let mut guard = state.0.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
    if !proxyctl::is_running() {
        proxyctl::launch_independent(&installed)?;
    }
    Ok(proxyctl::status())
}

/// 关闭独立后台代理：移除自启 → 杀掉独立实例 → 应用立刻接管自己的子进程（代理不中断）。
fn proxy_uninstall(app: &AppHandle) -> Result<proxyctl::ProxyStatus, String> {
    proxyctl::autostart_uninstall()?;
    let _ = proxyctl::kill_listener(proxyctl::PROXY_PORT);
    let state = app.state::<Sidecar>();
    {
        let mut guard = state.0.lock().unwrap_or_else(PoisonError::into_inner);
        if guard.is_none() {
            *guard = spawn_sidecar(app);
        }
    }
    Ok(proxyctl::status())
}

/// 前端命令：manage_proxy {action: "status"|"install"|"uninstall"}。
/// async：子进程操作（reg / powershell / launch）不阻塞 UI 主线程。
#[tauri::command]
async fn manage_proxy(app: AppHandle, action: String) -> Result<proxyctl::ProxyStatus, String> {
    match action.as_str() {
        "status" => Ok(proxyctl::status()),
        "install" => proxy_install(&app),
        "uninstall" => proxy_uninstall(&app),
        other => Err(format!("未知操作：{other}")),
    }
}

/// 显示并聚焦主窗口（托盘「打开」/ 左键点击时）。
fn show_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

pub fn run() {
    let mut builder = tauri::Builder::default();

    // 单实例锁（#9）：第二次启动唤出已有窗口而非开第二份。
    // 避免：第二个实例再起一个 sidecar，17800 端口冲突静默失败 → UI 显示「代理离线」。
    // macOS 由系统激活机制保证单实例，插件在 macOS 需额外处理，故仅 win/linux。
    #[cfg(not(target_os = "macos"))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }));
    }

    // #27 系统通知：预算告警可靠弹出（WebView2 的 Web Notification API 不可靠）
    builder = builder.plugin(tauri_plugin_notification::init());
    // #29 外链打开：update-banner / 下载页用系统浏览器打开（webview 内 window.open 不可靠）
    builder = builder.plugin(tauri_plugin_opener::init());

    builder
        .setup(|app| {
            // 独立后台代理（方案 C）：若曾开启，先确保独立实例运行且版本最新，
            // 再让 spawn_sidecar 探测 17800 复用（Child=None → 退出不杀）。
            ensure_independent_proxy(app.handle());

            let child = spawn_sidecar(app.handle());
            app.manage(Sidecar(Mutex::new(child)));

            // 原生 UI（托盘菜单/系统菜单）统一浅色（白底黑边菜单）；应用图标为黑底白圈（品牌规范）
            let _ = app.handle().set_theme(Some(tauri::Theme::Light));

            // 标题栏（UI Polish §5）：Windows/Linux 无边框自绘（tauri.conf decorations:false）；
            // macOS 恢复原生装饰并切 Overlay 标题栏——保留红黄绿交通灯，隐藏原生标题。
            // 注：不调用 set_hidden_title —— 该方法在当前 tauri 版本的 WebviewWindow 上不存在
            // （macOS 编译失败，Error E0599）；Overlay 样式本身已隐藏原生标题。
            #[cfg(target_os = "macos")]
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_decorations(true);
                let _ = win.set_title_bar_style(TitleBarStyle::Overlay);
            }

            // 系统托盘：左键/「打开」唤出窗口，「退出」才真正结束
            if let Some(icon) = app.default_window_icon() {
                let open = MenuItem::with_id(app, "open", "打开 Oxelia51", true, None::<&str>)?;
                let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&open, &quit])?;
                TrayIconBuilder::with_id("main")
                    .icon(icon.clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "open" => show_main_window(app),
                        "quit" => {
                            QUIT.store(true, Ordering::SeqCst);
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            show_main_window(tray.app_handle());
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        // 关闭窗口 → 隐藏到托盘（程序后台驻留），不退出
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        // 独立后台代理管理命令（设置页开关调用）
        .invoke_handler(tauri::generate_handler![manage_proxy])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle: &AppHandle, event| match event {
            // 非托盘「退出」触发的退出一律阻止（驻留托盘）
            RunEvent::ExitRequested { api, .. } => {
                if !QUIT.load(Ordering::SeqCst) {
                    api.prevent_exit();
                }
            }
            RunEvent::Exit => {
                if let Some(state) = app_handle.try_state::<Sidecar>() {
                    kill_sidecar(&state);
                }
            }
            _ => {}
        });
}
