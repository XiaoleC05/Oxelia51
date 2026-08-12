-- =============================================
-- 006 定价口径同步（2026-08）
--
-- why：
-- 1) 已部署库跑的是旧版 003（约 20 行）+ 004（曾把 claude-opus-5 改为 15.00/75.00、
--    deepseek-chat 改为 0.27/1.10）；新版 003 seed 已重写为 2026-08 官方价的 43 个模型
--    （新增 gpt-5.6 系 / deepseek-v4 系 / kimi-k3 / kimi-k2.6 / gemini-3 / doubao-seed-2.1 /
--    grok-4.5 / moonshot-v1-128k / magistral-* / mistral-small-4 等）。003 用
--    ON CONFLICT DO NOTHING，全新库会得到新价，已部署库则停在旧价——新旧库分叉。
-- 2) 本迁移把 model_pricing 全量 reconcile 到新 003 口径：43 个模型逐条
--    INSERT ... ON CONFLICT (model) DO UPDATE（存在则更新价格/供应商），幂等，
--    无论库里是旧 003 / 004 还是全新库，执行后都收敛到同一份官方价。
--    价格来源（均为官方页面，2026-08 核查；国内厂商人民币官方价 ÷7.2 折算 USD）：
--      moonshot-v1-128k  Moonshot 官方 ¥10/¥30 每 1M（输入/输出）
--                        https://platform.kimi.com/docs/pricing/chat-v1
--      magistral-medium  Mistral 官方 $2/$5      https://mistral.ai/pricing
--      magistral-small   Mistral 官方 $0.5/$1.5  https://mistral.ai/pricing
--      mistral-small-4   Mistral 官方 $0.15/$0.6 https://mistral.ai/pricing
--    不收录（留「未配置定价」）：
--      spark-4.0-ultra/pro  讯飞官方为分档套餐价（0.5~0.7 元/万 tokens，随套餐浮动且含限时折扣），
--                            无单一官方价，不虚构；
--      minimax-abab7        MiniMax 官方价目无此型号（现行 M3/M2.x 系列）；
--      llama-5              Meta 未正式发布，无官方托管定价。
-- 3) moonshot-v1-8k 按官方价拨正：¥2.00/¥10.00 每 1M tokens
--    （platform.kimi.com/docs/pricing/chat-v1，÷7.2 折算 = $0.28/$1.39），旧 seed 0.06/0.12 偏低。
-- =============================================

-- 全量 reconcile 到新 003 口径（幂等：存在则更新价格与供应商，不存在则插入）
INSERT INTO oxelia51.model_pricing (model, provider, prompt_price_usd, completion_price_usd) VALUES
  ('claude-fable-5',        'anthropic', 10.00, 50.00),
  ('claude-opus-5',         'anthropic', 5.00, 25.00),
  ('claude-sonnet-5',       'anthropic', 3.00, 15.00),
  ('claude-haiku-4-5',      'anthropic', 1.00, 5.00),
  ('claude-opus-4-6',       'anthropic', 5.00, 25.00),
  ('claude-opus-4-7',       'anthropic', 5.00, 25.00),
  ('claude-opus-4-8',       'anthropic', 5.00, 25.00),
  ('claude-sonnet-4-6',     'anthropic', 3.00, 15.00),
  ('gpt-5.6-sol',           'openai',    5.00, 30.00),
  ('gpt-5.6-terra',         'openai',    2.00, 12.00),
  ('gpt-5.6-luna',          'openai',    0.20, 1.20),
  ('gpt-5.5',               'openai',    5.00, 30.00),
  ('gpt-5',                 'openai',    1.25, 10.00),
  ('gpt-5-mini',            'openai',    0.25, 2.00),
  ('gpt-4o',                'openai',    2.50, 10.00),
  ('gpt-4o-mini',           'openai',    0.15, 0.60),
  ('gpt-4.1',               'openai',    2.00, 8.00),
  ('o3',                    'openai',    10.00, 40.00),
  ('o4-mini',               'openai',    1.10, 4.40),
  ('deepseek-v4-pro',       'deepseek',  0.42, 0.83),
  ('deepseek-v4-flash',     'deepseek',  0.14, 0.28),
  ('deepseek-chat',         'deepseek',  0.14, 0.28),
  ('deepseek-reasoner',     'deepseek',  0.14, 0.28),
  ('kimi-k3',               'moonshot',  2.78, 13.89),
  ('kimi-k2.6',             'moonshot',  0.95, 4.00),
  ('kimi-k2',               'moonshot',  0.60, 2.40),
  ('moonshot-v1-8k',        'moonshot',  0.28, 1.39),
  ('glm-5.2',               'zhipu',     1.11, 3.89),
  ('glm-4',                 'zhipu',     0.20, 0.60),
  ('qwen3.8max',            'qwen',      1.67, 5.00),
  ('qwen3.5-plus',          'qwen',      0.11, 0.67),
  ('qwen-plus',             'qwen',      0.40, 1.20),
  ('qwen-max',              'qwen',      1.60, 6.40),
  ('gemini-3-pro',          'gemini',    1.50, 9.00),
  ('gemini-3-flash',        'gemini',    1.50, 7.50),
  ('gemini-2.0-flash',      'gemini',    0.10, 0.40),
  ('gemini-2.5-pro',        'gemini',    1.25, 10.00),
  ('doubao-seed-2.1-pro',   'doubao',    0.83, 4.17),
  ('doubao-seed-2.1-turbo', 'doubao',    0.42, 2.08),
  ('doubao-pro-32k',        'doubao',    0.11, 0.28),
  ('hunyuan-turbo',         'hunyuan',   0.15, 0.30),
  ('hunyuan-hy3',           'hunyuan',   0.14, 0.56),
  ('minimax-text-01',       'minimax',   0.14, 1.11),
  ('grok-4.5',              'xai',       2.00, 6.00),
  ('mistral-large-3',       'mistral',   0.50, 1.50),
  ('moonshot-v1-128k',      'moonshot',  1.39, 4.17),
  ('magistral-medium',      'mistral',   2.00, 5.00),
  ('magistral-small',       'mistral',   0.50, 1.50),
  ('mistral-small-4',       'mistral',   0.15, 0.60)
ON CONFLICT (model) DO UPDATE
SET prompt_price_usd     = EXCLUDED.prompt_price_usd,
    completion_price_usd = EXCLUDED.completion_price_usd,
    provider             = EXCLUDED.provider,
    updated_at           = now();

-- spark-4.0 无官方价依据，从 003 seed 移除并撤出已部署库（云平台显示「未配置定价」）
DELETE FROM oxelia51.model_pricing WHERE model = 'spark-4.0';
