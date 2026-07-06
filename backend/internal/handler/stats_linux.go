//go:build linux

package handler

import (
	"syscall"
	"unsafe"
)

// statfs_t matches Linux amd64 kernel struct statfs.
type statfs_t struct {
	Type    int64
	Bsize   int64
	Blocks  uint64
	Bfree   uint64
	Bavail  uint64
	Files   uint64
	Ffree   uint64
	Fsid    [2]int32
	Namelen int64
	Frsize  int64
	Flags   int64
	Spare   [4]int64
}

const statfsSyscall = 137 // amd64

func rawSyscallStatfs(path, stat uintptr) (uintptr, uintptr, syscall.Errno) {
	return syscall.Syscall(statfsSyscall, path, stat, 0)
}

// Ensure unsafe is used (referenced in stats.go via unsafe.Pointer).
var _ = unsafe.Pointer(nil)
