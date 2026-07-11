-- 012: 站点设置（单行表）
CREATE TABLE IF NOT EXISTS site_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    launched_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_settings (id, launched_at) VALUES (1, NOW()) ON CONFLICT DO NOTHING;
