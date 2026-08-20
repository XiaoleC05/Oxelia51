-- Oxelia51 用户反馈表。
-- 注意：oxelia51 schema 的其余表（daily_stats / budget_configs / alert_channels /
-- alert_logs / exchange_rates）由外部分析引擎（Go/C++ 侧）建管，不经 Prisma；
-- feedback 是首个由本仓库管理的 oxelia51 表，随 web 容器启动时
-- entrypoint.sh 的 `prisma migrate deploy` 应用（幂等，可重复执行）。

CREATE SCHEMA IF NOT EXISTS oxelia51;

CREATE TABLE IF NOT EXISTS oxelia51.feedback (
    id          BIGSERIAL PRIMARY KEY,
    email       TEXT NOT NULL,
    category    TEXT NOT NULL,
    message     TEXT NOT NULL,
    project_id  TEXT,
    status      TEXT NOT NULL DEFAULT 'new',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_created_at_idx
    ON oxelia51.feedback (created_at DESC);
