# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [v2.3.1] — 2026-07-15

### Added

- **SmartKB 独立工具**：知识库检索，108 文档 444 片段已索引，基于 pgvector + PG16
- **第 9 个 Bug 案例**：pgvector PG16/PG18 库版本冲突

### Changed

- **首页重构（P2–P6）**：AI 协作时间线 + Bug 案例卡片 + 统计数据栏 + 分割线过渡
- **全站品牌色统一**：accent 从紫色 `#863bff` 迁移为暖橙 `#c8553d`
- **AGENTS.md v2.2**：更新智能体模型为 4-agent，补充 §7.1 字体约定

### Fixed

- 首页统计栏亮/暗模式颜色正确
- 导航栏移动端字体大小与安全区适配

### Documentation

- 全项目文档重构：`docs/` 分层为 `user/` `dev/` `superpowers/` `archive/` `ui/`
- 新增用户使用指南、工具简介、部署指南、工具 README 模板
- P7 全站体验审查 + P8 权限隔离审查 + P9 全平台安全审查
- Bug 案例 009，累计 9 个

---

## [v2.3] — 2026-07-11

### Added

- **全站前端优化**：SEO meta/OG/JSON-LD、移动端汉堡菜单、ErrorBoundary
- **关于开发者**：GET /api/developer/profile + PATCH /api/admin/developer/profile
- **导航栏重构**：新顺序首页→工具→作品→博客→关于开发者→友情链接
- **页脚备案**：ICP 备案 + 公安备案

### Changed

- 智能体模型 v2.1：4-agent（Claude Code + Qoder + Trae Work + Codex）
- SecretStore 首页「显示全部/隐藏全部」按钮，防布局跳动
- 友情链接替换为技术栈图标
- .gitignore 移除 docs/ 排除，文档全部入库（35 文件）
- 新增迁移 011_login_logs

### Fixed

- 导航切换页面空白（React Router Suspense fallback）
- SecretStore 模板切换抽动（ss-view-transition + min-height）
- 卡片 hover 动画幅度减小

---

## [v2.2] — 2026-07-11

### Added

- **腾讯云服务器**：初始化脚本、health-server 健康检查、UFW 防火墙
- **双服务器监控**：/api/admin/server-stats 新增 remote 字段
- **DormGuard Go 切换**：Python FastAPI → Go+Gin，role-based 权限控制
- **CS2Lab 地图扩展**：新增 de_cache、de_train，道具中文化
- **SecretStore 模板重设计**：8→7 种，新增模型厂商字段
- **开发者 API**：GET /api/developer/profile + PATCH /api/admin/developer/profile

### Changed

- 工具分流：SuperRead/MusicBox/AIHelper → 腾讯云
- user_accessible：AIHelper/SuperRead/AgentCanvas → TRUE

### Deployment

- 本地交叉编译（build-all-tools.bat）→ scp 二进制 → systemctl restart
- 服务器清理：删除 /opt/src/、/usr/local/go

---

## [v2.1] — 2026-07-09

### Added

- **6 个在线工具上线**：SuperRead / MusicBox / CS2Lab / AIHelper / AgentCanvas / SecretStore
- **Gateway Header 统一**（GW-FIX）：proxy.go 同时发送短 header 与长 header
- **REV-06 审查**：Trae Work 全量审查 6 工具 + 平台代码

### Changed

- 前端智能体 Qoder Wake 更名为 Hermes
- README.md 合并中英文为中文正式版
- 5-agent 模型落地

### Fixed

- REV-06 P0 全量修复：鉴权后门、CORS 加固、凭证串用、越权、测试降级
- REV-06 P1 安全加固：SSRF 白名单、错误脱敏、API Key 隐藏

---

## [v2.0] — 2026-07-08

### Added

- **5-agent 多智能体协作模型**：Codex/Cursor/Hermes/Qoder/Trae Work
- **account_id 账号体系**：username 拆分为不可变 account_id + 可修改显示名
- **友情链接页** `/friends`、**个人资料页** `/profile`
- **DormGuard QQ 机器人**：NapCat Docker 对接上线
- **服务器资源监控面板**：管理端 CPU/内存/磁盘监控
- **全站视觉系统**：PageLoader 四变体、Canvas 星空背景、全局毛玻璃效果
- **搜索 API**：`GET /api/search?q=xxx`

### Changed

- AGENTS.md v1.0→v2.0，Agent 模型 3-agent→5-agent
- 登录页/注册页支持 account_id
- Node.js 20→24

### Fixed

- PatchProfile 空字符串校验
- 移动端导航栏 + 段落对齐 + tap 高亮
- 管理端弹窗溢出 + 服务器刷新按钮
- CI Node.js 版本对齐

### Removed

- MouseGlow 鼠标光晕（被星空背景替代）
- chapter-num class（全页面清理）
- 管理端技术细节文案（对访客不可见）

### Documentation

- `docs/01~04` 归档至 `docs/archive/`
- README 与 project_rules 同步 v2.0
- 新增 secretstore-design.md、UI-06~08 报告、REV-05 审查报告

---

## [v1.1] — 2026-07-05

### Added

- **API 网关**：`/api/tools/:slug/proxy/*path` 动态代理
- **邮箱验证流程** + **密码重置** + **JWT 认证体系**（access 7d / refresh 30d）
- **限流**：注册、重发验证、忘记密码、登录失败独立计数
- **管理员种子**：唯一管理员 `oxelia51`
- **工具注册机制**：tools 表扩展、manifest 扫描
- **平台落地页** + **工具目录** + **作品集** + **博客系统** + **关于页** + **管理后台**
- **6 个工具 manifest**：DormGuard/SuperRead/MusicBox/CS2Lab/AIHelper/AgentCanvas

### Changed

- 用户模型扩展为完整认证体系
- 管理 API 资源标识统一为 `slug`
- `user_accessible` 替代 `visitor_visible`
- DormGuard 数据库独立（ADR-007）

### Fixed

- 平台 `:8080` 仅本地/SSH
- email UNIQUE + 409 EMAIL_TAKEN
- JWT 生命周期 + refresh token 轮换
- CORS 追加 `:5173`
- Nginx 反向代理缓存禁用 + Authorization 透传

### Deployment

- GitHub Actions 自动部署 + Webhook + systemd + Nginx

---

## [v1.0] — 2026-06-07

### Added

- 项目初始化：Go（Gin）+ React（Vite）
- Docker Compose：PostgreSQL 17 + Redis 7
- 用户注册/登录：bcrypt + JWT
- JWT 认证中间件 + 当前用户接口
- 工具管理 API（CRUD）
- 前端导航栏 + 注册/登录页
- 健康检查 + 项目文档
