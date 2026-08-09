use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Manager, RunEvent, State, WindowEvent};
use tauri::menu::{Menu, MenuItem};
use tauri::path::BaseDirectory;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

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
    if std::net::TcpStream::connect("127.0.0.1:17800").is_ok() {
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
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
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

    builder
        .setup(|app| {
            let child = spawn_sidecar(app.handle());
            app.manage(Sidecar(Mutex::new(child)));

            // 原生 UI（托盘菜单/系统菜单）统一浅色（白底黑边菜单）；应用图标为黑底白圈（品牌规范）
            let _ = app.handle().set_theme(Some(tauri::Theme::Light));

            // 标题栏（UI Polish §5）：Windows/Linux 无边框自绘（tauri.conf decorations:false）；
            // macOS 恢复原生装饰并切 Overlay 标题栏——保留红黄绿交通灯，隐藏原生标题。
            #[cfg(target_os = "macos")]
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_decorations(true);
                let _ = win.set_title_bar_style(TitleBarStyle::Overlay);
                let _ = win.set_hidden_title(true);
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
