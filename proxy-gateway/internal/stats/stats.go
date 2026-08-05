// Package stats 代理网关实时运行统计：请求数、QPS、延迟、成功率、供应商分布。
// 滑动窗口 5 分钟，无锁读快照（互斥锁保护写入），适合高并发网关。
package stats

import (
	"sort"
	"sync"
	"time"
)

// Sample 单次请求采样
type Sample struct {
	Ts       time.Time
	CostMs   float64
	OK       bool
	Provider string
}

// Stats 网关统计器
type Stats struct {
	startTime  time.Time
	totalReq   int64
	successReq int64
	mu         sync.Mutex
	window     []Sample // 最近 5 分钟
}

// New 创建统计器（startTime = 创建时刻）
func New() *Stats {
	return &Stats{startTime: time.Now()}
}

// Record 记录一次请求（线程安全）
func (s *Stats) Record(provider string, cost time.Duration, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.totalReq++
	if ok {
		s.successReq++
	}
	s.window = append(s.window, Sample{
		Ts:       time.Now(),
		CostMs:   float64(cost.Microseconds()) / 1000.0,
		OK:       ok,
		Provider: provider,
	})
	// 清理 5 分钟前的样本
	cutoff := time.Now().Add(-5 * time.Minute)
	i := 0
	for i < len(s.window) && s.window[i].Ts.Before(cutoff) {
		i++
	}
	s.window = s.window[i:]
}

// ProviderStat 供应商维度统计
type ProviderStat struct {
	Provider string  `json:"provider"`
	Requests int64   `json:"requests"`
	Failures int64   `json:"failures"`
	AvgMs    float64 `json:"avgLatencyMs"`
}

// Snapshot 统计快照（JSON 友好）
type Snapshot struct {
	Status       string         `json:"status"`
	UptimeSec    int64          `json:"uptimeSeconds"`
	TotalReq     int64          `json:"totalRequests"`
	SuccessRate  float64        `json:"successRate"` // 0-100
	QPS          float64        `json:"qps"`
	AvgLatencyMs float64        `json:"avgLatencyMs"`
	WindowSec    int            `json:"windowSeconds"`
	ByProvider   []ProviderStat `json:"byProvider"`
}

// Snapshot 生成当前快照
func (s *Stats) Snapshot() Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	windowSec := 0
	if len(s.window) > 0 {
		windowSec = int(now.Sub(s.window[0].Ts).Seconds())
		if windowSec < 1 {
			windowSec = 1
		}
	}

	var qps, avg float64
	if len(s.window) > 0 && windowSec > 0 {
		qps = float64(len(s.window)) / float64(windowSec)
		var totalMs float64
		for _, sm := range s.window {
			totalMs += sm.CostMs
		}
		avg = totalMs / float64(len(s.window))
	}

	// 供应商聚合
	provMap := map[string]*ProviderStat{}
	for _, sm := range s.window {
		p := provMap[sm.Provider]
		if p == nil {
			p = &ProviderStat{Provider: sm.Provider}
			provMap[sm.Provider] = p
		}
		p.Requests++
		p.AvgMs += sm.CostMs
		if !sm.OK {
			p.Failures++
		}
	}
	providers := make([]ProviderStat, 0, len(provMap))
	for _, p := range provMap {
		if p.Requests > 0 {
			p.AvgMs /= float64(p.Requests)
		}
		providers = append(providers, *p)
	}
	sort.Slice(providers, func(i, j int) bool {
		return providers[i].Requests > providers[j].Requests
	})

	successRate := 0.0
	if s.totalReq > 0 {
		successRate = float64(s.successReq) / float64(s.totalReq) * 100
	}

	return Snapshot{
		Status:       "ok",
		UptimeSec:    int64(now.Sub(s.startTime).Seconds()),
		TotalReq:     s.totalReq,
		SuccessRate:  successRate,
		QPS:          qps,
		AvgLatencyMs: avg,
		WindowSec:    windowSec,
		ByProvider:   providers,
	}
}
