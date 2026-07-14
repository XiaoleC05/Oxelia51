-- 生产首次部署：在线工具 + 作品集（契约 v1.1）
-- 由 deploy/apply-release.sh 在 PostgreSQL 就绪后执行

INSERT INTO tools (slug, name, description, user_accessible, online_capable, status, internal_api_base, github_repo, release_url)
VALUES
  ('dormguard', 'DormGuard', '西华大学宿舍电费余额监控', TRUE, TRUE, 'enabled', 'http://127.0.0.1:8000', 'XiaoleC05/DormGuard', 'https://github.com/XiaoleC05/DormGuard/releases'),
  ('superread', 'SuperRead', 'RSS 订阅与摘要简报', TRUE, TRUE, 'enabled', 'http://127.0.0.1:8002', 'XiaoleC05/SuperRead', 'https://github.com/XiaoleC05/SuperRead/releases'),
  ('musicbox', 'MusicBox', '音乐聚合播放', FALSE, TRUE, 'enabled', 'http://127.0.0.1:8003', 'XiaoleC05/MusicBox', 'https://github.com/XiaoleC05/MusicBox/releases'),
  ('cs2lab', 'CS2Lab', 'CS2 道具教学与练习', FALSE, TRUE, 'enabled', 'http://127.0.0.1:8001', 'XiaoleC05/CS2Lab', 'https://github.com/XiaoleC05/CS2Lab/releases'),
  ('aihelper', 'AIHelper', '写作辅助', TRUE, TRUE, 'enabled', 'http://127.0.0.1:8004', 'XiaoleC05/AIHelper', 'https://github.com/XiaoleC05/AIHelper/releases'),
  ('agentcanvas', 'AgentCanvas', '可视化工作流', TRUE, TRUE, 'enabled', 'http://127.0.0.1:8005', 'XiaoleC05/AgentCanvas', 'https://github.com/XiaoleC05/AgentCanvas/releases'),
  ('secretstore', 'SecretStore', '加密存储 API 密钥、密码等敏感信息', TRUE, TRUE, 'enabled', 'http://127.0.0.1:8006', 'XiaoleC05/SecretStore', 'https://github.com/XiaoleC05/SecretStore/releases'),
  ('smartkb', 'SmartKB', '项目知识库智能体—自然语言搜索文档与代码', TRUE, TRUE, 'enabled', 'http://127.0.0.1:8007', 'XiaoleC05/SmartKB', 'https://github.com/XiaoleC05/SmartKB/releases')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  user_accessible = EXCLUDED.user_accessible,
  online_capable = EXCLUDED.online_capable,
  github_repo = EXCLUDED.github_repo,
  release_url = EXCLUDED.release_url,
  -- 注意：新增工具时必须同步更新此 IN 列表，否则 internal_api_base 不会被更新
  internal_api_base = CASE
    WHEN EXCLUDED.slug IN ('dormguard', 'superread', 'musicbox', 'cs2lab', 'aihelper', 'agentcanvas', 'secretstore', 'smartkb') THEN EXCLUDED.internal_api_base
    ELSE tools.internal_api_base
  END,
  updated_at = NOW();

INSERT INTO portfolio_items (slug, name, description, github_repo, source_dir, linked_tool_slug)
VALUES
  ('oxelia51', 'Oxelia51', '统一在线工具平台', 'XiaoleC05/Oxelia51', 'Oxelia51', NULL),
  ('dormguard', 'DormGuard', '西华大学宿舍电费余额监控', 'XiaoleC05/DormGuard', 'DormGuard', 'dormguard'),
  ('superread', 'SuperRead', 'RSS 订阅与 AI 简报', 'XiaoleC05/SuperRead', 'SuperRead', 'superread'),
  ('musicbox', 'MusicBox', '音乐聚合播放', 'XiaoleC05/MusicBox', 'MusicBox', 'musicbox'),
  ('cs2lab', 'CS2Lab', 'CS2 道具教学与练习', 'XiaoleC05/CS2Lab', 'CS2Lab', 'cs2lab'),
  ('aihelper', 'AIHelper', '提示词助手', 'XiaoleC05/AIHelper', 'AIHelper', 'aihelper'),
  ('agentcanvas', 'AgentCanvas', 'Agent 可视化画布', 'XiaoleC05/AgentCanvas', 'AgentCanvas', 'agentcanvas'),
  ('smartkb', 'SmartKB', '项目知识库智能体', 'XiaoleC05/SmartKB', 'SmartKB', 'smartkb'),
  ('xiaolec05-github-io', 'XiaoleC05.github.io', '个人网站与作品集', 'XiaoleC05/XiaoleC05.github.io', 'XiaoleC05.github.io', NULL)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  github_repo = EXCLUDED.github_repo,
  source_dir = EXCLUDED.source_dir,
  linked_tool_slug = EXCLUDED.linked_tool_slug;
