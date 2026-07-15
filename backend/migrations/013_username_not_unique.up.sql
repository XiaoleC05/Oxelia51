-- 013_username_not_unique: 用户名可重复，仅 account_id 和 email 唯一
-- 用户反馈：注册逻辑不应被用户名占用阻塞；显示名应允许多用户共用

ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_username_key;
