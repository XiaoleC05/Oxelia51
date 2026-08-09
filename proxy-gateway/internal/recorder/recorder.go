package recorder

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/adapter"
)

// Recorder 定义 token 记录写入接口
type Recorder interface {
	Record(record adapter.TokenRecord)
	Flush()
	Close()
}

// ChannelRecorder 使用 channel 缓冲的异步记录器。
//
// 并发模型（#7 修复）：batch 与 channel 仅由 run() goroutine 访问。
// Flush() 不直接操作 batch，而是经 flushReq channel 发信号让 run() 排空 + 落盘，
// 从而消除「Flush 与 run 争用 batch」的数据竞争（修复前实测 5000 条并发丢账）。
type ChannelRecorder struct {
	ch       chan adapter.TokenRecord
	wg       sync.WaitGroup
	batch    []adapter.TokenRecord
	maxBatch int
	flushTTL time.Duration
	writer   BatchWriter
	flushReq chan chan struct{} // Flush 信号：run 收到后排空 ch + flush，关闭 done
}

// BatchWriter 批量写入接口（由 ClickHouse/SQLite 实现）
type BatchWriter interface {
	WriteBatch(records []adapter.TokenRecord) error
}

// NewChannelRecorder 创建 channel 缓冲记录器
func NewChannelRecorder(writer BatchWriter) *ChannelRecorder {
	r := &ChannelRecorder{
		ch:       make(chan adapter.TokenRecord, 1000),
		maxBatch: 100,
		flushTTL: 1 * time.Second,
		writer:   writer,
		flushReq: make(chan chan struct{}, 16),
	}
	r.wg.Add(1)
	go r.run()
	return r
}

func (r *ChannelRecorder) run() {
	defer r.wg.Done()

	ticker := time.NewTicker(r.flushTTL)
	defer ticker.Stop()

	for {
		select {
		case record, ok := <-r.ch:
			if !ok {
				// channel 关闭，flush 剩余后退出
				r.drainAndFlush()
				return
			}
			r.batch = append(r.batch, record)
			if len(r.batch) >= r.maxBatch {
				r.flush()
			}
		case <-ticker.C:
			r.flush()
		case done := <-r.flushReq:
			// #7：只有 run 操作 batch/channel。排空 channel 后 flush，通知调用方完成。
			r.drainAndFlush()
			close(done)
		}
	}
}

// drainAndFlush 非阻塞排空 channel 并 flush（仅 run goroutine 调用）。
// 必须检查 ok：closed channel 的接收立即返回零值，若不判 ok 会死循环。
func (r *ChannelRecorder) drainAndFlush() {
	for {
		select {
		case record, ok := <-r.ch:
			if !ok {
				// channel 已关闭，flush 累积后停止
				r.flush()
				return
			}
			r.batch = append(r.batch, record)
		default:
			r.flush()
			return
		}
	}
}

func (r *ChannelRecorder) flush() {
	if len(r.batch) == 0 {
		return
	}
	if err := r.writer.WriteBatch(r.batch); err != nil {
		log.Printf("recorder batch write failed: %v, falling back to file", err)
		r.fallbackWrite(r.batch)
	}
	r.batch = r.batch[:0]
}

// fallbackDir 返回兜底落盘目录（#8：原硬编码 /opt/oxelia51/proxy 在 Windows 下
// 落到盘符根且云端/桌面混用）。优先 env，否则 ~/.oxelia51/（两端都可写）。
func fallbackDir() string {
	if d := os.Getenv("OXELIA_FALLBACK_DIR"); d != "" {
		return d
	}
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return filepath.Join(os.TempDir(), "oxelia51")
	}
	return filepath.Join(home, ".oxelia51")
}

func (r *ChannelRecorder) fallbackWrite(records []adapter.TokenRecord) {
	dir := fallbackDir()
	_ = os.MkdirAll(dir, 0o750)
	path := filepath.Join(dir, "fallback.jsonl")
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o640)
	if err != nil {
		log.Printf("fallback write failed: %v", err)
		return
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	for _, rec := range records {
		// #8：原 jsonMarshal 只写 4 个字段的 CSV，丢全部 token 数值且非合法 JSON。
		// 改用完整 JSON，保证 fallback 可被后续回收脚本解析。
		if err := enc.Encode(rec); err != nil {
			log.Printf("fallback encode failed: %v", err)
			return
		}
	}
}

// Record 异步写入一条记录
func (r *ChannelRecorder) Record(record adapter.TokenRecord) {
	select {
	case r.ch <- record:
	default:
		// channel 满了，降级直接写文件（#8：路径与格式已修正）
		log.Printf("recorder channel full, writing to fallback")
		r.fallbackWrite([]adapter.TokenRecord{record})
	}
}

// Flush 手动刷新缓冲（#7：信号驱动，由 run 排空 + 落盘，调用方等待完成）。
// run 已退出（Close 后）时 5s 超时返回，不阻塞调用方。
func (r *ChannelRecorder) Flush() {
	done := make(chan struct{})
	select {
	case r.flushReq <- done:
		select {
		case <-done:
		case <-time.After(5 * time.Second):
		}
	case <-time.After(5 * time.Second):
	}
}

// Close 关闭记录器，flush 剩余数据
func (r *ChannelRecorder) Close() {
	close(r.ch)
	r.wg.Wait()
}
