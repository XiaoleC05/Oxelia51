# Go 管理后台架构（backend/）

**撰写依据**：`backend/` 实际代码（go.mod module `github.com/XiaoleC05/oxelia51-backend`，Go 1.26，Gin + pgx/v5 + go-redis）。

---

## 1. 职责边界

本服务是 **Oxelia51 平台运维后台**，部署在阿里云（systemd
`oxelia51-backend.service`，监听 127.0.0.1:8080，经 Nginx `/api/` 暴露）：

- 平台管理员账户体系（`users` 表，account_id/username 登录）
- 工具注册与在线代理（`tools` 表 + `/api/tools/:slug/proxy/*` 网关）
- 代理网关项目密钥（`proxy_keys`）
- IP 白名单、服务器/网关统计、`/api/admin/exec` 远程执行
- 站点资源上传（hero 图片）

**与 web 的用户体系是两套**：web（NextAuth，腾讯云 PG 的 public.users）服务
站点用户；backend（阿里云 PG 的 users）服务平台运维人员。两边账号不互通，
web 管理台通过 `goClient.ts` 持运维凭证换 JWT 代理调用本服务
（见 `docs/architecture/web.md` §5.3）。

## 2. 目录结构

```
backend/
├── cmd/server/main.go        # 入口：Load → Validate → slog(JSON/text) → app.New → Run
├── config/config.go          # 全 env 驱动配置 + Validate() 启动闸门（§3.1）
├── migrations/               # 16 个 *.up.sql（+部分 .down.sql）+ 种子 SQL（§5.1）
└── internal/
    ├── app/app.go            # 组装：连接、迁移、种子、中间件、全部路由注册（§4）
    ├── domain/               # 按域分包，各自含 handler/repository/model/service
    │   ├── auth/             # 登录/刷新/登出 + TokenService + RateLimiter + RefreshStore + JWTBlacklist
    │   ├── user/             # users 表访问、Me/PatchProfile、EnsureAdmin 种子
    │   ├── admin/            # 服务器/网关统计 + IP 白名单 CRUD + /exec（+ linux 平台文件）
    │   ├── adminuser/        # 管理员对 users 的 CRUD + DashboardStats
    │   ├── proxykey/         # 代理网关项目密钥（生成/列表/吊销）
    │   ├── hero/             # hero 图片上传（通用图片上传端点）
    │   └── health/           # /api/health、/api/uptime
    ├── gateway/              # 工具反向代理：proxy.go + access.go（鉴权契约）+ resolver.go（上游解析）
    ├── infra/                # postgres/redis 连接、migrate 执行器、clientip、ApiError
    └── middleware/           # auth.go（JWT + 黑名单 + RequireAdmin）、ipcheck.go（IP 白名单）
```

分层约定：handler 只做 HTTP 编排，repository 持有 `*pgxpool.Pool` 直写 SQL，
service（auth 域）放可测纯逻辑；无 ORM。

## 3. 启动流程

`cmd/server/main.go` → `internal/app/app.go` 的 `New(cfg)`：

1. `config.Load()`（godotenv 读 `.env` → 环境变量）→ `Validate()` 闸门：
   `JWT_SECRET` 为默认值或 <16 字符、`DB_PASSWORD` 为空，**拒绝启动**
   （config.go:79-86）
2. `infra.Connect`：pgxpool（MaxConns 20 / MinConns 2 / lifetime 30min），
   建池后 Ping 失败即退出
3. `infra.RunMigrations`：字典序执行 `migrations/*.up.sql`（§5.1）
4. `user.EnsureAdmin`：无 `account_id = 'oxelia51'` 的管理员则创建
   （`ADMIN_INITIAL_PASSWORD` 或随机生成 24 字符密码，bcrypt 落库）
5. `infra.ConnectRedis`：Ping 失败即退出（Redis 是硬依赖：限流/黑名单/刷新令牌）
6. 注册全局 CORS（单来源 `CORS_ORIGIN`，默认 `https://oxelia51.com`）、
   `SetTrustedProxies(["127.0.0.1","::1"])`、pprof（仅 `DEBUG_PPROF=true` 时
   注册，原默认公开会泄漏 heap/goroutine，app.go:76-89 注释）

### 3.1 配置（`config/config.go`）

全部 env 驱动，关键项：

| env | 默认 | 说明 |
|-----|------|------|
| `DB_*` | localhost:5432/oxelia51 | PG 连接（`DSN()` 拼接，sslmode=disable） |
| `JWT_SECRET` | —（必填） | HS256 密钥，Validate 强制强度 |
| `REDIS_ADDR` | localhost:6379 | 限流/黑名单/刷新令牌 |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` | 7d / 30d | 令牌生命周期 |
| `CORS_ORIGIN` | https://oxelia51.com | 唯一允许的跨域来源 |
| `GATEWAY_UPSTREAM_TIMEOUT` / `GATEWAY_MAX_BODY_BYTES` | 30s / 10MB | 工具代理限额 |
| `GATEWAY_HMAC_SECRET` | 空 | 非空时给上游注入 HMAC 签名头 |
| `TOOL_ADMIN_TOKEN_<SLUG>` | — | 按工具注入下游 Authorization（env 扫描，config.go:135） |
| `TOOL_API_BASE_<SLUG>` | — | 覆盖 DB 中工具上游地址（resolver.go） |
| `ADMIN_STATS_ALLOWED_IP` | 118.25.138.177 | `TENCENT_HEALTH_URL` 允许的主机白名单（SSRF 防护） |
| `GATEWAY_STATUS_URL` | http://127.0.0.1:9090/api/proxy/status | GatewayStats 代理目标 |
| `LISTEN_ADDR` | ":8080" | 生产应绑 loopback，仅 Nginx 反代 |
| `OXELIA_BREAK_GLASS_IP` | — | IP 白名单 fail-close 的紧急救援（§6.3） |

## 4. API 路由全表（`internal/app/app.go` 注册）

四档访问控制：

### 4.1 公开（无鉴权）

| 方法/路径 | Handler | 说明 |
|-----------|---------|------|
| GET `/api/health` | health.Health | 存活检查（查 PG） |
| GET `/api/uptime` | health.Uptime | 运行时长 |
| POST `/api/auth/login` | auth.Login | 邮箱或 account_id + 密码 → JWT 对（§6.1） |
| POST `/api/auth/refresh` | auth.Refresh | 刷新令牌轮换（§6.1） |

### 4.2 登录用户（JWT，`middleware.NewAuthMiddleware`）

| 方法/路径 | Handler |
|-----------|---------|
| POST `/api/auth/logout` | auth.Logout（jti 入黑名单 + 删 refresh） |
| GET `/api/users/me` | user.Me |
| PATCH `/api/auth/profile` | user.PatchProfile |

### 4.3 管理员（JWT + `RequireAdmin`，role=admin）

| 方法/路径 | Handler | 说明 |
|-----------|---------|------|
| GET/PATCH/DELETE `/api/admin/users[...]` | adminuser.ListUsers/PatchUser/DeleteUser | 运维账户管理；List 支持 `?q=` 模糊搜 account_id/email |
| POST `/api/admin/hero-images/upload` | hero.Upload | 图片上传（扩展名白名单） |
| GET `/api/admin/server-stats` | admin.ServerStats | 本机 CPU/内存/磁盘（linux /proc）+ 可选远程（SSRF 防护，§6.4） |
| GET `/api/admin/dashboard-stats` | adminuser.DashboardStats | 仪表盘汇总 |
| GET `/api/admin/gateway-stats` | admin.GatewayStats | 代理本机 proxy-gateway `/api/proxy/status`，不向公网暴露网关 |
| GET/POST/DELETE `/api/admin/proxy-keys[...]` | proxykey.List/Create/Delete | 代理密钥：`ox_<项目前缀>_<16B hex>`，库中只存 sha256，明文仅创建时返回 |
| GET/POST/PATCH/DELETE `/api/admin/ip-whitelist[...]` | admin.Whitelist* | **故意不挂 IP 白名单中间件**，否则空表 = 死锁（app.go:144 注释） |

### 4.4 管理员 + IP 白名单（JWT + RequireAdmin + `IPWhitelist`）

| 方法/路径 | Handler | 说明 |
|-----------|---------|------|
| POST `/api/admin/exec` | admin.Exec | 远程执行 `bash -c`（§6.5）——全站最危险端点，独占一档 |

### 4.5 工具代理（匿名可达，设计如此）

`ANY /api/tools/:slug/proxy/*path` 注册在裸 engine 上（app.go:112-117 注释明确
「勿误读为已鉴权」）：未登录请求以 anonymous 身份（uid=0/role=user）转发，
权限由下游工具自行判定；**不转发客户端 Authorization**。详见 §6.6。

## 5. 数据存储

### 5.1 PostgreSQL + 迁移执行器

- `infra/migrate.go`：启动时按字典序执行 `migrations/` 下所有 `*.up.sql`；
  无迁移台账表，**幂等完全靠 SQL 自身的 `IF NOT EXISTS`**；`.down.sql` 仅供
  人工回滚，从不自动执行。任一文件失败即拒绝启动。
- 15 个迁移（001–015）建表：`users`、`tools`、`portfolio_items`、
  `hero_images`、`carousel_settings`、`articles`、`pages`、
  `developer_profile`、`login_logs`、`site_settings`、`ip_whitelist`、
  `proxy_keys`。
- `deploy/seed-tools.sql`：工具注册种子数据。

### 5.2 Redis（`domain/auth/service.go` + handler.go）

- **登录限流**：`rl:login:ip:<ip>`，INCR + EXPIRE 固定窗口，10 次/15 分钟；
  超限 429
- **JWT 黑名单**：jti → TTL（= 令牌剩余有效期），登出写入；中间件每请求查
- **RefreshStore**：refresh token → userID，30 天 TTL；refresh 时先查后删
  （**轮换制**，旧 refresh 立即作废）

Redis 宕机 = 启动失败（Ping 不过）；运行期黑名单查询失败按**拒绝**处理
（fail-close，middleware/auth.go:46-51）。

## 6. 安全设计

### 6.1 令牌体系（`domain/auth/service.go`、`handler.go`）

- Access：HS256 JWT，claims 含 sub/username/role/email_verified/jti/exp/iat；
  解析时强制校验签名算法为 HMAC（防 alg 混淆）
- Refresh：32 字节随机的 base64url 不透明串，Redis 存储，单次使用轮换
- **防时序枚举**：账户不存在时用固定 dummy bcrypt hash 做一次比对拉平耗时
  （handler.go:19-21, 77-84）
- **邮箱验证纵深防御**：Login 拒绝未验证用户签发；中间件再校验
  `email_verified` claim，缺该 claim 的旧 token 视为未验证
  （middleware/auth.go:65-72）
- 令牌头双通道：`Authorization: Bearer` 优先，`X-Oxelia51-Access-Token`
  兜底（Nginx/CDN 可能丢 Authorization）

### 6.2 中间件链

```
AuthMiddleware：Bearer/备用头 → ParseAccess → jti 黑名单（fail-close）
              → email_verified claim → 注入 userID/userRole/username/jti
RequireAdmin：userRole == "admin"
IPWhitelist ：infra.ClientIP → whitelistRepo.IsAllowed（fail-close，§6.3）
```

### 6.3 IP 白名单（`middleware/ipcheck.go`）

- **fail-close**：DB 故障时拒绝一切（保护 exec 这种 RCE 面不在 DB 抖动期
  开放）；紧急救援用 `OXELIA_BREAK_GLASS_IP` 环境变量（repo.IsAllowed 内部
  判定）
- 只挂在 `/api/admin/exec` 一档；白名单自身的 CRUD 不能挂它（空表死锁）
- 可信 IP 解析链（`infra/clientip.go`）：`X-Real-IP`（nginx 写入的
  `$remote_addr`）→ `X-Oxelia51-Client-IP`（web 管理台代理透传，nginx 已
  覆盖为真实 IP）→ TCP 连接地址；**绝不信任客户端可写的 X-Forwarded-For
  首段**，否则可伪造 IP 绕过 exec 白名单

### 6.4 SSRF 防护（`admin/handler.go`）

- `fetchRemoteStats`（TENCENT_HEALTH_URL）：仅允许 http/https scheme，主机
  必须是 loopback 或 `ADMIN_STATS_ALLOWED_IP`（默认腾讯云 118.25.138.177）
- 网关 `isAllowedUpstreamBase`：工具上游只允许本机回环 http；**用 url.Parse
  后校验 Hostname 与 userinfo**，防 `http://127.0.0.1:80@evil.com` 这类
  userinfo 绕过（proxy.go:169-182 注释）

### 6.5 `/api/admin/exec` 的防护（`admin/handler.go:374-465`）

- 四道门：JWT → admin → IP 白名单（fail-close）→ 参数限制
- 命令长度 ≤4096；timeout 默认 10s、上限 30s（`context.WithTimeout`）
- **输出截断**：`cappedBuffer` 上限 1MB（`maxExecOutputBytes`），写满后照常
  消费丢弃（防子进程写端阻塞死锁），响应标注 truncated——防 `yes` 类命令
  撑爆内存
- **日志脱敏**：命令全文可能夹带敏感参数，slog 只记前 80 字符
  （`maxExecCommandLogLen`）
- 响应永远 200 + `{exitCode, stdout, error}`（错误在 body 里表达）

### 6.6 工具网关（`gateway/proxy.go`）

调用链：`loadTool(slug)` → `CheckAccess`（access.go，gateway-contract
v1.1：online_capable / status!=disabled / admin 或 user_accessible）→
`ResolveInternalAPIBase`（env 覆盖 DB）→ 回环校验 → 转发。

- **请求头清洗**：剥离 hop-by-hop、全部客户端 IP 转发头（X-Forwarded-For
  等 9 种 + RFC 7239 Forwarded）、Authorization、Origin、Referer
  （proxy.go:215-248；理由：上游 loopback 信任校验基于 TCP peer，透传会
  破坏校验且泄漏公网客户端 IP）
- **身份注入**：`X-Oxelia51-User-Id/Username/Role`（+ 兼容的 `X-User-*`）、
  `X-Oxelia51-Request-Id`；未登录注入 anonymous/0/user
- **下游鉴权**：`TOOL_ADMIN_TOKEN_<slug>` 注入 Authorization；
  `GATEWAY_HMAC_SECRET` 非空时注入 `X-Gateway-Timestamp` + HMAC-SHA256 签名
- 限额：请求体 `http.MaxBytesReader`、响应体 `readLimitedBody`（默认 10MB）；
  上游超时默认 30s；不跟随重定向（`ErrUseLastResponse`）

## 7. 部署（`.github/workflows/deploy.yml`）

```
push master → build-test job：
  go vet → go test → 交叉编译（GOOS=linux GOARCH=amd64 CGO_ENABLED=0，
  backend/oxelia51-server + proxy/proxy-server + analytics/token-analytics）
  → 打包 oxelia51-release.tar.gz（含 migrations/ 与 deploy/）
→ release job：gh release create release-<时间戳>（仅保留最新 2 个 release-*）
→ GitHub webhook（release published）→ 阿里云 receiver.py 验签
→ deploy.sh <tarball_url> → apply-release.sh 解包安装
→ systemctl restart oxelia51-backend
```

二进制内嵌 `migrations/` 目录随包发布，启动时自动执行（§5.1）。服务器上
**不编译**（AGENTS.md 铁律），环境变量来自 `/opt/...` 下 `.env`
（模板：`deploy/env.production.example`）。

## 8. 已知限制 / 注意事项

- **迁移无台账**：靠 SQL 幂等重跑全部历史迁移；新增迁移必须全量
  `IF NOT EXISTS` 化，否则重复执行即启动失败。
- **016_sync_events.up.sql 已清理**（2026-08-25）：该迁移建的 `synced_events`
  表全仓零引用（domain/sync 已下线），是早期同步方案的残留；迁移文件已删，
  生产阿里云 PG 中的死表已 DROP。现行同步链路用腾讯云 PG 的
  `oxelia51.synced_events`（TEXT user_id、由 analytics/deploy/migrations/005
  建管），两者同名不同库不同结构，不要混淆。
- **单管理员种子模型**：`EnsureAdmin` 只保证 account_id='oxelia51' 存在，
  其余运维账户由 admin 通过 `/api/admin/users` 创建。
- `admin/handler_linux.go` / `handler_other.go`：/proc 与 statfs 采集仅
  linux 实现，其它平台编译走 other 桩；本地 Windows 开发时统计字段为 0。
- pprof 端点由 `DEBUG_PPROF=true` 显式开启，生产不要开（内存内容泄漏面）。
- Redis 是硬依赖：宕机即服务不可用（启动失败 / 鉴权 fail-close），这是
  有意选择而非缺陷——宁可拒服务不放开鉴权。
