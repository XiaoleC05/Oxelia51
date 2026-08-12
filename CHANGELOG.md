# CHANGELOG

**项目**：oxelia51.com | **起始**：2026-06-07 | **格式**：[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)

---

## v0.1.8 —（未发布）

### 已修复
- **Token 消耗计入缓存**：Anthropic 的 `input_tokens` 不含缓存（`cache_creation`/`cache_read` 与其不相交），此前缓存按计价倍数（写 1.25× / 读 0.1×）折算进 `prompt_tokens`，导致「Token 消耗」总量也是折算值（缓存读缩水 90%），与真实消耗不符。现 `total_tokens` 改存原始 token（含缓存 1×），`prompt_tokens` 仍存计价输入（成本口径不变），并新增缓存读/写细分列（本地 SQLite / 云 ClickHouse / 同步账本往返）

---

## v0.1.7 — 2026-08-13（已发布）

### 已新增
- **本地 Agent 检测**：接入页新增「已检测到的工具」，自动扫描本机已安装的 AI Agent（Claude Code / Codex / Cursor / Gemini CLI / Aider / OpenCode / Windsurf / Cline / Roo Code / Continue / GitHub Copilot / Augment Code），CLI 与 VS Code 插件显示版本号
- **模型价格表独立导航**：从设置页独立为顶部「模型价格」Tab，点击模型条目可直接编辑价格并保存到「模型定价」（影响成本计算）
- **复制地址按协议适配**：DeepSeek / 智谱等双协议供应商卡片新增「Anthropic」按钮，Claude Code 走 `/anthropic` 变体地址，无需手动加后缀；变体名单由后端单一数据源下发
- **清除本地数据**：设置页新增「清除本地数据」，一键清空本地用量账本（保留主题 / 定价 / 预算 / 自定义供应商等配置）
- **更新提示直达安装包**：发现新版本时横幅直接下载当前平台安装包（不再跳转到 release 页）
- **模型与价格扩充**：新增 Claude Opus 4.6 / 4.7 / 4.8、Claude Sonnet 4.6、GPT-5.5、腾讯混元 Hy3 定价
- **OpenAI Response API 记账**：`/v1/responses` 的 input / output tokens 正确落账（非流式 + 流式）

### 已修复
- 修复「预算使用」页添加预算无响应：预算为空或未选目标时给出明确提示（此前静默无响应）
- 修复 claude-haiku-4-5 模型名点号 / 连字符不一致，导致该模型成本恒显示「未配置定价」

---

## v0.1.6 — 2026-08-12（已发布）

### 已新增
- **Anthropic 协议路由**：DeepSeek / 智谱 GLM 新增 `/anthropic` 后缀路由，Claude Code 等 Anthropic 协议客户端可直接经本地代理记账，无需依赖独立 slug
- **Agent 自动识别增强**：新识别 gemini-cli、cline、roo-code、continue、aider、opencode、augment、copilot、kimi、doubao、manus 等 11 种客户端 User-Agent
- **模型名归一化**：`模型名[1M]`/`[2M]` 等上下文窗口后缀在排行与下钻明细中自动合并为同一模型，不再拆成多条
- **定价回退**：用户未手动配置定价的模型，若在内置参考价表中收录，自动按参考价计算成本（此前恒为 0 / 显示"未配置定价"）
- **总览「按模型」排行**：新增 `/api/models` 接口，模型排行随日期范围联动刷新（此前不随日期筛选变化）
- **Agent 显示名别名**：Agent 下钻明细页内可对该 Agent 设置自定义显示名（如把「其他」重命名），列表与下钻同步展示别名
- **总览显示模式**：排行区新增「全部 / Token / 成本」显示模式切换，成本模式下可切换美元/人民币，币种换算改用 `/api/pricing/rate` 实时汇率（此前固定 7.2 参考值，现仅作接口不可用时的兜底）
- **桌面字体整体放大**：新增 `--ox-font-scale` 变量统一放大桌面端字体
- **模型价格表排序**：新增「按输出价」排序，移除「按综合成本」

### 已修复
- 修复供应商/Agent 页日期范围不生效：切换「近 7 日 / 近 30 日 / 近 90 日」后列表与下钻明细请求未携带 `?days=`，始终返回全量数据
- 修复 Agent 别名钻取明细为空：设置显示名别名后按别名下钻时未反映射回原始名，导致查不到数据
- 修复非 2xx 响应（限流/上游错误）落账为大量 0-token 垃圾记录，污染统计
- 修复日期范围过滤与总览趋势图的时区口径：`datetime('now', ...)` 默认 UTC 与本地时间戳存储不一致，改用 `localtime` 修饰符对齐
- 修复流式请求的记账耗时：此前固定记为极短值（约 1ms），现改为流结束时按全程实际耗时计算
- 修复预算为 0 或负数时的异常行为：读侧不再参与告警触发判断，写侧直接拒绝非正整数
- 修复总览排行中出现 0-token 供应商条目（内置路由零值占位不应出现在用量排行里）
- 修复总览排行用量条被长模型名挤压至不可见
- 修复预算新增/删除后「今日预算使用」不立即刷新，需等待 15 秒轮询
- 修复 Nginx 与 Web 应用层重复下发 `X-Frame-Options`（两条冲突头，`DENY` 会掐断预期的同源 iframe 能力），改由 Web 应用层统一负责
- 统一 Go 后端与 Web 端的登录失败提示文案为「账户或密码不正确」
- 桌面裸启动（未设 `LOCAL_MODE`）时打印醒目日志提示当前监听云端端口 `:9090`，避免误判 sidecar 未运行

---

## v0.1.5 — 2026-08-11（已发布）

### 已移除
- 移除悬浮卡片不透明度调整（恢复固定玻璃拟态外观）

---

## v0.1.4 — 2026-08-11（已发布）

### 已完成
- **悬浮卡片升级**：今日模型 Top5 排名（前三名红色渐变）、位置记忆 + 设置页「重置位置」、主题实时切换、不透明度调整（v0.1.5 起移除）、窗口加高（192 → 300）
- **自定义供应商**：地址自动补全 https://，只需填域名/路径部分

---

## v0.1.3 — 2026-08-11（已发布）

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
