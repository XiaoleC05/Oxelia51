# SmartKB pgvector 安装——PG16/PG18 库版本冲突

- **场景**：SmartKB 首次部署，需要在 PostgreSQL Docker 中安装 pgvector 扩展
- **发现 Agent**：Claude Code
- **修复 Agent**：Claude Code
- **根因**：Docker 容器运行 PG16，但 `apk add postgresql-pgvector` 安装到了 PG18 目录。PG16 的 `$libdir` 找不到 vector.so。手动编译时又遇到 clang-21 缺失。GitHub clone 被墙。复杂的嵌套转义让 RemoteShell 多次失败
- **修复方案**：在主机下载 tarball → `docker cp` 传入容器 → 解决 clang 符号链接 → 编译 PG16 版本 → `CREATE EXTENSION vector`
- **结果**：pgvector 成功安装，108 文档 444 片段被索引
- **提交**：[`22a6a65`](https://github.com/XiaoleC05/SuperRead/commit/22a6a65)
- **日期**：2026-07-14
