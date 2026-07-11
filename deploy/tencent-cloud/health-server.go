// health-server — 腾讯云轻量健康检查端点
// 编译: GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o health-server
// 部署: systemd 管理，监听 127.0.0.1:8090，由 Nginx 反代仅允许阿里云 IP 访问
package main

import (
	"bufio"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

type healthResponse struct {
	Status          string  `json:"status"`
	CPUPercent      float64 `json:"cpu_percent"`
	MemoryUsedMB    uint64  `json:"memory_used_mb"`
	MemoryTotalMB   uint64  `json:"memory_total_mb"`
	DiskUsedPercent float64 `json:"disk_used_percent"`
	DiskTotalGB     uint64  `json:"disk_total_gb"`
	UptimeSeconds   uint64  `json:"uptime_seconds"`
	GoGoroutines    int     `json:"go_goroutines"`
	GoAllocMB       uint64  `json:"go_alloc_mb"`
	Timestamp       string  `json:"timestamp"`
}

var (
	cpuMu       sync.Mutex
	prevCPU     *cpuSample
	prevCPUTime time.Time
)

type cpuSample struct {
	user, nice, system, idle, iowait, irq, softirq, steal uint64
}

func (s *cpuSample) total() uint64 {
	return s.user + s.nice + s.system + s.idle + s.iowait + s.irq + s.softirq + s.steal
}

func (s *cpuSample) idleTotal() uint64 {
	return s.idle + s.iowait
}

func main() {
	host := os.Getenv("HEALTH_HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	port := os.Getenv("HEALTH_PORT")
	if port == "" {
		port = "8090"
	}

	addr := host + ":" + port
	http.HandleFunc("/api/health", handleHealth)
	log.Printf("health-server listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	resp := healthResponse{
		Status:    "ok",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	resp.CPUPercent = cpuPercent()
	resp.MemoryUsedMB, resp.MemoryTotalMB = memInfo()
	resp.DiskUsedPercent, resp.DiskTotalGB = diskUsage("/")
	resp.UptimeSeconds = uptime()
	resp.GoGoroutines = runtime.NumGoroutine()

	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	resp.GoAllocMB = m.Alloc / 1024 / 1024

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(resp)
}

func cpuPercent() float64 {
	cur := readCPUStat()
	if cur == nil {
		return 0
	}
	now := time.Now()

	cpuMu.Lock()
	defer cpuMu.Unlock()

	if prevCPU == nil {
		prevCPU = cur
		prevCPUTime = now
		return 0
	}

	totalDelta := float64(cur.total() - prevCPU.total())
	if totalDelta == 0 {
		prevCPU = cur
		prevCPUTime = now
		return 0
	}
	idleDelta := float64(cur.idleTotal() - prevCPU.idleTotal())

	prevCPU = cur
	prevCPUTime = now
	return (1.0 - idleDelta/totalDelta) * 100.0
}

func readCPUStat() *cpuSample {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return nil
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "cpu ") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 9 {
			return nil
		}
		vals := make([]uint64, 8)
		for i := 0; i < 8; i++ {
			vals[i], _ = strconv.ParseUint(fields[i+1], 10, 64)
		}
		return &cpuSample{
			user: vals[0], nice: vals[1], system: vals[2], idle: vals[3],
			iowait: vals[4], irq: vals[5], softirq: vals[6], steal: vals[7],
		}
	}
	return nil
}

func memInfo() (usedMB, totalMB uint64) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0
	}
	defer f.Close()

	var total, available uint64
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		switch {
		case strings.HasPrefix(sc.Text(), "MemTotal:"):
			total = parseMemKB(sc.Text())
		case strings.HasPrefix(sc.Text(), "MemAvailable:"):
			available = parseMemKB(sc.Text())
		}
	}
	totalMB = total / 1024
	if total > available {
		usedMB = (total - available) / 1024
	}
	return
}

func parseMemKB(line string) uint64 {
	fields := strings.Fields(line)
	if len(fields) >= 2 {
		v, _ := strconv.ParseUint(fields[1], 10, 64)
		return v
	}
	return 0
}

func diskUsage(path string) (usedPercent float64, totalGB uint64) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
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

func uptime() uint64 {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(data))
	if len(fields) >= 1 {
		if f, err := strconv.ParseFloat(fields[0], 64); err == nil {
			return uint64(f)
		}
	}
	return 0
}
