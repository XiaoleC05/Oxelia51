package recorder

import (
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/adapter"
)

// countingWriter 计数实际写入的记录数，用于验证不丢不重。
type countingWriter struct {
	mu sync.Mutex
	n  int
}

func (w *countingWriter) WriteBatch(r []adapter.TokenRecord) error {
	w.mu.Lock()
	w.n += len(r)
	w.mu.Unlock()
	return nil
}

// TestFlushConcurrentNoLoss 验证 #7 修复：并发 Record + 少量 Flush 不丢记录。
// 修复前 Flush 直接读写 r.batch，与 run() 数据竞争；
// 信号驱动后只有 run 操作 batch，Flush 发信号等完成。
// 生产中 Flush 仅在 SIGINT 关闭时调用一次，这里用少量 Flush 模拟。
func TestFlushConcurrentNoLoss(t *testing.T) {
	w := &countingWriter{}
	r := NewChannelRecorder(w)
	const total = 500
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for i := 0; i < total; i++ {
			r.Record(adapter.TokenRecord{ProjectID: "p", TotalTokens: 1, Timestamp: time.Now()})
			// 让出调度，避免 channel（buffer 1000）瞬间堆满触发 fallback 分支
			//（fallback 路径是 #8 的独立问题，本测试专注验证 Flush 并发不丢已入 channel 的记录）
			if i%10 == 0 {
				runtime.Gosched()
			}
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < 5; i++ { // 少量 Flush（模拟用户手动刷新）
			r.Flush()
		}
	}()
	wg.Wait()
	r.Close() // Close 再 flush 残余

	w.mu.Lock()
	defer w.mu.Unlock()
	if w.n != total {
		t.Fatalf("LOST/DUPLICATED: written=%d want=%d", w.n, total)
	}
}

// TestCloseFlushesPending 验证 Close 把尚未 flush 的记录全部落盘（#7）。
func TestCloseFlushesPending(t *testing.T) {
	w := &countingWriter{}
	r := NewChannelRecorder(w)
	for i := 0; i < 50; i++ {
		r.Record(adapter.TokenRecord{ProjectID: "p", Timestamp: time.Now()})
	}
	r.Close() // 应 flush 全部 50 条
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.n != 50 {
		t.Fatalf("Close lost records: written=%d want=50", w.n)
	}
}

// TestFlushAfterClose 验证 Close 后再调 Flush 不死锁/不 panic（#7：5s 超时兜底）。
func TestFlushAfterClose(t *testing.T) {
	w := &countingWriter{}
	r := NewChannelRecorder(w)
	r.Record(adapter.TokenRecord{ProjectID: "p", Timestamp: time.Now()})
	r.Close()
	done := make(chan struct{})
	go func() {
		r.Flush() // run 已退出，应超时返回而非死锁
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(7 * time.Second):
		t.Fatal("Flush after Close deadlocked")
	}
}
