package recorder

import (
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

// ChannelRecorder 使用 channel 缓冲的异步记录器
type ChannelRecorder struct {
	ch       chan adapter.TokenRecord
	wg       sync.WaitGroup
	batch    []adapter.TokenRecord
	maxBatch int
	flushTTL time.Duration
	writer   BatchWriter
}

// BatchWriter 批量写入接口（由 ClickHouse 实现实现）
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
				// channel 关闭，flush 剩余
				r.flush()
				return
			}
			r.batch = append(r.batch, record)
			if len(r.batch) >= r.maxBatch {
				r.flush()
			}
		case <-ticker.C:
			r.flush()
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

func (r *ChannelRecorder) fallbackWrite(records []adapter.TokenRecord) {
	dir := "/opt/oxelia51/proxy"
	_ = os.MkdirAll(dir, 0750)
	path := filepath.Join(dir, "fallback.jsonl")
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0640)
	if err != nil {
		log.Printf("fallback write failed: %v", err)
		return
	}
	defer f.Close()

	for _, rec := range records {
		data, _ := jsonMarshal(rec)
		f.Write(data)
		f.Write([]byte("\n"))
	}
}

// Record 异步写入一条记录
func (r *ChannelRecorder) Record(record adapter.TokenRecord) {
	select {
	case r.ch <- record:
	default:
		// channel 满了，降级直接写文件
		log.Printf("recorder channel full, writing to fallback")
		r.fallbackWrite([]adapter.TokenRecord{record})
	}
}

// Flush 手动刷新缓冲
func (r *ChannelRecorder) Flush() {
	// 排空 channel（非阻塞）
	for {
		select {
		case record := <-r.ch:
			r.batch = append(r.batch, record)
		default:
			r.flush()
			return
		}
	}
}

// Close 关闭记录器，flush 剩余数据
func (r *ChannelRecorder) Close() {
	close(r.ch)
	r.wg.Wait()
}

// jsonMarshal 简单 JSON 序列化用于 fallback
func jsonMarshal(r adapter.TokenRecord) ([]byte, error) {
	return []byte(r.EventID + "," + r.ProjectID + "," + r.Provider + "," + r.Model), nil
}
