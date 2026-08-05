-- 用户反馈表（前端反馈表单 → 后台管理列表）
CREATE TABLE IF NOT EXISTS oxelia51.feedback (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT,
  email TEXT NOT NULL,
  category TEXT NOT NULL,          -- feature | bug | other
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | done
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON oxelia51.feedback (created_at DESC);
