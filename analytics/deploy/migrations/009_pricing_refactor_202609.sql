-- =============================================
-- 009 定价数据重构（2026-09）
--
-- why：
-- 1) 内置供应商已精简至 11 家（anthropic/openai/gemini/xai/zhipu/deepseek/qwen/
--    moonshot/doubao/hunyuan/minimax）。本迁移把 model_pricing 收敛到该口径：
--    删除 11 家以外（mistral、spark 等历史残留）及 11 家以内已退役/无官方价的模型，
--    再按 2026-09-02 核实的官方价全量 upsert。
-- 2) 重大变化（用户可见，需关注）：
--      - deepseek-chat / deepseek-reasoner 官方定价页已不再列出（被 deepseek-v4-flash /
--        v4-pro 取代），删除；历史事件中的旧模型名将显示「未配置定价」。
--      - kimi-k2.5、moonshot-v1-8k/128k 于 2026-08-31 官方下线，删除。
--      - qwen3.8max 官方更名为 qwen3.8-max（连字符），旧 key 删除。
-- 3) 口径：USD / 1M tokens，官方标准层（非 Batch / 非 Priority / 非促销特殊层）；
--    国内厂商人民币官方价 ÷7.2 折算。仅收录官方在售且有官方价的模型，不虚构。
--    官方来源（2026-09-02 核实）：
--      anthropic  https://docs.anthropic.com/en/docs/about-claude/pricing（缓存写 1.25×、命中 0.1×）
--      openai     https://platform.openai.com/docs/pricing（Batch 5 折；gpt-5.6-sol 短上下文
--                 促销价至少到 2026-11-21，长上下文档 8/30；5.5/5.4 >272K 输入 2×/1.5×）
--      gemini     https://ai.google.dev/gemini-api/docs/pricing（Batch/Flex 5 折、Priority 1.8×；
--                 3.7/3.6-flash 促销价 2027-01-01 起恢复 1.50/7.50）
--      xai        https://docs.x.ai/docs/models + /pricing（≥200K prompt 档位更高，见官网）
--      zhipu      https://docs.z.ai/guides/overview/pricing（国际站 USD；bigmodel.cn 国内站
--                 CNY 口径不同，以国际站为准）
--      deepseek   https://api-docs.deepseek.com/quick_start/pricing（高峰价、缓存未命中；
--                 缓存命中 0.014/0.044；非高峰全部半价）
--      qwen       https://help.aliyun.com/zh/model-studio/model-pricing（北京站 CNY ÷7.2；
--                 多档按上下文长度，此处取最低档）
--      moonshot   https://platform.kimi.com/docs/pricing（官方 CNY ÷7.2）
--      doubao     https://www.volcengine.com/docs/82379/1099320（官方 CNY ÷7.2）
--      hunyuan    https://cloud.tencent.com/document/product/1823/130055（TokenHub 官方 CNY ÷7.2；
--                 官方模型名 Hy4 preview / Hy3，key 沿用 hunyuan-hy4-preview / hunyuan-hy3 风格）
--      minimax    https://platform.minimax.io/docs/guides/pricing-paygo（官方 USD）
-- 4) 与桌面端 proxy-gateway defaultPricing / pricingCatalog 同源（核实日期、价格一致），
--    共有模型价格有 TestDefaultPricingMatchesSeed 防漂移。
-- =============================================

-- 先删后插，幂等收敛：删除 11 家以外的供应商，以及 11 家以内不在新口径清单中的模型
-- （deepseek-chat/reasoner、kimi-k2.5、moonshot-v1 系、glm-4、qwen3.8max、qwen-max、
--  gemini-2.0-flash、gemini-3-pro、gemini-3-flash、hunyuan-turbo、minimax-text-01、mistral 系等）。
DELETE FROM oxelia51.model_pricing
WHERE provider NOT IN ('anthropic','openai','gemini','xai','zhipu','deepseek',
                       'qwen','moonshot','doubao','hunyuan','minimax')
   OR model NOT IN (
      -- anthropic
      'claude-fable-5','claude-opus-5','claude-opus-4-8','claude-opus-4-6',
      'claude-sonnet-5','claude-sonnet-4-6','claude-haiku-4-5',
      -- openai
      'gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna','gpt-5.5','gpt-5.4',
      'gpt-5.4-mini','gpt-5.4-nano','gpt-5.2','gpt-5','gpt-5-mini',
      'gpt-4o','gpt-4o-mini','gpt-4.1','o3','o4-mini',
      -- gemini
      'gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite',
      'gemini-3.1-pro-preview','gemini-2.5-pro','gemini-2.5-flash','gemini-2.5-flash-lite',
      -- xai
      'grok-4.6','grok-4.5','grok-4.3','grok-build-0.1',
      -- zhipu
      'glm-5.3','glm-5.2','glm-5.1','glm-5','glm-4.7','glm-4.7-flashx',
      'glm-4.6','glm-4.5','glm-4.5-air',
      -- deepseek
      'deepseek-v4-flash','deepseek-v4-pro',
      -- qwen
      'qwen3.8-max','qwen3.7-max','qwen3-max','qwen3.7-plus','qwen3.5-plus',
      'qwen-plus','qwen3.8-flash','qwen3.7-flash','qwen-long','qwen3-coder-plus',
      -- moonshot
      'kimi-k3','kimi-k2.7-code','kimi-k2.6',
      -- doubao
      'doubao-seed-2.1-pro','doubao-seed-2.1-turbo','doubao-seed-2.0-pro',
      'doubao-seed-1.6','doubao-seed-1.6-flash','doubao-1.5-pro-32k',
      -- hunyuan
      'hunyuan-hy4-preview','hunyuan-hy3','hunyuan-a13b',
      -- minimax
      'MiniMax-M3','MiniMax-M2.7','MiniMax-M2.7-highspeed','MiniMax-M2'
   );

-- 全量 upsert 新口径（幂等：存在则更新价格与供应商，不存在则插入）
INSERT INTO oxelia51.model_pricing (model, provider, prompt_price_usd, completion_price_usd) VALUES
  -- anthropic（7）
  ('claude-fable-5',           'anthropic', 10.00, 50.00),
  ('claude-opus-5',            'anthropic', 5.00,  25.00),
  ('claude-opus-4-8',          'anthropic', 5.00,  25.00),
  ('claude-opus-4-6',          'anthropic', 5.00,  25.00),
  ('claude-sonnet-5',          'anthropic', 2.00,  10.00),
  ('claude-sonnet-4-6',        'anthropic', 3.00,  15.00),
  ('claude-haiku-4-5',         'anthropic', 1.00,  5.00),
  -- openai（15）
  ('gpt-5.6-sol',              'openai',    4.00,  20.00),
  ('gpt-5.6-terra',            'openai',    2.00,  12.00),
  ('gpt-5.6-luna',             'openai',    0.20,  1.20),
  ('gpt-5.5',                  'openai',    5.00,  30.00),
  ('gpt-5.4',                  'openai',    2.50,  15.00),
  ('gpt-5.4-mini',             'openai',    0.75,  4.50),
  ('gpt-5.4-nano',             'openai',    0.20,  1.25),
  ('gpt-5.2',                  'openai',    1.75,  14.00),
  ('gpt-5',                    'openai',    1.25,  10.00),
  ('gpt-5-mini',               'openai',    0.25,  2.00),
  ('gpt-4o',                   'openai',    2.50,  10.00),
  ('gpt-4o-mini',              'openai',    0.15,  0.60),
  ('gpt-4.1',                  'openai',    2.00,  8.00),
  ('o3',                       'openai',    2.00,  8.00),
  ('o4-mini',                  'openai',    1.10,  4.40),
  -- gemini（8）
  ('gemini-3.7-flash',         'gemini',    0.75,  3.75),
  ('gemini-3.6-flash',         'gemini',    0.75,  3.75),
  ('gemini-3.5-flash',         'gemini',    1.50,  9.00),
  ('gemini-3.5-flash-lite',    'gemini',    0.30,  2.50),
  ('gemini-3.1-pro-preview',   'gemini',    2.00,  12.00),
  ('gemini-2.5-pro',           'gemini',    1.25,  10.00),
  ('gemini-2.5-flash',         'gemini',    0.30,  2.50),
  ('gemini-2.5-flash-lite',    'gemini',    0.10,  0.40),
  -- xai（4）
  ('grok-4.6',                 'xai',       2.00,  6.00),
  ('grok-4.5',                 'xai',       2.00,  6.00),
  ('grok-4.3',                 'xai',       1.25,  2.50),
  ('grok-build-0.1',           'xai',       1.00,  2.00),
  -- zhipu（9）
  ('glm-5.3',                  'zhipu',     1.40,  4.40),
  ('glm-5.2',                  'zhipu',     1.40,  4.40),
  ('glm-5.1',                  'zhipu',     1.40,  4.40),
  ('glm-5',                    'zhipu',     1.00,  3.20),
  ('glm-4.7',                  'zhipu',     0.60,  2.20),
  ('glm-4.7-flashx',           'zhipu',     0.07,  0.40),
  ('glm-4.6',                  'zhipu',     0.60,  2.20),
  ('glm-4.5',                  'zhipu',     0.60,  2.20),
  ('glm-4.5-air',              'zhipu',     0.20,  1.10),
  -- deepseek（2；官方高峰价、缓存未命中，非高峰半价）
  ('deepseek-v4-flash',        'deepseek',  0.44,  1.32),
  ('deepseek-v4-pro',          'deepseek',  1.32,  3.96),
  -- qwen（10；北京站 CNY ÷7.2，取最低上下文档）
  ('qwen3.8-max',              'qwen',      1.67,  5.00),
  ('qwen3.7-max',              'qwen',      1.67,  5.00),
  ('qwen3-max',                'qwen',      0.35,  1.39),
  ('qwen3.7-plus',             'qwen',      0.28,  1.11),
  ('qwen3.5-plus',             'qwen',      0.11,  0.67),
  ('qwen-plus',                'qwen',      0.11,  0.28),
  ('qwen3.8-flash',            'qwen',      0.11,  0.38),
  ('qwen3.7-flash',            'qwen',      0.03,  0.11),
  ('qwen-long',                'qwen',      0.07,  0.28),
  ('qwen3-coder-plus',         'qwen',      0.56,  2.22),
  -- moonshot（3；官方 CNY ÷7.2）
  ('kimi-k3',                  'moonshot',  2.78,  13.89),
  ('kimi-k2.7-code',           'moonshot',  0.90,  3.75),
  ('kimi-k2.6',                'moonshot',  0.90,  3.75),
  -- doubao（6；官方 CNY ÷7.2）
  ('doubao-seed-2.1-pro',      'doubao',    0.83,  4.17),
  ('doubao-seed-2.1-turbo',    'doubao',    0.42,  2.08),
  ('doubao-seed-2.0-pro',      'doubao',    0.44,  2.22),
  ('doubao-seed-1.6',          'doubao',    0.11,  1.11),
  ('doubao-seed-1.6-flash',    'doubao',    0.02,  0.21),
  ('doubao-1.5-pro-32k',       'doubao',    0.11,  0.28),
  -- hunyuan（3；TokenHub 官方名 Hy4 preview / Hy3，官方 CNY ÷7.2）
  ('hunyuan-hy4-preview',      'hunyuan',   0.83,  2.50),
  ('hunyuan-hy3',              'hunyuan',   0.14,  0.56),
  ('hunyuan-a13b',             'hunyuan',   0.07,  0.28),
  -- minimax（4；官方 USD）
  ('MiniMax-M3',               'minimax',   0.30,  1.20),
  ('MiniMax-M2.7',             'minimax',   0.30,  1.20),
  ('MiniMax-M2.7-highspeed',   'minimax',   0.60,  2.40),
  ('MiniMax-M2',               'minimax',   0.30,  1.20)
ON CONFLICT (model) DO UPDATE
SET prompt_price_usd     = EXCLUDED.prompt_price_usd,
    completion_price_usd = EXCLUDED.completion_price_usd,
    provider             = EXCLUDED.provider,
    updated_at           = now();
