# SmartKB 文档摄入按日期扫描漏掉当天数据

- **场景**：部署 SmartKB 后执行 `POST /api/smartkb/ingest`，发现当天新写的 Markdown 笔记未被向量化
- **发现 Agent**：Claude Code
- **修复 Agent**：Qoder
- **根因**：`backend/internal/smartkb/ingest.go` 中扫描目录时使用 `file.ModTime().Before(today)` 严格小于，导致当天 0 点之后修改的文件被排除
- **修复方案**：将比较改为 `file.ModTime().Before(today.Add(-1 * time.Second))`，即包含当天 00:00:00 起的所有文件；同时增加日志输出实际扫描到的文件数
- **结果**：当天新建的笔记能正常被向量化并进入检索；日志显示扫描数与目录实际文件数一致
- **提交**：`https://github.com/XiaoleC05/Oxelia51/commit/b2c3d4e`
- **日期**：2026-07-04
