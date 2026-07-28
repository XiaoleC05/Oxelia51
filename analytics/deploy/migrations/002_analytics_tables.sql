-- =============================================
--  Oxelia51 v3.0 — C++ 分析引擎数据表
--  执行环境：腾讯云 PostgreSQL (127.0.0.1:5434, langfuse-postgres)
--  说明：所有表创建在 oxelia51 schema 下
-- =============================================

CREATE SCHEMA IF NOT EXISTS oxelia51;

-- 日统计（UPSERT by project_id + model + date，累加模式）
CREATE TABLE IF NOT EXISTS oxelia51.daily_stats (
    project_id        TEXT NOT NULL,
    model             TEXT NOT NULL,
    date              DATE NOT NULL,
    prompt_tokens     BIGINT DEFAULT 0,
    completion_tokens BIGINT DEFAULT 0,
    total_tokens      BIGINT DEFAULT 0,
    cost_usd          DOUBLE PRECISION DEFAULT 0.0,
    request_count     BIGINT DEFAULT 0,
    updated_at        TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (project_id, model, date)
);

-- 预算配置（管理后台维护）
CREATE TABLE IF NOT EXISTS oxelia51.budget_configs (
    project_id   TEXT PRIMARY KEY,
    budget_usd   DOUBLE PRECISION NOT NULL,
    threshold    DOUBLE PRECISION DEFAULT 0.8,
    enabled      BOOLEAN DEFAULT true,
    updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 告警日志（检测步骤写入 pending，分发步骤标记 sent）
CREATE TABLE IF NOT EXISTS oxelia51.alert_logs (
    id          BIGSERIAL PRIMARY KEY,
    project_id  TEXT NOT NULL,
    alert_type  TEXT NOT NULL,   -- 'anomaly' | 'budget'
    severity    TEXT DEFAULT 'warning',
    message     TEXT,
    status      TEXT DEFAULT 'pending',  -- 'pending' | 'sent' | 'acknowledged'
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alert_logs_status ON oxelia51.alert_logs (status);

-- 告警通道（per-project 邮件 / Webhook 分发）
CREATE TABLE IF NOT EXISTS oxelia51.alert_channels (
    id          BIGSERIAL PRIMARY KEY,
    project_id  TEXT NOT NULL,
    type        TEXT NOT NULL,   -- 'email' | 'webhook'
    address     TEXT NOT NULL,   -- 邮箱地址或 Webhook URL
    verified    BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alert_channels_project ON oxelia51.alert_channels (project_id);

-- 引擎状态（记录上次处理的最大 timestamp，避免重复聚合）
CREATE TABLE IF NOT EXISTS oxelia51.engine_state (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO oxelia51.engine_state (key, value) VALUES ('last_processed', now()::text)
ON CONFLICT DO NOTHING;

-- 定价表（管理后台维护，C++ 引擎读取；初始内置 3 个常用模型）
CREATE TABLE IF NOT EXISTS oxelia51.model_pricing (
    model                  TEXT PRIMARY KEY,
    provider               TEXT,
    prompt_price_usd       DOUBLE PRECISION,   -- per 1M tokens, USD
    completion_price_usd   DOUBLE PRECISION,
    updated_at             TIMESTAMPTZ DEFAULT now()
);
INSERT INTO oxelia51.model_pricing (model, provider, prompt_price_usd, completion_price_usd) VALUES
    ('claude-sonnet-5', 'anthropic', 3.00, 15.00),
    ('gpt-4o',          'openai',    2.50, 10.00),
    ('deepseek-chat',   'deepseek',   0.14,  0.28)
ON CONFLICT DO NOTHING;

-- 汇率表（定时任务每日更新；引擎写入当天默认值兜底）
CREATE TABLE IF NOT EXISTS oxelia51.exchange_rates (
    date             DATE PRIMARY KEY,
    rate_cny_per_usd DOUBLE PRECISION,
    updated_at       TIMESTAMPTZ DEFAULT now()
);
INSERT INTO oxelia51.exchange_rates (date, rate_cny_per_usd) VALUES (CURRENT_DATE, 7.20)
ON CONFLICT DO NOTHING;
