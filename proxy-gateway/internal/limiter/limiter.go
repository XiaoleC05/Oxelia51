package limiter

import (
	"sync"
	"time"
)

// TokenBucket 实现 token bucket 限流算法
type TokenBucket struct {
	rate       float64 // tokens per second
	burst      float64 // max tokens
	tokens     float64 // current tokens
	lastUpdate time.Time
	mu         sync.Mutex
}

// NewTokenBucket 创建一个 token bucket
// ratePerMin: 每分钟允许的请求数
func NewTokenBucket(ratePerMin int) *TokenBucket {
	rate := float64(ratePerMin) / 60.0
	return &TokenBucket{
		rate:       rate,
		burst:      float64(ratePerMin),
		tokens:     float64(ratePerMin),
		lastUpdate: time.Now(),
	}
}

// Allow 尝试消耗一个 token，成功返回 true
func (b *TokenBucket) Allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(b.lastUpdate).Seconds()
	b.lastUpdate = now

	// 补充 token
	b.tokens += elapsed * b.rate
	if b.tokens > b.burst {
		b.tokens = b.burst
	}

	if b.tokens >= 1.0 {
		b.tokens -= 1.0
		return true
	}
	return false
}

// idleSince 返回该桶最后一次被使用至今的时长（用于淘汰判定）。
func (b *TokenBucket) idleSince(now time.Time) time.Duration {
	b.mu.Lock()
	defer b.mu.Unlock()
	return now.Sub(b.lastUpdate)
}

// bucketIdleTTL 桶空闲多久后可被淘汰。远大于补满时间（burst/rate = 60s），
// 淘汰后重建等价于满桶，不会给攻击者额外配额。
const bucketIdleTTL = 10 * time.Minute

// bucketSweepThreshold 桶数超过此值时触发惰性清扫。
const bucketSweepThreshold = 1024

// RateLimiter 按 project 维度限流。
//
// 内存安全（原实现 buckets 永不淘汰）：云端 keystore 为 nil 时 X-Project-ID 由
// 客户端自填，攻击者发随机 project_id 可无限撑大 map（systemd MemoryMax=384M 会 OOM）。
// 现按 bucketIdleTTL 惰性淘汰空闲桶，上限受活跃 project 数约束。
type RateLimiter struct {
	ratePerMin int
	buckets    map[string]*TokenBucket
	mu         sync.RWMutex
}

// NewRateLimiter 创建限流器，ratePerMin 为每个 project 每分钟允许的请求数
func NewRateLimiter(ratePerMin int) *RateLimiter {
	if ratePerMin <= 0 {
		ratePerMin = 60
	}
	return &RateLimiter{
		ratePerMin: ratePerMin,
		buckets:    make(map[string]*TokenBucket),
	}
}

// Allow 检查 project 是否被允许
func (l *RateLimiter) Allow(projectID string) bool {
	l.mu.RLock()
	bucket, ok := l.buckets[projectID]
	l.mu.RUnlock()

	if !ok {
		l.mu.Lock()
		// double-check
		bucket, ok = l.buckets[projectID]
		if !ok {
			bucket = NewTokenBucket(l.ratePerMin)
			l.buckets[projectID] = bucket
			// 桶数超阈值时清扫空闲桶，防止 project_id 洪泛撑爆内存
			if len(l.buckets) > bucketSweepThreshold {
				l.sweepLocked()
			}
		}
		l.mu.Unlock()
	}

	return bucket.Allow()
}

// sweepLocked 淘汰空闲超过 bucketIdleTTL 的桶。调用方必须持有写锁。
func (l *RateLimiter) sweepLocked() {
	now := time.Now()
	for id, b := range l.buckets {
		if b.idleSince(now) > bucketIdleTTL {
			delete(l.buckets, id)
		}
	}
}

// Size 返回当前桶数（测试与可观测性用）。
func (l *RateLimiter) Size() int {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return len(l.buckets)
}
