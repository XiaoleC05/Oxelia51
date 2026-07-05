-- 006: 轮播设置（单行表）
CREATE TABLE IF NOT EXISTS carousel_settings (
    id                    INT PRIMARY KEY DEFAULT 1,
    autoplay_interval_ms  INTEGER NOT NULL DEFAULT 5000,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT singleton CHECK (id = 1)
);

INSERT INTO carousel_settings (id, autoplay_interval_ms)
VALUES (1, 5000)
ON CONFLICT (id) DO NOTHING;
