-- 010: 关于开发者单行配置表
CREATE TABLE IF NOT EXISTS developer_profile (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    bio TEXT DEFAULT '',
    resume TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO developer_profile (id) VALUES (1) ON CONFLICT DO NOTHING;
