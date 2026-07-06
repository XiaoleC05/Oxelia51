//go:build !linux

package handler

import (
	"syscall"
)

type statfs_t struct {
	Blocks uint64
	Bfree  uint64
	Bsize  int64
}

func rawSyscallStatfs(_, _ uintptr) (uintptr, uintptr, syscall.Errno) {
	return 0, 0, syscall.ENOTSUP
}
