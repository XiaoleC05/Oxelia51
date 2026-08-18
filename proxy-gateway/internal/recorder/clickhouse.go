package recorder

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/adapter"
	"github.com/google/uuid"
)

const createTableSQL = `
CREATE TABLE IF NOT EXISTS oxelia51.token_events (
    event_id String,
    project_id String,
    session_id String,
    provider LowCardinality(String),
    agent LowCardinality(String),
    model String,
    prompt_tokens UInt32,
    completion_tokens UInt32,
    total_tokens UInt32,
    cache_read_tokens UInt32,
    cache_creation_tokens UInt32,
    cost_usd Float64,
    duration_ms UInt32,
    timestamp DateTime64(3),
    api_key_hash FixedString(64)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp)
`

// alterTableAgentSQL 对存量表补 agent 列（2026-08-09 建的 oxelia51.token_events 无此列，
// CREATE TABLE IF NOT EXISTS 不会自动加列；ADD COLUMN IF NOT EXISTS 幂等，每次启动执行安全）。
const alterTableAgentSQL = `
ALTER TABLE oxelia51.token_events
    ADD COLUMN IF NOT EXISTS agent LowCardinality(String)
`

// alterTableCacheSQL 对存量表补缓存细分列（缓存命中/写入，见 adapter.TokenRecord）。
// 与 agent 列同理幂等。ADD COLUMN IF NOT EXISTS 每次启动执行安全。
const alterTableCacheSQL = `
ALTER TABLE oxelia51.token_events
    ADD COLUMN IF NOT EXISTS cache_read_tokens UInt32,
    ADD COLUMN IF NOT EXISTS cache_creation_tokens UInt32
`

// ClickHouseWriter 实现 BatchWriter 接口
type ClickHouseWriter struct {
	conn driver.Conn
}

// NewClickHouseWriter 创建 ClickHouse 写入器，自动建表
func NewClickHouseWriter(addr, user, password string) (*ClickHouseWriter, error) {
	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{addr},
		Auth: clickhouse.Auth{
			Database: "default",
			Username: user,
			Password: password,
		},
		DialTimeout: 5 * time.Second,
	})
	if err != nil {
		return nil, fmt.Errorf("clickhouse connect: %w", err)
	}

	ctx := context.Background()
	if err := conn.Exec(ctx, createTableSQL); err != nil {
		return nil, fmt.Errorf("create table: %w", err)
	}
	// 存量表补 agent 列（幂等），保证 WriteBatch 13 列 INSERT 与 byProvider/byAgent 查询可用
	if err := conn.Exec(ctx, alterTableAgentSQL); err != nil {
		return nil, fmt.Errorf("alter table agent: %w", err)
	}
	// 存量表补缓存细分列（幂等）
	if err := conn.Exec(ctx, alterTableCacheSQL); err != nil {
		return nil, fmt.Errorf("alter table cache: %w", err)
	}

	log.Printf("clickhouse connected, table ready")
	return &ClickHouseWriter{conn: conn}, nil
}

// WriteBatch 批量写入 token_events
func (w *ClickHouseWriter) WriteBatch(records []adapter.TokenRecord) error {
	ctx := context.Background()
	batch, err := w.conn.PrepareBatch(ctx, "INSERT INTO oxelia51.token_events (event_id, project_id, session_id, provider, agent, model, prompt_tokens, completion_tokens, total_tokens, cache_read_tokens, cache_creation_tokens, cost_usd, duration_ms, timestamp, api_key_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
	if err != nil {
		return err
	}

	for _, r := range records {
		eventID := r.EventID
		if eventID == "" {
			eventID = uuid.NewString()
		}
		apiKeyHash := resolveAPIKeyHash(r)

		err := batch.Append(
			eventID,
			r.ProjectID,
			r.SessionID,
			r.Provider,
			r.Agent,
			r.Model,
			r.PromptTokens,
			r.CompletionTokens,
			r.TotalTokens,
			r.CacheReadTokens,
			r.CacheCreationTokens,
			0.0, // cost_usd 暂不计算
			r.DurationMs,
			r.Timestamp,
			apiKeyHash,
		)
		if err != nil {
			return err
		}
	}

	return batch.Send()
}

// Close 关闭连接
func (w *ClickHouseWriter) Close() error {
	return w.conn.Close()
}

// NewClickHouseRecorder 创建一个完整的 ClickHouse 记录器（ChannelRecorder + ClickHouseWriter）
func NewClickHouseRecorder(addr, user, password string) (*ChannelRecorder, *ClickHouseWriter, error) {
	writer, err := NewClickHouseWriter(addr, user, password)
	if err != nil {
		return nil, nil, err
	}
	return NewChannelRecorder(writer), writer, nil
}

// RecoveringWriter 在 ClickHouse 短暂不可用（如容器重启窗口）时自动恢复写入：
// 初始 inner 为 nil 或写失败后，以 ≤60s 一次的频率尝试重建连接，成功后热切换。
// 恢复前的批次按 no-op 处理（不阻塞请求链路）；WriteBatch 运行在 ChannelRecorder
// 的消费 goroutine 中，重建期间的阻塞不占用请求路径。
type RecoveringWriter struct {
	mu                   sync.Mutex
	inner                *ClickHouseWriter
	addr, user, password string
	lastAttempt          time.Time
}

// NewRecoveringWriter 创建可自愈写入器；inner 可为 nil（初始化失败场景）
func NewRecoveringWriter(addr, user, password string, inner *ClickHouseWriter) *RecoveringWriter {
	return &RecoveringWriter{addr: addr, user: user, password: password, inner: inner}
}

// WriteBatch 实现 BatchWriter：inner 可用则直接写；失败或为 nil 时按节流频率尝试重建
func (w *RecoveringWriter) WriteBatch(records []adapter.TokenRecord) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.inner != nil {
		if err := w.inner.WriteBatch(records); err == nil {
			return nil
		} else {
			_ = w.inner.Close()
			w.inner = nil
			log.Printf("clickhouse write failed, entering recovery: %v", err)
		}
	}

	// 节流：最多每 60s 尝试一次重建，避免 CH 长时间不可用时反复拨号刷日志
	if time.Since(w.lastAttempt) < time.Minute {
		return nil
	}
	w.lastAttempt = time.Now()

	writer, err := NewClickHouseWriter(w.addr, w.user, w.password)
	if err != nil {
		log.Printf("clickhouse recovery attempt failed: %v", err)
		return nil
	}
	w.inner = writer
	log.Printf("clickhouse recorder recovered, hot-swapped")
	return w.inner.WriteBatch(records) // 重放当前批次
}
