-- 模型定价扩充（per 1M tokens，USD），ON CONFLICT 跳过已存在
INSERT INTO oxelia51.model_pricing (model, provider, prompt_price_usd, completion_price_usd) VALUES
  ('claude-opus-5',        'anthropic', 15.00, 75.00),
  ('claude-sonnet-5',      'anthropic', 3.00, 15.00),
  ('claude-haiku-4-5',     'anthropic', 1.00, 5.00),
  ('gpt-4o',               'openai',    2.50, 10.00),
  ('gpt-4o-mini',          'openai',    0.15, 0.60),
  ('gpt-4.1',              'openai',    2.00, 8.00),
  ('o3',                   'openai',    2.00, 8.00),
  ('deepseek-chat',        'deepseek',  0.27, 1.10),
  ('deepseek-reasoner',    'deepseek',  0.55, 2.19),
  ('qwen-plus',            'qwen',      0.40, 1.20),
  ('qwen-max',             'qwen',      1.60, 6.40),
  ('gemini-2.0-flash',     'gemini',    0.10, 0.40),
  ('gemini-2.5-pro',       'gemini',    1.25, 10.00),
  ('glm-4',                'zhipu',     0.20, 0.60),
  ('kimi-k2',              'moonshot',  1.15, 9.90),
  ('moonshot-v1-8k',       'moonshot',  0.06, 0.12),
  ('doubao-pro-32k',       'doubao',    0.80, 2.00),
  ('hunyuan-turbo',        'hunyuan',   0.15, 0.30),
  ('spark-4.0',            'spark',     0.20, 0.40),
  ('minimax-text-01',      'minimax',   0.15, 0.30)
ON CONFLICT (model) DO NOTHING;
