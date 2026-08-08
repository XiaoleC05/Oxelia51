use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::{AppHandle, Manager, RunEvent, State};
use tauri::path::BaseDirectory;

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

struct Sidecar(Mutex<Option<Child>>);

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
    Command::new(&path)
        .env("LOCAL_MODE", "true")
        .env("PROXY_PORT", "17800")
        .spawn()
        .ok()
}

fn kill_sidecar(state: &State<'_, Sidecar>) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let child = spawn_sidecar(app.handle());
            app.manage(Sidecar(Mutex::new(child)));

            // 标题栏（UI Polish §5）：Windows/Linux 无边框自绘（tauri.conf decorations:false）；
            // macOS 恢复原生装饰并切 Overlay 标题栏——保留红黄绿交通灯，隐藏原生标题。
            #[cfg(target_os = "macos")]
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_decorations(true);
                let _ = win.set_title_bar_style(TitleBarStyle::Overlay);
                let _ = win.set_hidden_title(true);
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle: &AppHandle, event| match event {
            RunEvent::Exit => {
                if let Some(state) = app_handle.try_state::<Sidecar>() {
                    kill_sidecar(&state);
                }
            }
            _ => {}
        });
}
