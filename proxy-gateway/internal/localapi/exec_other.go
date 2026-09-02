//go:build !windows

package localapi

import "os/exec"

// hideConsole 非 Windows 平台无控制台窗口概念，空实现。
func hideConsole(cmd *exec.Cmd) {}
