-- 008: 扩展文章表 + 静态页面表
-- 文章增加正文内容和标签
ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE;

-- 静态页面（关于、隐私政策等）
CREATE TABLE IF NOT EXISTS pages (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(64) UNIQUE NOT NULL,
    title       VARCHAR(128) NOT NULL,
    content     TEXT DEFAULT '',
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pages (slug, title, content, enabled)
VALUES ('about', '关于', '你好，我是陈晓乐。这里是我的个人平台，集合了在线工具、项目作品和学习笔记。', TRUE)
ON CONFLICT (slug) DO NOTHING;
