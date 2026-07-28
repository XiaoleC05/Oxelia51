package recorder

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"time"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/adapter"
	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
)

const createTableSQL = `
CREATE TABLE IF NOT EXISTS oxelia51.token_events (
    event_id String,
    project_id String,
    session_id String,
    provider LowCardinality(String),
    model String,
    prompt_tokens UInt32,
    completion_tokens UInt32,
    total_tokens UInt32,
    cost_usd Float64,
    duration_ms UInt32,
    timestamp DateTime64(3),
    api_key_hash FixedString(64)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp)
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

	log.Printf("clickhouse connected, table ready")
	return &ClickHouseWriter{conn: conn}, nil
}

// WriteBatch 批量写入 token_events
func (w *ClickHouseWriter) WriteBatch(records []adapter.TokenRecord) error {
	ctx := context.Background()
	batch, err := w.conn.PrepareBatch(ctx, "INSERT INTO oxelia51.token_events (event_id, project_id, session_id, provider, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, timestamp, api_key_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
	if err != nil {
		return err
	}

	for _, r := range records {
		eventID := r.EventID
		if eventID == "" {
			eventID = uuid.NewString()
		}
		apiKeyHash := r.APIKeyHash
		if apiKeyHash == "" {
			h := sha256.Sum256([]byte(r.ProjectID))
			apiKeyHash = hex.EncodeToString(h[:])
		}
		// API key hash 需要 64 字节的 hex，截断为 FixedString(64)
		if len(apiKeyHash) > 64 {
			apiKeyHash = apiKeyHash[:64]
		}

		err := batch.Append(
			eventID,
			r.ProjectID,
			r.SessionID,
			r.Provider,
			r.Model,
			r.PromptTokens,
			r.CompletionTokens,
			r.TotalTokens,
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
