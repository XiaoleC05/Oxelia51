CREATE TABLE IF NOT EXISTS ip_whitelist (
    id         BIGSERIAL PRIMARY KEY,
    ip         TEXT NOT NULL UNIQUE,
    label      TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
