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

// RateLimiter 按 project 维度限流
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
		}
		l.mu.Unlock()
	}

	return bucket.Allow()
}
