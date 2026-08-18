package sync

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SyncEvent 跨设备同步的一条 token 事件（与桌面本地 token_events 同语义）。
type SyncEvent struct {
	EventID          string    `json:"eventId"`
	DeviceID         string    `json:"deviceId"`
	ProjectID        string    `json:"projectId"`
	SessionID        string    `json:"sessionId"`
	Provider         string    `json:"provider"`
	Agent            string    `json:"agent"`
	Model            string    `json:"model"`
	PromptTokens     int64     `json:"promptTokens"`
	CompletionTokens int64     `json:"completionTokens"`
	TotalTokens      int64     `json:"totalTokens"`
	DurationMs       int64     `json:"durationMs"`
	TS               time.Time `json:"ts"`
}

const createTableSQL = `
CREATE TABLE IF NOT EXISTS synced_events (
  event_id          TEXT PRIMARY KEY,
  user_id           BIGINT NOT NULL,
  device_id         TEXT NOT NULL DEFAULT '',
  project_id        TEXT NOT NULL DEFAULT '',
  session_id        TEXT NOT NULL DEFAULT '',
  provider          TEXT NOT NULL DEFAULT '',
  agent             TEXT NOT NULL DEFAULT '',
  model             TEXT NOT NULL DEFAULT '',
  prompt_tokens     BIGINT NOT NULL DEFAULT 0,
  completion_tokens BIGINT NOT NULL DEFAULT 0,
  total_tokens      BIGINT NOT NULL DEFAULT 0,
  duration_ms       BIGINT NOT NULL DEFAULT 0,
  ts                TIMESTAMPTZ NOT NULL,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_synced_events_user_ts ON synced_events (user_id, ts);
`

// alterTableAgentSQL 对存量 synced_events 补 agent 列（若表已由早前版本建过、无 agent 列，
// CREATE TABLE IF NOT EXISTS 是空操作，InsertEvents/ListEventsAfter 引用 agent 会报错；
// ADD COLUMN IF NOT EXISTS 幂等，EnsureTable 每次执行安全）。
const alterTableAgentSQL = `
ALTER TABLE synced_events
    ADD COLUMN IF NOT EXISTS agent TEXT NOT NULL DEFAULT ''
`

// Repository 同步事件存储
type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// EnsureTable 建表（幂等）。旧部署兜底：新部署由迁移 016_sync_events.up.sql 负责，
// 此处保留以防未跑迁移的旧环境启动后缺表。
func (r *Repository) EnsureTable(ctx context.Context) error {
	if _, err := r.pool.Exec(ctx, createTableSQL); err != nil {
		return err
	}
	// 存量表补 agent 列（幂等）
	_, err := r.pool.Exec(ctx, alterTableAgentSQL)
	return err
}

// InsertEvents 批量写入，event_id 冲突忽略（幂等合并）。
func (r *Repository) InsertEvents(ctx context.Context, userID int64, events []SyncEvent) (int64, error) {
	if len(events) == 0 {
		return 0, nil
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	var inserted int64
	for _, e := range events {
		tag, err := tx.Exec(ctx, `
			INSERT INTO synced_events
			  (event_id, user_id, device_id, project_id, session_id, provider, agent, model,
			   prompt_tokens, completion_tokens, total_tokens, duration_ms, ts)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
			ON CONFLICT (event_id) DO NOTHING`,
			e.EventID, userID, e.DeviceID, e.ProjectID, e.SessionID, e.Provider, e.Agent, e.Model,
			e.PromptTokens, e.CompletionTokens, e.TotalTokens, e.DurationMs, e.TS,
		)
		if err != nil {
			return inserted, err
		}
		inserted += tag.RowsAffected()
	}
	return inserted, tx.Commit(ctx)
}

// ListEventsAfter 返回某用户 after 时间之后的、非本设备上传的事件（增量下行）。
func (r *Repository) ListEventsAfter(ctx context.Context, userID int64, after time.Time, excludeDevice string, limit int) ([]SyncEvent, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT event_id, device_id, project_id, session_id, provider, agent, model,
		       prompt_tokens, completion_tokens, total_tokens, duration_ms, ts
		FROM synced_events
		WHERE user_id = $1 AND ts > $2 AND device_id != $3
		ORDER BY ts ASC
		LIMIT $4`,
		userID, after, excludeDevice, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := []SyncEvent{}
	for rows.Next() {
		var e SyncEvent
		if err := rows.Scan(&e.EventID, &e.DeviceID, &e.ProjectID, &e.SessionID, &e.Provider, &e.Agent, &e.Model,
			&e.PromptTokens, &e.CompletionTokens, &e.TotalTokens, &e.DurationMs, &e.TS); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, rows.Err()
}
