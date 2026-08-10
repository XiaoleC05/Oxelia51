# CHANGELOG

**项目**：oxelia51.com | **起始**：2026-06-07 | **格式**：[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)

---

## v0.1.3（未发布）

### 已完成
- **多设备同步正式开放**：账户收口云平台、按事件去重合并、上传/下载游标修复
- **供应商目录新增 33 家第三方平台路由**（按各官方文档核实接入；未核实平台在目录中标注「未接入」）
- **支持自定义供应商**（设置/接入页自填 API 地址与协议，本地存储）
- **模型参考价目录**：补 4 个官方价（moonshot-v1-128k、magistral-medium/small、mistral-small-4），撤下 2 个无官方依据的星火条目
- **桌面端规范对齐**：输入聚焦光晕、最小字号等

---

## v4.0 — 2026-08-09（本地优先的个人 Token 记账本，P1–P4 完成）

### 已完成
- **P1 落地页+文档站**：落地页重构（主入口免费下载、弱化登录注册）、`/docs` 文档站、黑白红配色、更新日志页
- **P2 数据模型个人化**：`/app` 个人工作台（总览/项目/会话/分析/设置）、跨项目聚合、多维展示
- **P3 桌面应用（Tauri 2）**：`desktop/` 三平台（Windows/macOS/Linux），本地代理 + SQLite 本地优先、五屏界面（总览/项目/会话/告警/设置）、成本核算、预算告警、版本检查
- **P4 多设备同步**：云 sync API（`/api/sync/*`）+ 桌面端上传/下载按 event_id 合并；弱认证收尾（登录用途说明）
- 设计文档：[v4 产品设计](https://github.com/XiaoleC05/langfuse-token/blob/main/docs/superpowers/specs/2026-08-08-oxelia51-v4-design.md)

### 发布
- 桌面应用 **v0.1.0**（GitHub Release，三平台安装包/便携版）；下载页动态拉取

### 订正
- 项目/会话页已随导航调整移除（桌面现六屏：总览/接入/供应商/Agent/告警/设置）；P4 多设备同步随本次更新正式开放（账户收口云平台，按事件去重合并）。

---

## v3.0 (开发中) — 2026-07-26+

### 产品方向
- 基于 Langfuse (MIT) + Helicone 代理理念的 Token 用量监控平台
- 自研 Go 代理网关 + C++ 分析引擎
- 2 仓库模型：Oxelia51（部署入口）+ langfuse-token（Fork）

### 进度 (2026-07-27)
- [x] 本地 Docker Compose 部署 Langfuse，验证数据链路
- [x] Fork langfuse/langfuse → XiaoleC05/langfuse-token
- [x] proxy-gateway/ Go 模块骨架（12 文件，~2000 行规划）
- [x] analytics/ C++ 目录骨架（~3000 行规划）
- [x] 全部文档重组：6 份编号文档 + CHANGELOG + dev 归档
- [ ] Go 代理网关核心实现（转发 + Token 解析 + ClickHouse 写入）
- [ ] C++ 分析引擎（聚合 + 定价 + 告警）
- [ ] Langfuse 前端定制

### 架构决策
- 仓库从 4 缩减为 2（Oxelia51 + langfuse-token）
- 用户部署一条命令：`git clone` + `docker compose up -d`
- 服务器：阿里云 2C2G（入口 + Go 代理）+ 腾讯云 4C4G（Langfuse + ClickHouse）

---

## [v2.4.0] — 2026-07-25

### Removed
- 移除 SuperRead、AIHelper、AgentCanvas 三个旧工具
- 移除 RemoteShell、MusicBox、CS2Lab
- DormGuard 精简：移除 QQ 机器人告警、定时调度、告警规则/日志，仅保留电量显示

### Changed
- 在线工具从 6 个精简为 3 个（DormGuard、SecretStore、SmartKB）
- 更新部署文档、架构文档、README、CLAUDE.md 工具列表

---

## [v2.3.1] — 2026-07-15

### Added
- SmartKB 知识库：108 文档 444 片段，pgvector + PG16

### Changed
- 首页重构：AI 协作时间线 + Bug 案例卡片 + 统计数据栏
- 全站品牌色：紫色 → 暖橙 `#c8553d`
- AGENTS.md v2.2：4-agent 模型

### Fixed
- 首页亮/暗模式颜色
- 导航栏移动端适配

### Bug 修复
- **#009** pgvector PG16/PG18 库版本冲突 — PG16 容器装 apk 的 PG18 版 vector.so，主机下载 tarball → docker cp → 编译 PG16 版本 ([`22a6a65`](https://github.com/XiaoleC05/SuperRead/commit/22a6a65))
- **#008** DormGuard 生产崩溃（258,000+ 次重启）— systemd 错误指向 Go binary，应为 Python uvicorn

---

## [v2.3] — 2026-07-11

### Added
- 全站 SEO meta/OG/JSON-LD、移动端汉堡菜单、ErrorBoundary
- 导航栏重构、页脚备案

### Changed
- 智能体模型 4-agent（Claude Code + Qoder + Trae Work + Codex）
- 迁移 011_login_logs

### Bug 修复
- **#007** SSE type 字段大小写不匹配 — 后端 `"type":"Token"` vs 前端 `event.type === 'token'`，统一小写蛇形 ([`a7b8c9d`](https://github.com/XiaoleC05/Oxelia51/commit/a7b8c9d))
- **#006** 前端尖括号未转义致 JSX 白屏 — DOMPurify 净化后渲染 ([`f6a7b8c`](https://github.com/XiaoleC05/Oxelia51/commit/f6a7b8c))

---

## [v2.2] — 2026-07-11

### Added
- 腾讯云服务器上线：health-server + UFW
- 双服务器监控
- DormGuard Python → Go+Gin

### Bug 修复
- **#005** Nginx 405 Webhook — `/api/tools/` location 未允许 POST ([`e5f6a7b`](https://github.com/XiaoleC05/Oxelia51/commit/e5f6a7b))

---

## [v2.1] — 2026-07-09

### Added
- 6 个在线工具：SuperRead / MusicBox / CS2Lab / AIHelper / AgentCanvas / SecretStore
- Gateway Header 统一

### Security
- REV-06 P0 修复：鉴权后门、CORS 加固、凭证串用、越权
- REV-06 P1 加固：SSRF 白名单、错误脱敏、API Key 隐藏

---

## [v2.0] — 2026-07-08

### Added
- 5-agent 多智能体模型
- account_id 账号体系
- DormGuard QQ 机器人（NapCat Docker）
- 服务器资源监控面板
- 全站视觉系统：PageLoader + Canvas 星空 + 全局毛玻璃

### Bug 修复
- **#002** SmartKB 文档扫描漏当天数据 — `ModTime().Before(today)` 排除当天文件，加 1 秒容差 ([`b2c3d4e`](https://github.com/XiaoleC05/Oxelia51/commit/b2c3d4e))

---

## [v1.1] — 2026-07-05

### Added
- API 网关：`/api/tools/:slug/proxy/*path`
- 邮箱验证 + 密码重置 + JWT 认证体系
- 限流、管理员种子、工具注册机制
- 落地页 + 工具目录 + 博客 + 管理后台

---

## [v1.0] — 2026-06-07

### Added
- 项目初始化：Go (Gin) + React (Vite)
- Docker Compose：PostgreSQL 17 + Redis 7
- 用户注册/登录：bcrypt + JWT
- 工具管理 API (CRUD)
