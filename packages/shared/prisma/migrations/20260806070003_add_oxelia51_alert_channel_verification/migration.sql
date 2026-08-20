-- Oxelia51 告警邮件通道验证：alert_channels 追加验证码列（6 位数字码 + 过期时间）。
-- 注意：oxelia51 schema 的表本体（含 alert_channels）由外部分析引擎（C++ 侧）
-- 建管，不经 Prisma；本迁移仅追加验证相关列，供 web 端告警通道验证闭环使用。
-- 随 web 容器启动时 entrypoint.sh 的 `prisma migrate deploy` 应用（幂等，可重复执行）。

ALTER TABLE oxelia51.alert_channels
    ADD COLUMN IF NOT EXISTS verification_code TEXT,
    ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMPTZ;
