use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::{AppHandle, Manager, RunEvent, State};

/// Tauri 2 桌面壳（Oxelia51 本地优先桌面应用，P3）。
///
/// 职责：开一个窗口加载桌面 UI（desktop/ui），并在应用生命周期内托管
/// 本地 Go sidecar（LOCAL_MODE 网关，默认 :17800）。sidecar 负责代理转发 +
/// SQLite 落账；UI 通过 /api/overview 读取。
///
/// sidecar 位置解析顺序：OXELIA_SIDECAR env → exe 同目录 → ../sidecar → ../../sidecar。

struct Sidecar(Mutex<Option<Child>>);

fn find_sidecar() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("OXELIA_SIDECAR") {
        let t = p.trim();
        if !t.is_empty() {
            let pb = PathBuf::from(t);
            if pb.exists() {
                return Some(pb);
            }
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

fn spawn_sidecar() -> Option<Child> {
    let path = find_sidecar()?;
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
            let child = spawn_sidecar();
            app.manage(Sidecar(Mutex::new(child)));
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
