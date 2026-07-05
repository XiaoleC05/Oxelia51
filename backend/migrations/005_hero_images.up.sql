-- 005: 首页头图轮播
CREATE TABLE IF NOT EXISTS hero_images (
    id          SERIAL PRIMARY KEY,
    image_url   TEXT NOT NULL,
    title       VARCHAR(128) DEFAULT '',
    subtitle    VARCHAR(256) DEFAULT '',
    display_order   INTEGER NOT NULL DEFAULT 0,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hero_images_order ON hero_images(display_order);
