-- 回滚：移除 account_id 列
DROP INDEX IF EXISTS idx_users_account_id;
ALTER TABLE users DROP COLUMN IF EXISTS account_id;
