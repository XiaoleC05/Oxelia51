-- 跨设备同步事件表（与 internal/domain/sync/repository.go 的 EnsureTable 对齐，幂等）
-- 新部署由本迁移建表；EnsureTable 保留为旧部署兜底
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
    synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_synced_events_user_ts ON synced_events (user_id, ts);
-- 存量表补 agent 列（早期版本建表无此列，ADD COLUMN IF NOT EXISTS 幂等）
ALTER TABLE synced_events
    ADD COLUMN IF NOT EXISTS agent TEXT NOT NULL DEFAULT '';
