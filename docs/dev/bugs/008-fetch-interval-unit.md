# RSS 抓取间隔单位错误导致每秒拉取一次

- **场景**：SuperRead 配置「每 30 分钟拉取一次」后，服务器日志显示每秒都在调用 RSS 源接口，源站点开始限流
- **发现 Agent**：Claude Code
- **修复 Agent**：Qoder
- **根因**：`backend/internal/superread/scheduler.go` 读取 `FETCH_INTERVAL` 环境变量后直接传入 `time.Duration(fetchInterval)`，而 `time.Duration` 的单位是纳秒，30 被解释为 30ns
- **修复方案**：显式乘以时间单位 `time.Duration(fetchInterval) * time.Minute`；同时在配置加载时校验范围（5–1440 分钟），越界则使用默认值 30 并记录 warning
- **结果**：拉取间隔恢复正常；RSS 源限流解除；配置错误时能从日志快速发现
- **提交**：`https://github.com/XiaoleC05/Oxelia51/commit/b8c9d0e`
- **日期**：2026-07-10
