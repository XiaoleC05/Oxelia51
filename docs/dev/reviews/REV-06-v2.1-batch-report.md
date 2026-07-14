# REV-06：v2.1 批次全量审查报告

**审查日期**：2026-07-09  
**审查人**：Trae Work（审查与知识智能体）  
**范围**：SuperRead / MusicBox / CS2Lab / AIHelper / AgentCanvas / SecretStore 6 个在线工具 + Oxelia51 Gateway 修复（GW-FIX）+ 前端工具壳 + 项目文档  
**基准**：`AGENTS.md` v2.0、`docs/07-需求确认摘要.md`、`docs/api/tool-registration.md`、`docs/06-多Agent任务板.md`、`.trae/rules/project_rules.md`

---

## 1. 执行摘要

| 维度 | 结论 |
|------|------|
| 构建状态 | ✅ Oxelia51 后端 `go build` / `go test ./...` 通过；6 个工具 `go build` 全部通过；前端 `npm run build` 通过 |
| 功能可用性 | ⚠️ SuperRead 前端 API 调用路径错误，页面功能基本不可用；AIHelper `/api/enhance` 未发送 `Authorization` 头，核心功能不可用 |
| 安全基线 | ❌ 6 个新工具全部存在生产环境鉴权后门或越权风险；多个工具存在 SSRF、CORS 配置错误、错误信息泄露 |
| 文档同步 | ❌ `README.md` / `CHANGELOG.md` 未同步 v2.1；部分 `.agents/` 提示词存在事实错误 |
| 一致性 | ⚠️ auth header、health 格式、`.env.example`、命名存在多处不一致；CS2Lab 鉴权中间件行为与其他 5 个工具显著不同 |

**总体判断**：v2.1 批次代码结构完整、可编译，但存在多个 **P0 阻塞级问题**，在修复前不建议合并到 `main` 或部署上线。

---

## 2. P0 阻塞级问题（必须修复后方可进入下一阶段）

### 2.1 前端：SuperRead 工具壳 API 路径错误导致全部请求 404

- **文件**：[frontend/src/tools/superread/SuperReadTool.jsx](file:///d:/07_Projects/code/Oxelia51/frontend/src/tools/superread/SuperReadTool.jsx#L31-L49)
- **问题**：代码使用 `const API_BASE = 'tools/superread/proxy/api'`，并调用 `apiProxy(API_BASE, '/feeds')`。而 `api/index.js` 的 `apiProxy(slug, toolPath)` 会再拼接 `/tools/${slug}/proxy/${path}`，导致生成 `/api/tools/tools/superread/proxy/api/feeds`，所有请求 404。
- **修复**：统一改为 `apiProxy('superread', 'api/feeds')` 等，与其他 5 个工具壳一致。
- **根因**：`.agents/hermes-TOOL-05-superread-frontend.md` 中错误地将 `BASE` 定义为 `tools/superread/proxy/api`，提示词本身需要同步修正。

### 2.2 后端：5 个新工具均保留 `X-Test-User-Id` 生产鉴权后门

- **文件**：
  - [SuperRead/internal/handler/auth.go](file:///d:/07_Projects/code/SuperRead/internal/handler/auth.go#L31-L41)
  - [MusicBox/internal/handler/auth.go](file:///d:/07_Projects/code/MusicBox/internal/handler/auth.go#L30-L40)
  - [AIHelper/internal/handler/auth.go](file:///d:/07_Projects/code/AIHelper/internal/handler/auth.go#L30-L40)
  - [AgentCanvas/internal/handler/auth.go](file:///d:/07_Projects/code/AgentCanvas/internal/handler/auth.go#L30-L40)
  - [SecretStore/internal/handler/auth.go](file:///d:/07_Projects/code/SecretStore/internal/handler/auth.go#L30-L44)
- **问题**：只要请求头携带 `X-Test-User-Id`，即可伪装成任意 `user_id`，绕过网关鉴权。生产环境若被探测到该头部，等同于任意用户身份伪造。
- **修复**：删除无条件测试分支；若必须本地调试，绑定 `GIN_MODE=debug` 且显式 `TEST_AUTH_ENABLED=true`，默认关闭。

### 2.3 后端：SecretStore Combo 可引用其他用户的 Entry（越权）

- **文件**：[SecretStore/internal/handler/combos.go](file:///d:/07_Projects/code/SecretStore/internal/handler/combos.go#L49-L74)、[SecretStore/internal/db/combos.go](file:///d:/07_Projects/code/SecretStore/internal/db/combos.go#L16-L51)
- **问题**：创建 Combo 时仅校验 `vault_id`，未校验传入的 `entry_ids` 是否属于当前 vault。攻击者可通过枚举 entry ID 将他人条目组合到自己 Combo 中读取。
- **修复**：在事务内查询 `secretstore.entries`，确认所有 `entry_ids` 均属于当前 `vault_id` 后再插入。

### 2.4 后端：MusicBox 全局单例适配器导致用户凭证串用

- **文件**：[MusicBox/internal/handler/search.go](file:///d:/07_Projects/code/MusicBox/internal/handler/search.go#L11-L54)、[MusicBox/internal/handler/credentials.go](file:///d:/07_Projects/code/MusicBox/internal/handler/credentials.go#L81-L88)、[MusicBox/internal/adapter/adapter.go](file:///d:/07_Projects/code/MusicBox/internal/adapter/adapter.go)
- **问题**：`var kugouAdapter *adapter.KugouAdapter` 为包级全局变量。用户 A 更新 Cookie 后，后续用户 B 的搜索/播放请求会复用用户 A 的凭证。
- **修复**：按请求从数据库取出当前用户凭证，创建临时适配器；禁止全局共享。

### 2.5 后端：MusicBox 歌单操作越权

- **文件**：[MusicBox/internal/handler/playlist.go](file:///d:/07_Projects/code/MusicBox/internal/handler/playlist.go#L80-L135)、[MusicBox/internal/db/playlist.go](file:///d:/07_Projects/code/MusicBox/internal/db/playlist.go#L68-L112)
- **问题**：`AddSong`、`RemoveSong`、`ListSongs` 未校验歌单/歌曲是否属于当前用户，任意登录用户可操作他人歌单。
- **修复**：所有歌单相关 SQL 增加 `AND user_id = $x` 或 `EXISTS` 归属校验。

### 2.6 后端：CS2Lab 非网关模式自动降级为固定测试用户

- **文件**：[CS2Lab/internal/handler/middleware.go](file:///d:/07_Projects/code/CS2Lab/internal/handler/middleware.go#L13-L19)
- **问题**：`OXELIA_GATEWAY_MODE=false` 时，中间件直接将 `userID` 设为 `1` 并放行。若生产环境误配，将导致所有请求共享同一用户数据。
- **修复**：非网关模式返回 401；本地开发测试账号通过独立开关显式启用。

### 2.7 后端：AIHelper `/api/enhance` 未发送 Authorization 头

- **文件**：[AIHelper/internal/handler/enhance.go](file:///d:/07_Projects/code/AIHelper/internal/handler/enhance.go#L93-L129)
- **问题**：`callLLM()` 接收 `apiKey` 却未设置 `Authorization` 请求头，LLM 调用必然 401/403，核心功能完全不可用。
- **修复**：添加 `req.Header.Set("Authorization", "Bearer "+apiKey)` 与 `Content-Type`。

### 2.8 后端：全部 6 个新工具 CORS `*` 与 `AllowCredentials: true` 同时启用

- **文件**：各工具 `cmd/server/main.go` 的 CORS 配置段
- **问题**：浏览器规范禁止两者并用，带凭证跨域请求会被拦截；即便绕过浏览器，也会扩大 CSRF 攻击面。
- **修复**：生产环境从环境变量读取可信 Origin 白名单，禁用 `*`。

### 2.9 后端：全部 6 个新工具网关模式未验证头部来源

- **文件**：各工具 `internal/handler/auth.go`
- **问题**：仅校验 `X-User-Id`/`X-Username`/`X-Role` 是否存在且可解析，未验证是否来自可信网关（无签名、无 IP 白名单、无共享密钥）。若服务被直接暴露，攻击者可伪造头部。
- **修复**：增加 `X-Gateway-Signature` HMAC 校验，或仅监听 `127.0.0.1`/Unix Socket；文档中明确“必须仅允许网关访问”。

---

## 3. P1 高优先级问题

### 3.1 鉴权与访问控制

| # | 仓库 | 文件 | 问题 | 修复建议 |
|---|------|------|------|----------|
| P1-1 | SecretStore | [internal/handler/auth.go](file:///d:/07_Projects/code/SecretStore/internal/handler/auth.go#L13-L44) | 网关模式缺少有效头时降级到测试用户分支，仍可能绕过认证 | 网关模式下缺失/无效头直接返回 401，不进入测试分支 |
| P1-2 | MusicBox | [internal/handler/auth.go](file:///d:/07_Projects/code/MusicBox/internal/handler/auth.go#L18-L24) | `X-Role` 未做白名单校验 | 限制角色为 `user`/`admin` |
| P1-3 | AgentCanvas | [internal/db/nodes.go](file:///d:/07_Projects/code/AgentCanvas/internal/db/nodes.go#L63-L76) | `position_x/y` 为 `float64`，更新时未传坐标会被零值 `0` 覆盖 | 改为 `*float64` + `COALESCE` 区分“未传”与“传 0” |
| P1-4 | AgentCanvas | [internal/handler/projects.go](file:///d:/07_Projects/code/AgentCanvas/internal/handler/projects.go#L123-L141) | 删除项目后不检查影响行数，不存在/他人项目也返回 200 | 仓库返回影响行数，行数为 0 返回 404 |
| P1-5 | SuperRead | [internal/db/article.go](file:///d:/07_Projects/code/SuperRead/internal/db/article.go#L89-L156) | `UpdateArticle` 后调用 `GetArticle(ctx, id)` 不按用户查询 | `GetArticle` 增加 `userID` 参数或新增 `GetArticleForUser` |

### 3.2 数据完整性与事务

| # | 仓库 | 文件 | 问题 | 修复建议 |
|---|------|------|------|----------|
| P1-6 | SecretStore | [internal/handler/entries.go](file:///d:/07_Projects/code/SecretStore/internal/handler/entries.go#L55-L89)、[L145-L189](file:///d:/07_Projects/code/SecretStore/internal/handler/entries.go#L145-L189) | Entry 与字段写入分两步，中间失败会产生孤儿条目 | 使用数据库事务包裹 |
| P1-7 | SecretStore | [internal/db/combos.go](file:///d:/07_Projects/code/SecretStore/internal/db/combos.go#L32-L39) | 创建 Combo 引用不存在的 entry 无校验 | 插入前校验 entry 存在，或依赖外键但 handler 预先检查 |
| P1-8 | CS2Lab | [internal/db/db.go](file:///d:/07_Projects/code/CS2Lab/internal/db/db.go#L45-L116) | `RunMigrations` 中 `readMigrationFile` 完全忽略 `filename` 参数，只返回硬编码建表 SQL | 使用 `embed` 真实读取 `migrations/` 文件；引入 `schema_migrations` 表 |
| P1-9 | CS2Lab | [internal/db/db.go](file:///d:/07_Projects/code/CS2Lab/internal/db/db.go#L64-L114) | 硬编码 SQL 缺少 `migrations/001_init.up.sql` 中的 GIN 全文搜索索引 | 修复迁移系统后真实执行迁移文件 |

### 3.3 SSRF 与外部请求风险

| # | 仓库 | 文件 | 问题 | 修复建议 |
|---|------|------|------|----------|
| P1-10 | SuperRead | [internal/summarizer/summarizer.go](file:///d:/07_Projects/code/SuperRead/internal/summarizer/summarizer.go#L46-L78) | 用户可设置任意 `APIBase`，后端携带其 API Key 直接请求 | 白名单限制 HTTPS 公网 LLM 域名；拒绝内网/保留地址 |
| P1-11 | AIHelper | [internal/handler/enhance.go](file:///d:/07_Projects/code/AIHelper/internal/handler/enhance.go#L58-L65) | `apiBase` 来自用户设置并直接拼接 URL | 同上，加白名单与内网防护 |
| P1-12 | MusicBox | [internal/adapter/adapter.go](file:///d:/07_Projects/code/MusicBox/internal/adapter/adapter.go#L55)、[L120](file:///d:/07_Projects/code/MusicBox/internal/adapter/adapter.go#L120) | 调用酷狗 API 使用明文 HTTP | 改为 HTTPS 并校验服务端证书 |
| P1-13 | SuperRead | [internal/fetcher/fetcher.go](file:///d:/07_Projects/code/SuperRead/internal/fetcher/fetcher.go#L23-L30) | RSS 抓取无响应体大小限制，恶意 RSS 可 OOM | 使用 `io.LimitReader` 限制（如 10MB） |
| P1-14 | MusicBox | [internal/adapter/adapter.go](file:///d:/07_Projects/code/MusicBox/internal/adapter/adapter.go#L72)、[L136](file:///d:/07_Projects/code/MusicBox/internal/adapter/adapter.go#L136) | `io.ReadAll(resp.Body)` 无大小限制 | 使用 `io.LimitReader` 限制（如 5MB） |

### 3.5 敏感信息与错误处理

| # | 仓库 | 文件 | 问题 | 修复建议 |
|---|------|------|------|----------|
| P1-15 | 全部 6 工具 | 各 `internal/handler/*.go` | 大量 `c.JSON(500, gin.H{"error": err.Error()})` 泄露内部错误 | 返回统一模糊错误；原始错误记录日志 |
| P1-16 | SuperRead | [internal/model/model.go](file:///d:/07_Projects/code/SuperRead/internal/model/model.go#L33-L40)、[internal/handler/settings.go](file:///d:/07_Projects/code/SuperRead/internal/handler/settings.go#L11-L34) | 用户 LLM API Key 明文返回前端 | 返回 DTO 中隐藏 `api_key`；数据库加密存储 |
| P1-17 | MusicBox | [internal/config/config.go](file:///d:/07_Projects/code/MusicBox/internal/config/config.go#L27) | 默认加密密钥可预测 `default-encryption-key-change-me-in-prod-32b` | 生产环境要求随机 32 字节；无配置则启动失败 |
| P1-18 | CS2Lab | [internal/config/config.go](file:///d:/07_Projects/code/CS2Lab/internal/config/config.go#L20) | 默认数据库连接串含明文密码 `postgres://postgres:password@...` | 默认值设为空串，启动时校验 |
| P1-19 | AIHelper | [internal/db/settings.go](file:///d:/07_Projects/code/AIHelper/internal/db/settings.go#L37-L39) | `COALESCE(NULLIF($2, ''), ...)` 导致无法清空 API Key | 支持显式置空或提供删除接口 |

### 3.6 功能未闭环

| # | 仓库 | 文件 | 问题 | 修复建议 |
|---|------|------|------|----------|
| P1-20 | SuperRead | [internal/summarizer/summarizer.go](file:///d:/07_Projects/code/SuperRead/internal/summarizer/summarizer.go) | Summarizer 已实现但未被任何代码调用，AI 摘要字段永远为空 | 在抓取后/定时任务中调用，或 v1 移除该模块 |
| P1-21 | CS2Lab | [internal/db/notes.go](file:///d:/07_Projects/code/CS2Lab/internal/db/notes.go#L55-L67) | `NoteRepository.Delete` 已实现但无路由注册 | 补全 `DELETE /api/notes/:lineupId` 或删除死代码 |
| P1-22 | MusicBox | [internal/adapter/adapter.go](file:///d:/07_Projects/code/MusicBox/internal/adapter/adapter.go#L115-L160) | `GetPlayURL` 接收 `quality` 参数但未使用 | 根据 quality 映射酷狗参数或移除参数 |

### 3.7 迁移与配置

| # | 仓库 | 文件 | 问题 | 修复建议 |
|---|------|------|------|----------|
| P1-23 | 除 CS2Lab 外 5 工具 | 各 `cmd/server/main.go` 与 `migrations/` | `runMigrations()` 内嵌 SQL，与 `migrations/` 文件重复 | 使用 `golang-migrate`/`pressly/goose` 或 `embed` 读取文件 |
| P1-24 | AIHelper/AgentCanvas/SecretStore | 根目录 | 缺少 `.gitignore` | 添加 `.gitignore`，至少忽略 `.env`、构建产物、IDE 目录 |
| P1-25 | 全部 6 工具 | `.env.example` | 配置项过于精简，缺少 `GIN_MODE`、`CORS_ALLOWED_ORIGINS`、`DB_MAX_CONNS`、`LOG_LEVEL`、`REQUEST_BODY_LIMIT` 等 | 补充完整示例并加注释 |

### 3.8 文档

| # | 文件 | 问题 | 修复建议 |
|---|------|------|----------|
| P1-26 | [README.md](file:///d:/07_Projects/code/Oxelia51/README.md#L1) | 仍为 v2.0 内容，未加入 v2.1 6 个工具与技术栈/路线图 | 更新 Roadmap、功能列表、AI 协作表 |
| P1-27 | [CHANGELOG.md](file:///d:/07_Projects/code/Oxelia51/CHANGELOG.md#L1) | 缺少 v2.1 条目，未覆盖 6 个新工具、GW-FIX、Hermes 更名 | 追加 v2.1 变更记录 |
| P1-28 | [.agents/hermes-TOOL-03-secretstore-frontend.md](file:///d:/07_Projects/code/Oxelia51/.agents/hermes-TOOL-03-secretstore-frontend.md#L19-L22) | Gateway 代理端口写成 `8001`（DormGuard 端口），SecretStore 应为 `8006` | 修正为 `8006` |
| P1-29 | [.agents/hermes-TOOL-05-superread-frontend.md](file:///d:/07_Projects/code/Oxelia51/.agents/hermes-TOOL-05-superread-frontend.md#L64-L71) | 错误定义 `const BASE = 'tools/superread/proxy/api'`，导致前端代码 404 | 修正为 `apiProxy('superread', 'api/...')` 模式 |

---

## 4. P2 一般/改进级问题

### 4.1 一致性与规范

| # | 项 | 现状 | 建议 |
|---|------|------|------|
| P2-1 | auth header | SuperRead/MusicBox/AIHelper/AgentCanvas/SecretStore 使用 `X-User-Id`；CS2Lab 使用 `X-User-ID` | 全平台统一为 `X-User-Id`，CORS AllowHeaders 同步兼容 |
| P2-2 | health 格式 | SuperRead 返回 `{"status":"ok","service":"superread"}`；其余仅 `{"status":"ok"}` | 统一格式，或约定仅 `status` |
| P2-3 | `.env.example` DATABASE_URL | 5 工具用 `user:password`；CS2Lab 用 `postgres:password`；AIHelper 用 `postgresql://` | 统一用户名、协议写法 |
| P2-4 | tool.json 描述语言 | SecretStore 描述为英文，其余为中文 | 统一为中文（面向中文用户） |
| P2-5 | 工具编号 | `.agents/` 中 SecretStore 后端为 TOOL-02、前端为 TOOL-03，与任务板一致但易造成误解 | 文档中说明编号含义即可 |

### 4.2 代码质量

| # | 仓库 | 文件 | 问题 | 建议 |
|---|------|------|------|------|
| P2-6 | SuperRead | [internal/fetcher/fetcher.go](file:///d:/07_Projects/code/SuperRead/internal/fetcher/fetcher.go#L13-L25) | `Fetcher.parser` 字段初始化后未被使用 | 复用字段或移除 |
| P2-7 | SuperRead | [internal/db/article.go](file:///d:/07_Projects/code/SuperRead/internal/db/article.go#L193-L202) | 自定义 `joinStrings` 与标准库 `strings.Join` 重复 | 删除自定义函数 |
| P2-8 | MusicBox | [internal/model/model.go](file:///d:/07_Projects/code/MusicBox/internal/model/model.go#L3-L12) | `model.Song` 死代码 | 删除或统一使用 `adapter.Song` |
| P2-9 | AIHelper | [internal/db/templates.go](file:///d:/07_Projects/code/AIHelper/internal/db/templates.go#L47-L61) | `GetByID` 已定义但未被调用 | 删除或补全接口 |
| P2-10 | SecretStore | [internal/model/model.go](file:///d:/07_Projects/code/SecretStore/internal/model/model.go#L76-L79)、[internal/db/combos.go](file:///d:/07_Projects/code/SecretStore/internal/db/combos.go#L111-L142) | `ComboDetail`、`ExistsInVault` 等死代码 | 清理 |
| P2-11 | SecretStore | [internal/model/model.go](file:///d:/07_Projects/code/SecretStore/internal/model/model.go#L12-L19) | 时间字段类型不一致（`Vault` 用 `time.Time`，其余用 `string`） | 统一使用 `time.Time` |
| P2-12 | CS2Lab | [internal/db/db.go](file:///d:/07_Projects/code/CS2Lab/internal/db/db.go#L119-L127) | `scanStringArray` 未使用 | 删除 |

### 4.3 输入校验与边界

| # | 仓库 | 文件 | 问题 | 建议 |
|---|------|------|------|------|
| P2-13 | SuperRead | [internal/handler/article.go](file:///d:/07_Projects/code/SuperRead/internal/handler/article.go#L37-L54) | `limit` 无上限 | 上限设为 200 左右 |
| P2-14 | CS2Lab | [internal/handler/handlers.go](file:///d:/07_Projects/code/CS2Lab/internal/handler/handlers.go#L86-L96) | `limit`/`offset` 无上限 | 上限 100，默认 50 |
| P2-15 | CS2Lab | [internal/handler/handlers.go](file:///d:/07_Projects/code/CS2Lab/internal/handler/handlers.go#L78-L80) | `type` 查询参数未校验枚举 | 校验 `type ∈ {smoke, flash, molotov, grenade}` |
| P2-16 | AgentCanvas | [internal/handler/edges.go](file:///d:/07_Projects/code/AgentCanvas/internal/handler/edges.go#L49-L73) | 未校验自环边 | 根据业务需求禁止或允许自环 |
| P2-17 | AgentCanvas | [internal/handler/projects.go](file:///d:/07_Projects/code/AgentCanvas/internal/handler/projects.go#L39-L58) | 项目名、节点 label 无长度限制 | 增加 `binding:"max=..."` |
| P2-18 | SecretStore | [internal/model/model.go](file:///d:/07_Projects/code/SecretStore/internal/model/model.go#L34-L49) | title/field_key/field_value 等无长度限制 | 增加长度校验 |

### 4.4 运行时可观测性

| # | 仓库 | 文件 | 问题 | 建议 |
|---|------|------|------|------|
| P2-19 | 全部 6 工具 | `internal/db/db.go` | 使用 `pgxpool` 默认连接池，未设置 `MaxConns` 等 | 针对 2G 服务器显式设置连接池 |
| P2-20 | 全部 6 工具 | `cmd/server/main.go` | 无全局速率限制 | 增加基于用户/IP 的限流 |
| P2-21 | 全部 6 工具 | 项目整体 | 无任何 `*_test.go` | 为核心鉴权、repository、加解密添加测试 |
| P2-22 | SecretStore | [internal/handler/health.go](file:///d:/07_Projects/code/SecretStore/internal/handler/health.go#L9-L11) | 健康检查不验证数据库 | 增加 `db.Pool.Ping(ctx)`，失败返回 503 |
| P2-23 | SecretStore | [internal/db/vaults.go](file:///d:/07_Projects/code/SecretStore/internal/db/vaults.go#L17-L28) | `ON CONFLICT ... SET updated_at = updated_at` 空操作 | 改为 `DO NOTHING` 或 `SET updated_at = NOW()` |
| P2-24 | SuperRead | [internal/cron/cron.go](file:///d:/07_Projects/code/SuperRead/internal/cron/cron.go#L14-L33) | Cron 任务无 panic recover | 增加 `defer recover()` |
| P2-25 | SuperRead | [cmd/server/main.go](file:///d:/07_Projects/code/SuperRead/cmd/server/main.go#L26-L28)、[L112-L113](file:///d:/07_Projects/code/SuperRead/cmd/server/main.go#L112-L113) | `log.Fatalf` 阻止 `defer` 清理 | 改为 `log.Printf` + `return` 或手动关闭 |

### 4.5 项目级发现

| # | 文件 | 问题 | 建议 |
|---|------|------|------|
| P2-26 | [Oxelia51/.gitignore](file:///d:/07_Projects/code/Oxelia51/.gitignore#L37) | `docs/` 被整体忽略，导致新增文档（含本报告）默认不被 Git 追踪 | 移除 `docs/` 忽略，或改为仅忽略特定临时文档 |
| P2-27 | [frontend/src/api/index.js](file:///d:/07_Projects/code/Oxelia51/frontend/src/api/index.js#L1) | `X-Oxelia51-Access-Token` 被发送到工具后端（网关未剥离），虽未被使用但属于不必要的令牌暴露 | 网关 `copyHeaders` 中增加该头剥离，或工具文档声明不读取 |

---

## 5. 通过项

- ✅ **构建**：Oxelia51 后端编译与单元测试通过；6 个工具 `go build` 通过；前端 `npm run build` 通过。
- ✅ **参数化查询**：6 个工具 DB 层均使用 `$N` 占位符，未发现 SQL 注入。
- ✅ **Gateway 修复**：`backend/internal/gateway/proxy.go` 已同时注入长 header（`X-Oxelia51-User-Id` 等）与短 header（`X-User-Id` 等），兼容新旧工具。
- ✅ **AGENTS.md Hermes 更名**：v2.0 已统一将前端智能体命名为 Hermes，文档内部引用一致。
- ✅ **Git 无真实 secret 泄露**：未发现已提交的真实密码、API Key、JWT；仅存在 `.env.example` 占位符与本地开发默认值。
- ✅ **工具注册**：`oxelia51.tool.json` 6 个文件字段完整，`slug`/`port`/`online_capable` 等关键字段符合 `docs/api/tool-registration.md`。
- ✅ **前端路由注册**：`App.jsx` 与 `ToolShell.jsx` 已完整注册 6 个新工具路由。
- ✅ **前端设计一致性**：6 个工具壳均复用平台 CSS 变量、移动端响应式、`Lucide` 风格内联 SVG 图标。

---

## 6. 修复优先级建议

| 阶段 | 必须完成的问题 | 完成后动作 |
|------|----------------|------------|
| **阶段 1（阻塞修复）** | P0 全部：SuperRead 前端路径、6 工具鉴权后门、MusicBox 凭证串用与越权、SecretStore Combo 越权、CS2Lab 测试用户降级、AIHelper Authorization 头、CORS 与网关信任校验 | 重新执行全量构建 + 接口联调 |
| **阶段 2（安全加固）** | P1 SSRF/白名单、错误信息脱敏、API Key 隐藏/加密、响应体大小限制、默认密码/密钥移除 | 安全回归审查 |
| **阶段 3（功能闭环）** | P1 SuperRead AI 摘要调用、CS2Lab 迁移系统修复、MusicBox quality 参数、CS2Lab 笔记删除路由 | 功能验收 |
| **阶段 4（一致性与文档）** | P1/P2 `.gitignore`、`.env.example`、health/auth header 统一、README/CHANGELOG 更新、`.agents` 提示词修正 | 文档审查 |
| **阶段 5（质量提升）** | P2 测试、限流、连接池、索引、输入长度校验、日志结构化为后续迭代 | 纳入 v2.2 计划 |

---

## 7. 学习笔记建议（供开发者私人工作文档追加）

1. **CORS 凭据与通配符冲突**（2026-07-09）：`Access-Control-Allow-Origin: *` 不能与 `Access-Control-Allow-Credentials: true` 共用，否则浏览器拒绝且存在 CSRF 风险。
2. **网关身份头不可盲信**（2026-07-09）：工具在 `OXELIA_GATEWAY_MODE=true` 下仍须校验请求来源或共享密钥，否则可被直接伪造 `X-User-Id`。
3. **多租户服务禁止全局单例适配器**（2026-07-09）：用户凭证类服务若使用包级全局变量，会导致 A 用户凭证被 B 用户调用。
4. **Go `io.ReadAll` 读取外部响应需设限**（2026-07-09）：外部 HTTP 响应应使用 `io.LimitReader` 防止内存耗尽。
5. **AES-GCM 正确使用要点**（2026-07-09）：随机 nonce、key 长度 32 字节、认证标签自动处理；建议用 AAD 绑定数据上下文，长期考虑按用户派生密钥。
6. **迁移文件必须被真实执行**（2026-07-09）：内嵌 SQL 与 `migrations/` 文件重复易导致 schema 漂移，应使用迁移工具或 `embed`。

---

> **结论**：v2.1 批次实现了 6 个工具的完整骨架与可编译代码，但安全基线尚未达到生产要求。建议在修复全部 P0 与核心 P1 问题后，由 Qoder 进行回归测试与部署验证，再由 Trae Work 进行复审。
