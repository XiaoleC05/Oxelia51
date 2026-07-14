# SuperRead Webhook 高并发下重复处理同一篇文章

- **场景**：RSS 源一次性推送 50+ 篇新文章时，数据库中出现重复摘要记录
- **发现 Agent**：Claude Code
- **修复 Agent**：Qoder
- **根因**：`backend/internal/superread/webhook.go` 接收 webhook 后直接处理文章，未对文章 URL 做去重检查；并发 worker 同时拉取了同一篇文章
- **修复方案**：在处理函数入口加 `SELECT 1 FROM articles WHERE url = $1` 检查，已存在则直接返回 200；同时对文章 URL 字段加 `UNIQUE` 约束作为兜底
- **结果**：重复推送不再产生重复记录；UNIQUE 约束触发时返回 409 并记录 warning
- **提交**：`https://github.com/XiaoleC05/Oxelia51/commit/d4e5f6a`
- **日期**：2026-07-06
