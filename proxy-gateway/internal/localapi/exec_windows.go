//go:build windows

package localapi

import (
	"os/exec"
	"syscall"
)

// hideConsole 隐藏子进程控制台窗口（CREATE_NO_WINDOW）。
// sidecar 由 Tauri 以 CREATE_NO_WINDOW 拉起（见 desktop/src-tauri proxyctl.rs），
// 若 Go 侧 spawn 时不带此标志，Windows 会给 .cmd 包装器分配新控制台 → 终端一闪。
func hideConsole(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
		HideWindow:    true,
	}
}
