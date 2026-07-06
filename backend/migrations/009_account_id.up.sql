-- v1.2: 新增 account_id 作为不可变唯一账号标识，username 改为可修改显示名

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id VARCHAR(32);

-- 向后兼容：将现有 username 值复制到 account_id
UPDATE users SET account_id = username WHERE account_id IS NULL;

-- 设置 NOT NULL 约束（数据回填后安全执行）
ALTER TABLE users ALTER COLUMN account_id SET NOT NULL;

-- 唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account_id ON users (account_id);
