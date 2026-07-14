# 简报生成时间戳未转换时区导致日期错位

- **场景**：SuperRead 每日简报在 UTC 0 点触发，北京时间凌晨 8 点查看时显示为「昨日简报」
- **发现 Agent**：Claude Code
- **修复 Agent**：Qoder
- **根因**：`backend/internal/superread/brief.go` 使用 `time.Now().Format("2006-01-02")` 直接取 UTC 时间，未按用户配置的 `APP_TIMEZONE` 转换
- **修复方案**：加载 `APP_TIMEZONE`（默认 Asia/Shanghai），使用 `time.Now().In(loc).Format("2006-01-02")` 生成简报日期；定时任务 cron 表达式也按相同时区调度
- **结果**：简报日期与用户所在地日期一致；cron 触发时间也按目标时区执行
- **提交**：`https://github.com/XiaoleC05/Oxelia51/commit/c3d4e5f`
- **日期**：2026-07-05
