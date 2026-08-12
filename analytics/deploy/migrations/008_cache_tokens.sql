-- =============================================
-- 008 缓存细分列（2026-08）
--
-- why：
-- 桌面 proxy-gateway 自 v0.1.8 起把 Anthropic prompt caching 的
-- cache_read / cache_creation 与「原始 token 消耗」分开记账：
--   - prompt_tokens 仍存「计价输入」（缓存按 1.25×/0.1× 折算），成本计算不变；
--   - total_tokens 改存「原始 token」（含缓存 1×），UI 展示真实消耗；
--   - 新增 cache_read_tokens / cache_creation_tokens 列存缓存细分。
-- 本迁移给已部署的 synced_events 补这两列（幂等），使多设备同步能往返缓存细分。
-- 注意：ClickHouse oxelia51.token_events 的缓存列由 Go ClickHouseWriter 启动时
-- ADD COLUMN IF NOT EXISTS 自动补（见 recorder/clickhouse.go），无需此处处理。
-- =============================================

ALTER TABLE oxelia51.synced_events
    ADD COLUMN IF NOT EXISTS cache_read_tokens      BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cache_creation_tokens  BIGINT NOT NULL DEFAULT 0;
