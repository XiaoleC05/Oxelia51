package admin

import "time"

// IPWhitelist 白名单条目
type IPWhitelist struct {
	ID        int       `json:"id"`
	IP        string    `json:"ip"`
	Label     string    `json:"label"`
	CreatedAt time.Time `json:"created_at"`
}

// serverStats 单台服务器资源指标
type serverStats struct {
	CPUPercent      float64 `json:"cpu_percent"`
	MemoryUsedMB    uint64  `json:"memory_used_mb"`
	MemoryTotalMB   uint64  `json:"memory_total_mb"`
	DiskUsedPercent float64 `json:"disk_used_percent"`
	DiskTotalGB     uint64  `json:"disk_total_gb"`
	UptimeSeconds   uint64  `json:"uptime_seconds"`
	GoGoroutines    int     `json:"go_goroutines"`
	GoAllocMB       uint64  `json:"go_alloc_mb"`
}

type serverStatsResponse struct {
	CPUPercent      float64      `json:"cpu_percent"`
	MemoryUsedMB    uint64       `json:"memory_used_mb"`
	MemoryTotalMB   uint64       `json:"memory_total_mb"`
	DiskUsedPercent float64      `json:"disk_used_percent"`
	DiskTotalGB     uint64       `json:"disk_total_gb"`
	UptimeSeconds   uint64       `json:"uptime_seconds"`
	GoGoroutines    int          `json:"go_goroutines"`
	GoAllocMB       uint64       `json:"go_alloc_mb"`
	Remote          *serverStats `json:"remote,omitempty"`
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
