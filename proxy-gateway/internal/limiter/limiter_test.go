package limiter

import (
	"fmt"
	"testing"
	"time"
)

// TestAllowBasic 基本限流：ratePerMin 个请求内放行，超出拒绝。
func TestAllowBasic(t *testing.T) {
	l := NewRateLimiter(5)
	for i := 0; i < 5; i++ {
		if !l.Allow("p1") {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}
	if l.Allow("p1") {
		t.Fatal("6th request should be rejected (burst=5)")
	}
}

// TestAllowPerProjectIsolation 不同 project 互不影响。
func TestAllowPerProjectIsolation(t *testing.T) {
	l := NewRateLimiter(2)
	if !l.Allow("a") || !l.Allow("a") {
		t.Fatal("project a should get 2 tokens")
	}
	if l.Allow("a") {
		t.Fatal("project a exhausted")
	}
	// b 有独立配额
	if !l.Allow("b") {
		t.Fatal("project b should have its own bucket")
	}
}

// TestBucketSweep 验证内存安全：桶数超阈值后空闲桶被淘汰，
// 防止客户端自填 X-Project-ID 洪泛撑爆内存。
func TestBucketSweep(t *testing.T) {
	l := NewRateLimiter(60)

	// 灌入超过阈值的桶，并把它们标记为已空闲（回拨 lastUpdate）
	for i := 0; i < bucketSweepThreshold; i++ {
		id := fmt.Sprintf("flood-%d", i)
		l.Allow(id)
	}
	// 手动把所有桶置为过期
	l.mu.Lock()
	stale := time.Now().Add(-2 * bucketIdleTTL)
	for _, b := range l.buckets {
		b.mu.Lock()
		b.lastUpdate = stale
		b.mu.Unlock()
	}
	l.mu.Unlock()

	before := l.Size()
	if before < bucketSweepThreshold {
		t.Fatalf("setup: expected >= %d buckets, got %d", bucketSweepThreshold, before)
	}

	// 再插一个新桶触发清扫
	l.Allow("trigger-sweep")

	after := l.Size()
	if after >= before {
		t.Fatalf("sweep did not evict: before=%d after=%d", before, after)
	}
	// 清扫后应只剩刚插入的活跃桶
	if after > 2 {
		t.Errorf("expected ~1 active bucket after sweep, got %d", after)
	}
}

// TestSweepKeepsActiveBuckets 清扫不应误删活跃桶。
func TestSweepKeepsActiveBuckets(t *testing.T) {
	l := NewRateLimiter(60)

	// 一批过期桶
	for i := 0; i < bucketSweepThreshold; i++ {
		l.Allow(fmt.Sprintf("old-%d", i))
	}
	l.mu.Lock()
	stale := time.Now().Add(-2 * bucketIdleTTL)
	for id, b := range l.buckets {
		b.mu.Lock()
		b.lastUpdate = stale
		b.mu.Unlock()
		_ = id
	}
	l.mu.Unlock()

	// 一个活跃桶（刚用过）
	l.Allow("active")

	// 触发清扫
	l.Allow("trigger")

	l.mu.RLock()
	_, activeAlive := l.buckets["active"]
	l.mu.RUnlock()
	if !activeAlive {
		t.Fatal("active bucket was wrongly evicted")
	}
}
