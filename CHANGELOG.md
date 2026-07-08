# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [v2.1] — 2026-07-09

### Added

- **6 个在线工具上线**：SuperRead（RSS + AI 简报）、MusicBox（音乐聚合）、CS2Lab（道具教学）、AIHelper（提示词助手）、AgentCanvas（可视化画布）、SecretStore（加密保险箱）
- **Gateway Header 统一**（GW-FIX）：proxy.go 同时发送 X-User-Id/X-Username/X-Role 短 header 与 X-Oxelia51-* 长 header
- **REV-06 审查**：Trae Work 全量审查 6 工具 + 平台代码，输出 9 P0 + 29 P1 + 27 P2 发现

### Changed

- 前端智能体 Qoder Wake 更名为 Hermes（AGENTS.md、README、CHANGELOG、.agents 全部同步）
- README.md 合并中英文为中文正式版，新增 CHANGELOG.md
- 5-agent 模型落地：Codex（架构）→ Cursor（后端）/ Hermes（前端）/ Qoder（QA）/ Trae Work（审查）

### Fixed

- REV-06 P0 全量修复：鉴权后门移除、CORS 加固、MusicBox 凭证串用、SecretStore Combo 越权、CS2Lab 测试降级、AIHelper Authorization 缺失
- REV-06 P1 安全加固：SSRF 白名单、错误脱敏、API Key 隐藏、响应体限制、AI 摘要闭环


## [v2.0] — 2026-07-08

### Added

- **5-agent 多智能体协作模型**：Codex（架构）、Cursor（后端）、Hermes（前端）、Qoder（QA 与部署）、Trae Work（审查与知识），详见 `AGENTS.md` v2.0
- **account_id 账号体系**：`username` 拆分为不可变 `account_id` + 可修改显示名；新增 `PATCH /api/auth/profile` 修改个人资料接口
- **友情链接页 `/friends`**：网格卡片布局，移动端单列
- **个人资料页 `/profile`**：读取用户信息，支持修改显示名
- **DormGuard QQ 机器人**：QQ Bot 已连接上线，通过 NapCat Docker 容器对接
- **服务器资源监控面板**：管理端新增服务器 CPU、内存、磁盘监控 Tab，含刷新按钮
- **全站视觉系统**：
  - PageLoader 四变体（split / ink / mist / light），按路由分配，统一 1.0s 动画时长
  - 深空星空背景（canvas 粒子）
  - 全局毛玻璃效果（`backdrop-filter`）
  - 亮色页脚
- **DormGuard 配置面板**：工具壳内可配置 `CRAWLER_ALERT_THRESHOLD` 等参数
- **搜索 API**：`GET /api/search?q=xxx`，全文搜索博客文章

### Changed

- AGENTS.md 从 v1.0 重构为 v2.0，Agent 模型从 3-agent 升级为 5-agent
- 登录页支持 `account` 字段（可输入 account_id 或邮箱）
- 注册页新增 `account_id` 必填字段
- 前端构建 Node.js 版本从 20 升级至 24

### Fixed

- PatchProfile 空字符串 username 校验（`TrimSpace` + 400 拦截）
- 移动端导航栏用户名换行 + 紧凑高度
- 移动端段落对齐：`text-align: justify`，`letter-spacing: 0`
- 管理端弹窗内容溢出滚动 + 服务器刷新按钮
- 移动端 tap 高亮残留
- CI Node.js 版本与本地对齐

### Removed

- 移除 MouseGlow 鼠标光晕（被星空背景替代）
- 移除 `chapter-num` 相关 class（所有页面已清理）
- 移除所有页面中面向访客的管理端技术细节文案

### Documentation

- `docs/01~04` 归档至 `docs/archive/`
- README 与 `.trae/rules/project_rules.md` 同步 v2.0 信息
- 新增 `docs/tools/secretstore-design.md`（SecretStore 设计文档）
- 新增 `docs/ui/` 下 UI-06 ~ UI-08 视觉升级报告
- 新增 REV-05 审查报告

---

## [v1.1] — 2026-07-05

### Added

- **API 网关**：`internal/gateway/` 动态代理，`/api/tools/:slug/proxy/*path` 转发至工具后端
- **邮箱验证流程**：注册 → 验证邮件 24h 有效 → 验证后可登录
- **密码重置**：忘记密码 → 邮件重置链接 → 新密码
- **JWT 认证体系**：access 7 天 / refresh 30 天；logout 黑名单；Redis 存储 refresh token
- **限流**：注册（同 IP ≤3/小时）、重发验证（同邮箱 ≤1/天）、忘记密码（同邮箱 ≤1/天）、登录失败（同 IP ≤10/15min）
- **管理员种子**：唯一管理员 `oxelia51`，首次生成密码写桌面文件
- **工具注册机制**：`tools` 表扩展、manifest 扫描 API、`oxelia51.tool.json` 规范
- **平台落地页**：首页头图轮播、内容区块、渐变页脚
- **工具目录 `/tools`**：列表、详情、状态徽章（已开放 / 暂未开放 / 已下线）
- **作品集 `/portfolio`**：`portfolio_items` 表，后台可覆盖名称与描述
- **博客系统**：`/blog` 列表 + `/blog/:id` 文章详情；管理端文章 CRUD
- **关于页 `/about`**
- **管理后台**：工具元数据增删改查、用户列表、作品集管理
- **前端工具壳**：`/tools/:slug` 动态加载 `ToolNameTool.jsx`，通过 API 模块 proxy 调用
- **6 个工具 manifest**：DormGuard、SuperRead、MusicBox、CS2Lab、AIHelper、AgentCanvas
- **DormGuard 网关模式**：`OXELIA_GATEWAY_MODE` 信任网关身份头，CORS 允许 `:5173`

### Changed

- 用户模型从单表扩展为完整认证体系（email、email_verified、role）
- 管理 API 资源标识统一为 `slug`（原 `:id`）
- `user_accessible` 字段替代 `visitor_visible`（语义纠正）
- DormGuard 数据库独立 MySQL，不合并至平台 PostgreSQL（ADR-007）

### Fixed

- 平台 `:8080` 仅本地/SSH 访问，公网仅 DormGuard（阶段 0~1）
- `email` 字段 UNIQUE 约束 + 409 `EMAIL_TAKEN` 错误码
- JWT 生命周期、refresh token 轮换机制
- CORS 配置追加 `:5173`（本地开发）
- Nginx 反向代理缓存禁用 + Authorization 头透传

### Deployment

- GitHub Actions 自动部署工作流（`ci-deploy.sh` → 服务器 `git pull` → 重启服务）
- Webhook 推送 release 分支触发自动部署
- systemd 服务文件（oxelia51-backend）
- Nginx 配置同步
- 生产 cutover 脚本、全栈诊断脚本

---

## [v1.0] — 2026-06-07

### Added

- **项目初始化**：Go 后端骨架（Gin）+ React 前端骨架（Vite）
- **Docker Compose**：PostgreSQL 17 + Redis 7
- **用户注册/登录**：bcrypt 密码哈希 + JWT 令牌签发
- **JWT 认证中间件**：`Authorization: Bearer <token>` 保护路由
- **当前用户接口**：`GET /api/users/me`
- **工具管理 API**：列表 / 详情 / 创建 / 更新 / 删除
- **前端导航栏**：根据登录状态切换显示（登录/注册 vs 用户名/退出）
- **前端注册/登录页**：React Router 路由 + localStorage token 存储
- **健康检查**：`GET /api/health`
- **项目文档**：README 中英文双版、ADR-001 技术选型决策记录
