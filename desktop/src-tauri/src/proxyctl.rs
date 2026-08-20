// proxyctl —— 独立后台代理管理（方案 C）。
//
// 把打包的 Go sidecar 复制到固定安装目录、注册开机自启（Run key / LaunchAgent /
// autostart .desktop），使代理独立于应用运行：应用彻底退出后代理仍存活，
// 应用再打开时通过 17800 端口探测复用（见 lib.rs spawn_sidecar）。
//
// 本模块只做纯逻辑（不依赖 tauri 状态），应用侧的命令编排在 lib.rs。
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use serde::Serialize;

/// 本地代理监听端口（与 lib.rs spawn_sidecar 的 PROXY_PORT 一致）。
pub const PROXY_PORT: u16 = 17800;

/// 回环监听地址字符串（"127.0.0.1:PORT"，供 lib.rs 端口探测复用）。
pub const PROXY_ADDR: &str = "127.0.0.1:17800";

/// 回环监听地址（127.0.0.1:PORT）。
fn local_addr(port: u16) -> SocketAddr {
    format!("127.0.0.1:{port}")
        .parse()
        .expect("valid local addr")
}

/// Windows：给子进程加 CREATE_NO_WINDOW，避免 GUI 应用（无控制台）spawn 控制台命令
/// （reg / powershell / taskkill）时弹出闪一下的终端窗口。非 Windows 无此问题。
#[cfg(windows)]
fn no_console(cmd: &mut Command) -> &mut Command {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    cmd
}
#[cfg(not(windows))]
fn no_console(cmd: &mut Command) -> &mut Command {
    cmd
}

/// 前端可读的代理状态（manage_proxy 命令返回）。
#[derive(Serialize)]
pub struct ProxyStatus {
    pub enabled: bool,   // 自启已注册（= 独立后台代理已开启）
    pub running: bool,   // 17800 有进程监听
    pub version: String, // 运行中代理版本（未运行则空）
}

/// 汇总当前状态（无副作用）。
pub fn status() -> ProxyStatus {
    let running = is_running();
    let version = if running {
        running_version().unwrap_or_default()
    } else {
        String::new()
    };
    ProxyStatus {
        enabled: autostart_installed(),
        running,
        version,
    }
}

/// 运行中的代理版本（GET /api/proxy/status → version），未运行返回 None。
pub fn running_version() -> Option<String> {
    if !is_running() {
        return None;
    }
    let mut stream =
        TcpStream::connect_timeout(&local_addr(PROXY_PORT), Duration::from_millis(800)).ok()?;
    let _ = stream.write_all(b"GET /api/proxy/status HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n");
    let mut buf = String::new();
    let _ = stream.read_to_string(&mut buf);
    // 取响应体里 "version":"<v>" 的 <v>
    let body = buf.split("\r\n\r\n").nth(1)?;
    let key = "\"version\":\"";
    let idx = body.find(key)?;
    let rest = &body[idx + key.len()..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

/// 某个 proxy 二进制的版本（跑 `-version`），失败回退 "dev"。
pub fn binary_version(exe: &Path) -> String {
    let out = no_console(&mut Command::new(exe))
        .arg("-version")
        .output()
        .ok();
    out.and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "dev".into())
}

/// 17800 是否有进程在监听（TCP 探测，500ms 超时）。
pub fn is_running() -> bool {
    TcpStream::connect_timeout(&local_addr(PROXY_PORT), Duration::from_millis(500)).is_ok()
}

// ---------- 安装目录 ----------

fn home() -> PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
}

/// 独立代理固定安装目录（应用资源目录外的稳定位置）。
pub fn install_dir() -> PathBuf {
    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home())
            .join("Oxelia51")
            .join("proxy")
    }
    #[cfg(target_os = "macos")]
    {
        home()
            .join("Library")
            .join("Application Support")
            .join("Oxelia51")
            .join("proxy")
    }
    #[cfg(target_os = "linux")]
    {
        home()
            .join(".local")
            .join("share")
            .join("oxelia51")
            .join("proxy")
    }
}

/// 安装的二进制完整路径（Win 带 .exe 后缀）。
pub fn install_binary_path() -> PathBuf {
    let name = if cfg!(windows) { "proxy.exe" } else { "proxy" };
    install_dir().join(name)
}

/// 把打包 sidecar 复制到安装目录（版本不同才复制；安装目录自动创建）。
pub fn ensure_installed(bundled: &Path) -> Result<PathBuf, String> {
    let target = install_binary_path();
    let up_to_date = target.exists() && binary_version(&target) == binary_version(bundled);
    if !up_to_date {
        let dir = target.parent().ok_or("bad install path")?;
        std::fs::create_dir_all(dir).map_err(|e| format!("create install dir: {e}"))?;
        std::fs::copy(bundled, &target).map_err(|e| format!("copy sidecar: {e}"))?;
    }
    Ok(target)
}

/// 启动独立代理（后台，无窗口）。
pub fn launch_independent(exe: &Path) -> Result<(), String> {
    let mut cmd = Command::new(exe);
    cmd.arg("--local").arg("--port").arg(PROXY_PORT.to_string());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd.spawn()
        .map(|_| ())
        .map_err(|e| format!("launch independent proxy: {e}"))
}

/// 杀掉监听指定端口的进程（跨平台按端口查 PID）。
pub fn kill_listener(port: u16) -> Result<(), String> {
    #[cfg(windows)]
    {
        // PowerShell：Get-NetTCPConnection 拿 OwningProcess
        let ps = format!(
            "(Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue).OwningProcess"
        );
        let out = no_console(&mut Command::new("powershell"))
            .args(["-NoProfile", "-Command", &ps])
            .output()
            .map_err(|e| format!("query listener pid: {e}"))?;
        for pid in String::from_utf8_lossy(&out.stdout).lines().map(str::trim) {
            if !pid.is_empty() && pid.chars().all(|c| c.is_ascii_digit()) {
                let _ = no_console(&mut Command::new("taskkill"))
                    .args(["/PID", pid, "/F"])
                    .output();
            }
        }
    }
    #[cfg(not(windows))]
    {
        let out = Command::new("lsof")
            .args(["-ti", &format!("tcp:{port}")])
            .output()
            .map_err(|e| format!("query listener pid: {e}"))?;
        for pid in String::from_utf8_lossy(&out.stdout).lines().map(str::trim) {
            if !pid.is_empty() {
                let _ = Command::new("kill").args([pid]).output();
            }
        }
    }
    Ok(())
}

// ---------- 开机自启 ----------

/// 自启是否已注册（= 独立后台代理已启用）。
pub fn autostart_installed() -> bool {
    #[cfg(windows)]
    {
        no_console(&mut Command::new("reg"))
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "Oxelia51Proxy",
            ])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(target_os = "macos")]
    {
        plist_path().exists()
    }
    #[cfg(target_os = "linux")]
    {
        desktop_path().exists()
    }
}

/// 注册开机自启（指向安装好的代理二进制，带 -local -port 参数）。
pub fn autostart_install(exe: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        let cmd = format!("\"{}\" -local -port {PROXY_PORT}", exe.display());
        let out = no_console(&mut Command::new("reg"))
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "Oxelia51Proxy",
                "/t",
                "REG_SZ",
                "/d",
                &cmd,
                "/f",
            ])
            .output()
            .map_err(|e| format!("reg add: {e}"))?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).to_string());
        }
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        let plist = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.oxelia51.proxy</string>
  <key>ProgramArguments</key><array>
    <string>{}</string><string>--local</string><string>--port</string><string>{PROXY_PORT}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
</dict></plist>
"#,
            exe.display()
        );
        let p = plist_path();
        std::fs::create_dir_all(p.parent().ok_or("bad plist path")?)
            .map_err(|e| format!("create plist dir: {e}"))?;
        std::fs::write(&p, plist).map_err(|e| format!("write plist: {e}"))?;
        let _ = Command::new("launchctl")
            .args(["load", "-w", p.to_str().unwrap_or_default()])
            .output();
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        let desktop = format!(
            "[Desktop Entry]\nType=Application\nName=Oxelia51 Proxy\nExec=\"{}\" --local --port {PROXY_PORT}\nX-GNOME-Autostart-enabled=true\n",
            exe.display()
        );
        let p = desktop_path();
        std::fs::create_dir_all(p.parent().ok_or("bad desktop path")?)
            .map_err(|e| format!("create desktop dir: {e}"))?;
        std::fs::write(&p, desktop).map_err(|e| format!("write desktop: {e}"))?;
        Ok(())
    }
}

/// 移除开机自启。
pub fn autostart_uninstall() -> Result<(), String> {
    #[cfg(windows)]
    {
        no_console(&mut Command::new("reg"))
            .args([
                "delete",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "Oxelia51Proxy",
                "/f",
            ])
            .output()
            .map(|_| ())
            .map_err(|e| format!("reg delete: {e}"))
    }
    #[cfg(target_os = "macos")]
    {
        let p = plist_path();
        if p.exists() {
            let _ = Command::new("launchctl")
                .args(["unload", "-w", p.to_str().unwrap_or_default()])
                .output();
            let _ = std::fs::remove_file(&p);
        }
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        let p = desktop_path();
        let _ = std::fs::remove_file(p);
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn plist_path() -> PathBuf {
    home()
        .join("Library")
        .join("LaunchAgents")
        .join("com.oxelia51.proxy.plist")
}

#[cfg(target_os = "linux")]
fn desktop_path() -> PathBuf {
    home()
        .join(".config")
        .join("autostart")
        .join("oxelia51-proxy.desktop")
}
