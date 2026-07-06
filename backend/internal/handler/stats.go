package handler

import (
	"bufio"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
	"unsafe"

	"github.com/gin-gonic/gin"
)

type StatsHandler struct {
	mu       sync.Mutex
	prevCPU  *cpuSample
	prevTime time.Time
}

func NewStatsHandler() *StatsHandler {
	return &StatsHandler{}
}

type cpuSample struct {
	user, nice, system, idle, iowait, irq, softirq, steal uint64
}

func (s *cpuSample) total() uint64 {
	return s.user + s.nice + s.system + s.idle + s.iowait + s.irq + s.softirq + s.steal
}

func (s *cpuSample) idleTotal() uint64 {
	return s.idle + s.iowait
}

type serverStatsResponse struct {
	CPUPercent      float64 `json:"cpu_percent"`
	MemoryUsedMB    uint64  `json:"memory_used_mb"`
	MemoryTotalMB   uint64  `json:"memory_total_mb"`
	DiskUsedPercent float64 `json:"disk_used_percent"`
	DiskTotalGB     uint64  `json:"disk_total_gb"`
	UptimeSeconds   uint64  `json:"uptime_seconds"`
	GoGoroutines    int     `json:"go_goroutines"`
	GoAllocMB       uint64  `json:"go_alloc_mb"`
}

func (h *StatsHandler) ServerStats(c *gin.Context) {
	var resp serverStatsResponse

	if runtime.GOOS == "linux" {
		resp.CPUPercent = h.cpuPercent()
		resp.MemoryUsedMB, resp.MemoryTotalMB = memInfoLinux()
		resp.DiskUsedPercent, resp.DiskTotalGB = diskUsageLinux("/")
		resp.UptimeSeconds = uptimeLinux()
	}

	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	resp.GoGoroutines = runtime.NumGoroutine()
	resp.GoAllocMB = m.Alloc / 1024 / 1024

	c.JSON(http.StatusOK, resp)
}

// cpuPercent 通过两次采样差值计算 CPU 使用率。
// 首次调用返回 0（无历史数据），后续调用返回自上次采样以来的平均 CPU 使用百分比。
func (h *StatsHandler) cpuPercent() float64 {
	cur, err := readCPUStat()
	if err != nil {
		return 0
	}
	now := time.Now()

	h.mu.Lock()
	prev := h.prevCPU
	h.prevCPU = cur
	h.prevTime = now
	h.mu.Unlock()

	if prev == nil {
		return 0
	}

	totalDelta := float64(cur.total() - prev.total())
	if totalDelta == 0 {
		return 0
	}
	idleDelta := float64(cur.idleTotal() - prev.idleTotal())
	return (1.0 - idleDelta/totalDelta) * 100.0
}

func readCPUStat() (*cpuSample, error) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return nil, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "cpu ") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 9 {
			return nil, nil
		}
		vals := make([]uint64, 8)
		for i := 0; i < 8; i++ {
			v, err := strconv.ParseUint(fields[i+1], 10, 64)
			if err != nil {
				return nil, err
			}
			vals[i] = v
		}
		return &cpuSample{
			user: vals[0], nice: vals[1], system: vals[2], idle: vals[3],
			iowait: vals[4], irq: vals[5], softirq: vals[6], steal: vals[7],
		}, nil
	}
	return nil, scanner.Err()
}

func memInfoLinux() (usedMB, totalMB uint64) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0
	}
	defer f.Close()

	var total, available uint64
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case strings.HasPrefix(line, "MemTotal:"):
			total = parseMeminfoKB(line)
		case strings.HasPrefix(line, "MemAvailable:"):
			available = parseMeminfoKB(line)
		}
	}
	totalMB = total / 1024
	if total > available {
		usedMB = (total - available) / 1024
	}
	return
}

func parseMeminfoKB(line string) uint64 {
	fields := strings.Fields(line)
	if len(fields) >= 2 {
		v, _ := strconv.ParseUint(fields[1], 10, 64)
		return v
	}
	return 0
}

// syscallStatfs 通过原始 syscall 号调用 statfs，避免依赖 golang.org/x/sys。
func syscallStatfs(path string, stat unsafe.Pointer) error {
	pathBytes := append([]byte(path), 0)
	_, _, errno := rawSyscallStatfs(
		uintptr(unsafe.Pointer(&pathBytes[0])),
		uintptr(stat),
	)
	if errno != 0 {
		return errno
	}
	return nil
}

func diskUsageLinux(path string) (usedPercent float64, totalGB uint64) {
	var stat statfs_t
	if err := syscallStatfs(path, unsafe.Pointer(&stat)); err != nil {
		return 0, 0
	}
	totalBytes := stat.Blocks * uint64(stat.Bsize)
	freeBytes := stat.Bfree * uint64(stat.Bsize)
	totalGB = totalBytes / (1024 * 1024 * 1024)
	if totalBytes > 0 {
		usedPercent = float64(totalBytes-freeBytes) / float64(totalBytes) * 100.0
	}
	return
}

func uptimeLinux() uint64 {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(data))
	if len(fields) < 1 {
		return 0
	}
	f, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0
	}
	return uint64(f)
}
