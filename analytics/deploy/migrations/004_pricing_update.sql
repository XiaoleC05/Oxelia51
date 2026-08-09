-- 模型定价修正（#25）：对齐当前官方公开价，与 003 seed 及桌面参考价口径一致。
-- 已部署环境执行一次即可（幂等 UPDATE）；新装环境直接由 003 里修正后的价格生效。
-- 003_model_pricing_seed.sql 已同步更新 claude-opus-5 → 15.00/75.00。

-- claude-opus-5：5/25 是旧版 Opus 定价，官方现价 15/75
UPDATE oxelia51.model_pricing
SET prompt_price_usd = 15.00, completion_price_usd = 75.00
WHERE model = 'claude-opus-5';

-- deepseek-chat：0.14/0.28 为早期价，003 seed 为 0.27/1.10（保持二者一致）
UPDATE oxelia51.model_pricing
SET prompt_price_usd = 0.27, completion_price_usd = 1.10
WHERE model = 'deepseek-chat';
