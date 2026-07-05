-- 003_auth_v11 回滚脚本
-- 注意：回滚将丢弃 email_verified 列及其数据；
-- 若 users 表已存在依赖该列的行（如已验证用户），回滚后需重新执行 003 up 重建。
ALTER TABLE users
    DROP COLUMN IF EXISTS email_verified;
