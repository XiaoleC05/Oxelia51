-- 007: 文章展示（博客合并）
CREATE TABLE IF NOT EXISTS articles (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(256) NOT NULL,
    url             TEXT NOT NULL,
    summary         VARCHAR(512) DEFAULT '',
    category        VARCHAR(64) DEFAULT '',
    published_at    DATE,
    display_order   INTEGER NOT NULL DEFAULT 0,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_order ON articles(display_order);
