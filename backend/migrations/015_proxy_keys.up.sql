-- 代理网关项目密钥表（阿里云 PG，网关与 Go 后端同机）
-- key 明文只在创建时返回一次，DB 存 sha256(key) hex
CREATE TABLE IF NOT EXISTS proxy_keys (
    id BIGSERIAL PRIMARY KEY,
    project_id TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,        -- 展示用前缀（如 ox_abc12_，不含明文随机段）
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_proxy_keys_project ON proxy_keys (project_id);
