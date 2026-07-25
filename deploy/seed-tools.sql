-- 生产首次部署：在线工具 + 作品集（契约 v1.1）
-- 由 deploy/apply-release.sh 在 PostgreSQL 就绪后执行

INSERT INTO tools (slug, name, description, user_accessible, online_capable, status, internal_api_base, github_repo, release_url)
VALUES
  ('dormguard', 'DormGuard', '西华大学宿舍电费余额监控', TRUE, TRUE, 'enabled', 'http://127.0.0.1:8000', 'XiaoleC05/DormGuard', 'https://github.com/XiaoleC05/DormGuard/releases'),
  ('secretstore', 'SecretStore', '加密存储 API 密钥、密码等敏感信息', TRUE, TRUE, 'enabled', 'http://127.0.0.1:8006', 'XiaoleC05/SecretStore', 'https://github.com/XiaoleC05/SecretStore/releases'),
  ('smartkb', 'SmartKB', '项目知识库智能体—自然语言搜索文档与代码', TRUE, TRUE, 'enabled', 'http://127.0.0.1:8007', 'XiaoleC05/SmartKB', 'https://github.com/XiaoleC05/SmartKB/releases')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  user_accessible = EXCLUDED.user_accessible,
  online_capable = EXCLUDED.online_capable,
  github_repo = EXCLUDED.github_repo,
  release_url = EXCLUDED.release_url,
  internal_api_base = CASE
    WHEN EXCLUDED.slug IN ('dormguard', 'secretstore', 'smartkb') THEN EXCLUDED.internal_api_base
    ELSE tools.internal_api_base
  END,
  updated_at = NOW();

INSERT INTO portfolio_items (slug, name, description, github_repo, source_dir, linked_tool_slug)
VALUES
  ('oxelia51', 'Oxelia51', '统一在线工具平台', 'XiaoleC05/Oxelia51', 'Oxelia51', NULL),
  ('dormguard', 'DormGuard', '西华大学宿舍电费余额监控', 'XiaoleC05/DormGuard', 'DormGuard', 'dormguard'),
  ('smartkb', 'SmartKB', '项目知识库智能体', 'XiaoleC05/SmartKB', 'SmartKB', 'smartkb'),
  ('xiaolec05-github-io', 'XiaoleC05.github.io', '个人网站与作品集', 'XiaoleC05/XiaoleC05.github.io', 'XiaoleC05.github.io', NULL)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  github_repo = EXCLUDED.github_repo,
  source_dir = EXCLUDED.source_dir,
  linked_tool_slug = EXCLUDED.linked_tool_slug;
