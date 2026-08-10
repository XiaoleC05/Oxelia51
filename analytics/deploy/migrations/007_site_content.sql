-- =============================================
-- 007 站点内容编辑存储（2026-08）
--  用途：管理台「内容编辑」Tab 的 key → JSONB 存储，供 /changelog 与首页文案读取。
--  页面读取时缺省回退硬编码默认值（web/src/features/oxelia51/content/defaults.ts），
--  管理台写入后即覆盖生效，无需发版。
--  幂等：IF NOT EXISTS，重复执行安全。
-- =============================================

CREATE SCHEMA IF NOT EXISTS oxelia51;

CREATE TABLE IF NOT EXISTS oxelia51.site_content (
    key        TEXT PRIMARY KEY,
    content    JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
