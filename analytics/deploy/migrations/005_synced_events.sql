-- =============================================
--  Oxelia51 — 桌面账本云同步数据表
--  用途：桌面端 sidecar 经 web /api/sync/* 上传的 token 事件落库，
--        供多设备增量同步与 /app 设置页「同步账本」汇总展示。
--  下游：web/src/pages/api/sync/*（login/upload/download）、
--        web/src/features/oxelia51/server/syncRouter.ts（tRPC 状态/吊销）。
--  幂等：全部 IF NOT EXISTS，重复执行安全。
-- =============================================

CREATE SCHEMA IF NOT EXISTS oxelia51;

-- 同步事件：event_id 全局唯一（桌面端生成，重复上传靠主键 ON CONFLICT 去重）；
-- seq 全局递增，作为 download 增量游标（after=seq）；synced_at 记录落库时间。
CREATE TABLE IF NOT EXISTS oxelia51.synced_events (
    event_id          TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL,
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
    seq               BIGSERIAL,
    synced_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 增量同步按 (user_id, seq) 翻页；汇总报表按 (user_id, ts) 过滤时间窗
CREATE INDEX IF NOT EXISTS idx_synced_events_user_seq ON oxelia51.synced_events (user_id, seq);
CREATE INDEX IF NOT EXISTS idx_synced_events_user_ts  ON oxelia51.synced_events (user_id, ts);

-- 同步密钥：桌面端用注册邮箱+密码登录后签发，明文仅下发一次；
-- 库中只存 sha256(token)，长期有效，revoked_at 置位即吊销（/app 设置页「断开」）。
-- user_id 关联 Langfuse public.users(id)（TEXT/cuid），删用户时级联清理密钥。
CREATE TABLE IF NOT EXISTS oxelia51.sync_tokens (
    id           BIGSERIAL PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,
    device_label TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ
);
