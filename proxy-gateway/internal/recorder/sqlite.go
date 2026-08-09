package recorder

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/adapter"
	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

// SQLite 本地记账（P3 本地优先桌面端）。
// 与 ClickHouseWriter 实现同一 BatchWriter 接口，token 语义与云侧一致（§6.6）。
// 用 modernc.org/sqlite（纯 Go，无 cgo），保证 Windows/macOS/Linux 静态交叉编译。

const sqliteCreateTableSQL = `
CREATE TABLE IF NOT EXISTS token_events (
    event_id           TEXT PRIMARY KEY,
    project_id         TEXT NOT NULL,
    session_id         TEXT NOT NULL DEFAULT '',
    provider           TEXT NOT NULL DEFAULT '',
    model              TEXT NOT NULL DEFAULT '',
    prompt_tokens      INTEGER NOT NULL DEFAULT 0,
    completion_tokens  INTEGER NOT NULL DEFAULT 0,
    total_tokens       INTEGER NOT NULL DEFAULT 0,
    duration_ms        INTEGER NOT NULL DEFAULT 0,
    timestamp          TEXT NOT NULL,
    api_key_hash       TEXT NOT NULL DEFAULT '',
    partial            INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_token_events_ts      ON token_events (timestamp);
CREATE INDEX IF NOT EXISTS idx_token_events_session ON token_events (session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_token_events_project ON token_events (project_id, timestamp);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);
`

const timeLayout = "2006-01-02 15:04:05.000"

// SQLiteWriter 实现 BatchWriter，把 token 记录写入本地 SQLite。
type SQLiteWriter struct {
	db *sql.DB
}

// DefaultSQLitePath 返回默认本地账本路径 ~/.oxelia51/token_events.db
func DefaultSQLitePath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".oxelia51")
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return "", err
	}
	return filepath.Join(dir, "token_events.db"), nil
}

// NewSQLiteWriter 创建 SQLite 写入器，自动建表。path 为空时用默认路径。
func NewSQLiteWriter(path string) (*SQLiteWriter, error) {
	if path == "" {
		p, err := DefaultSQLitePath()
		if err != nil {
			return nil, err
		}
		path = p
	}
	// WAL：读写并发友好（sidecar 写、UI/统计读）；busy_timeout 避免写锁竞争报错
	dsn := fmt.Sprintf(
		"file:%s?_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)",
		path,
	)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("sqlite open: %w", err)
	}
	// WAL 下允许多连接：recorder 写 + localapi 读可并行（busy_timeout 兜底写锁）
	db.SetMaxOpenConns(8)
	if _, err := db.ExecContext(context.Background(), sqliteCreateTableSQL); err != nil {
		db.Close()
		return nil, fmt.Errorf("sqlite create tables: %w", err)
	}
	// #11: 老库补 partial 列（CREATE TABLE IF NOT EXISTS 不会给既有表加列）。
	// 已存在时 SQLite 报 "duplicate column name"，属预期，忽略。
	if _, err := db.ExecContext(context.Background(),
		`ALTER TABLE token_events ADD COLUMN partial INTEGER NOT NULL DEFAULT 0`,
	); err != nil && !strings.Contains(err.Error(), "duplicate column") {
		log.Printf("sqlite migrate partial column: %v", err)
	}
	log.Printf("sqlite ready at %s", path)
	return &SQLiteWriter{db: db}, nil
}

// WriteBatch 批量写入 token_events（事务 + 预编译语句）。
func (w *SQLiteWriter) WriteBatch(records []adapter.TokenRecord) error {
	if len(records) == 0 {
		return nil
	}
	tx, err := w.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`INSERT OR IGNORE INTO token_events
		(event_id, project_id, session_id, provider, model,
		 prompt_tokens, completion_tokens, total_tokens, duration_ms, timestamp, api_key_hash, partial)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

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
		if len(apiKeyHash) > 64 {
			apiKeyHash = apiKeyHash[:64]
		}
		ts := r.Timestamp
		if ts.IsZero() {
			ts = time.Now()
		}
		partial := 0
		if r.Partial {
			partial = 1
		}
		if _, err := stmt.Exec(
			eventID, r.ProjectID, r.SessionID, r.Provider, r.Model,
			r.PromptTokens, r.CompletionTokens, r.TotalTokens, r.DurationMs,
			ts.Format(timeLayout), apiKeyHash, partial,
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// DB 暴露底层连接，供本地只读统计接口查询。
func (w *SQLiteWriter) DB() *sql.DB { return w.db }

// Close 关闭连接。
func (w *SQLiteWriter) Close() error { return w.db.Close() }

// NewSQLiteRecorder 创建完整的本地记录器（ChannelRecorder + SQLiteWriter）。
func NewSQLiteRecorder(path string) (*ChannelRecorder, *SQLiteWriter, error) {
	writer, err := NewSQLiteWriter(path)
	if err != nil {
		return nil, nil, err
	}
	return NewChannelRecorder(writer), writer, nil
}
