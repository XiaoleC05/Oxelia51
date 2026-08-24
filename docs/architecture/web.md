# Web 应用架构（web/ + packages/shared/）

**撰写依据**：`web/`、`packages/shared/` 实际代码及各自 AGENTS.md。

---

## 1. 技术栈与约束

- **Next.js 16.2.11，Pages Router**（`web/package.json`；无 App Router）+ React 19
- **tRPC 是唯一内部 API 面**（`web/src/server/api/root.ts`）；REST 只保留
  NextAuth、桌面同步、健康检查等少量端点
- **Prisma（PostgreSQL）+ ClickHouse**（消耗统计），都经 `@oxelia51/shared` 访问
- **NextAuth v4** 认证（JWT session strategy）+ 自建邮箱制管理员分层
- 本应用从 langfuse fork 脱钩：原生页面、公共 REST API、EE/cloud/billing
  已删除，仅保留 Oxelia51 自有功能与最小基础面（`web/AGENTS.md`）

**Windows 构建注意**（`web/AGENTS.md`）：不要用 package.json 的 `build`
脚本（依赖 dotenv 与 Unix shell），直跑：

```bash
cd web && DOCKER_BUILD=1 INLINE_RUNTIME_CHUNK=false NEXT_TELEMETRY_DISABLED=1 pnpm exec next build
```

共享包改动必须先 `cd packages/shared && pnpm run build`（tsc 输出 dist，web
直接消费 dist），再构建 web。

## 2. 目录结构

```
web/
├── Dockerfile                  # 多阶段镜像（turbo prune → standalone），见 §7
├── entrypoint.sh               # 容器入口：迁移 → 启动，见 §7
├── next.config.mjs             # output: "standalone"（:102）
└── src/
    ├── env.mjs                 # 全部环境变量的 zod schema（构建期校验）
    ├── pages/                  # Pages Router 路由（§3）
    ├── server/
    │   ├── api/root.ts         # tRPC router 注册表（§4）
    │   ├── api/trpc.ts         # procedure 分层（public/authenticated/project）
    │   ├── auth.ts             # NextAuth 配置（§5）
    │   ├── adminAccessWebhook.ts / adminApiAuth.ts
    │   └── observability/、utils/
    ├── features/
    │   ├── oxelia51/           # Oxelia51 自有功能（本站核心，§2.1）
    │   ├── auth/、auth-credentials/、rbac/、organizations/、projects/、
    │   │   entitlements/、onboarding/、public-api/、dashboard/、filters/ …
    │   │   # 上述为 langfuse 收敛后保留的基础能力
    ├── components/、hooks/、styles/、utils/、constants/、content/
    └── __tests__/
```

### 2.1 `src/features/oxelia51/` 子模块

```
features/oxelia51/
├── components/
│   ├── landing/      # 落地页（LandingPage、DashboardMock、ContributorMarquee 等）
│   ├── docs/         # 文档页组件
│   ├── download/     # 下载页组件
│   ├── workspace/    # 工作台外壳（WorkspaceLayout）
│   ├── admin/        # 管理台组件
│   ├── site/         # 站点公共组件
│   └── *.tsx         # OxCard、FeedbackDialog、TokenTrendChart、ProxyAccessSettings 等
├── content/defaults.ts   # 站点文案硬编码默认值（site_content 表缺省回退）
├── constants.ts、providerDisplay.ts
└── server/           # 全部服务端逻辑（tRPC router + 存储 + 外部客户端）
    ├── oxelia51Router.ts     # 主功能 router（项目作用域统计，654 行）
    ├── workspaceRouter.ts    # 个人工作台（跨项目聚合）
    ├── adminRouter.ts        # 管理台总入口，组合 4 个域子模块
    ├── adminUserRouter.ts / adminOrgRouter.ts / adminStatsRouter.ts / adminFeedbackRouter.ts
    ├── proxyKeyRouter.ts     # 代理网关项目密钥管理
    ├── siteContentRouter.ts  # 站点内容编辑（oxelia51.site_content）
    ├── siteStatsRouter.ts    # 公开统计（GitHub 下载量服务端代理 + 1h 缓存）
    ├── syncRouter.ts         # 云同步状态/吊销（tRPC 侧）
    ├── syncStore.ts          # /api/sync/* 共享存储与鉴权（§6）
    ├── syncTokenUtils.ts     # 同步密钥生成/哈希/冲突比对（纯函数）
    ├── adminAuth.ts          # 邮箱制管理员判定（§5.2）
    ├── goClient.ts           # 调 Go 后台的服务端代理（§5.3）
    ├── feedbackRateLimit.ts  # 反馈提交限流
    ├── userDeletion.ts       # 用户删除
    └── common.ts             # toNumber 等小工具
```

## 3. 页面路由清单（47 条，`src/pages/`，不含 `_app/_document/_error`）

- **站点公开页**（8）：`index`（landing）、`docs/index`、`docs/[...slug]`、
  `download`、`changelog`、`community`、`setup`、`onboarding`
- **认证页 `/auth/*`**（8）：sign-in、sign-up、reset-password、setup-password、
  sso-initiate、error、admin、enterprise-sso-required
- **应用主界面 `/app/*`**（6）：`index`、`overview`、`analytics`、`agents`、
  `providers`、`settings`——个人工作台，数据走 `workspaceRouter`/`oxelia51Router`
- **管理台 `/admin/*`**（2）：`index`、`settings`
- **账户/组织/项目**（langfuse 基础面，12）：`account/settings`、
  `organization/[organizationId]/{index,setup,settings/index,settings/[page]}`、
  `project/[projectId]/{index,setup,settings/index,settings/[page],dashboard/cost,dashboard/tokens}`、
  `project/~/[[...path]]`（demo 项目哨兵路由）
- **API 端点**（11，见 §4.2）

## 4. API 面

### 4.1 tRPC router（15 个，`src/server/api/root.ts`）

基础能力（langfuse 收敛保留）：

| Router | 职责 |
|--------|------|
| `organizations` | 组织 CRUD 与成员资格 |
| `organizationApiKeys` / `projectApiKeys` | 组织/项目级 API key（`features/public-api/`） |
| `projects` | 项目 CRUD |
| `members` | 成员管理（`features/rbac/`） |
| `userAccount` | 当前用户账户 |
| `credentials` | 密码凭证（`features/auth-credentials/`） |
| `onboarding` | 新用户引导 |

Oxelia51 定制（均在 `features/oxelia51/server/`）：

| Router | 职责 |
|--------|------|
| `oxelia51` | 项目作用域统计：用量趋势、模型分布、预算、告警（读 PG `oxelia51.*` + ClickHouse `token_events`） |
| `workspace` | 个人工作台：跨全部组织/项目聚合 token_events/daily_stats；明细成本按 model_pricing 现算 |
| `sync` | 云同步状态查询、设备列表、同步密钥吊销（只读 + 吊销，写入走 `/api/sync/*`） |
| `oxelia51Admin` | 管理台总入口：`whoami` + IP 白名单 CRUD + 组合 adminUser/adminOrg/adminStats/adminFeedback 四个子模块，均经 `goClient` 转发 Go 后台 |
| `proxyKey` | 代理网关项目密钥的生成/列表/删除（明文仅创建时返回一次） |
| `siteContent` | 站点内容读写：`oxelia51.site_content`（key→JSONB）；读公开、写仅超级管理员 |
| `siteStats` | 公开站点统计：服务端拉 GitHub Releases 下载量，模块级内存缓存 1 小时 |

procedure 分层（`src/server/api/trpc.ts`）：`publicProcedure` →
`authenticatedProcedure`（登录）→ `protectedProjectProcedure`（项目成员），
Oxelia51 管理另有 `adminProcedure`/`superAdminProcedure`（§5.2）。

### 4.2 REST 端点（11 条，`src/pages/api/`）

| 端点 | 用途 |
|------|------|
| `auth/[...nextauth].ts` | NextAuth 主入口 |
| `auth/signup.ts` / `signup-verify.ts` | 邮箱注册 + OTP 验证 |
| `auth/check-sso.ts` / `add-sso-config.ts` | SSO 域名检查 / 配置 |
| `sync/login.ts` / `sync/upload.ts` / `sync/download.ts` | 桌面端云同步（§6） |
| `project/[projectId]/visit.ts` | 项目访问记录 |
| `public/health.ts` | 生产健康检查（唯一保留的 public REST） |
| `trpc/[trpc].ts` | tRPC 入口 |

## 5. 认证体系

### 5.1 NextAuth（站点用户，`src/server/auth.ts`，约 1100 行）

- **Credentials provider**：邮箱 + bcrypt 密码；账户不存在时先做
  `hashPassword` 再拒绝，拉平时序防用户枚举（auth.ts:106-110）
- **Email provider（OTP）**：6 位数字码（`randomInt(100000,1000000)`），
  `maxAge: 3 * 60`（3 分钟），主要用于密码重置；自定义
  `useVerificationToken` 先查后删，把「无效/过期/被预取」从 Prisma P2025
  错误降级为普通失败，避免刷错误日志（auth.ts:670-724）
- **OAuth 全家桶 env-gated**：Google/GitHub/GitLab/Azure AD/Okta/Auth0/
  Keycloak/Cognito/WorkOS/WordPress/Authentik/OneLogin/JumpCloud +
  自定义 SSO（`AUTH_*` 环境变量存在才注册）+ 多租户 SSO（按域名强制）
- session strategy = JWT；`session` 回调每次查库组装组织/项目/RBAC 视图
- 其它加固：`redirect` 回调防 malformed callbackUrl 打 500；邮箱 OTP 登录
  只允许已存在用户 + 随机延迟防枚举；注册可由 `NEXT_PUBLIC_SIGN_UP_DISABLED` /
  `AUTH_DISABLE_SIGNUP` 关闭

### 5.2 管理员分层（邮箱制，`server/adminAuth.ts`）

与 langfuse 组织/角色体系**完全分离**，统一走邮箱名单：

- **超级管理员**：仅 `OXELIA_SUPER_ADMIN_EMAIL`；所有写操作（白名单增删、
  反馈流转等）走 `superAdminProcedure`
- **管理员**：`OXELIA51_ADMIN_EMAILS` 逗号名单（超管恒为管理员）；
  **空名单 = 除超管外无人是管理员（fail-closed）**
- `whoami` 暴露给任何登录用户，前端据此控制管理台入口显隐

### 5.3 调 Go 管理后台（`server/goClient.ts`）

管理台 tRPC 过程不直连数据库，而是作为**服务端代理**调阿里云 Go 后台：

- `getGoToken()`：用 `OXELIA51_ADMIN_ACCOUNT`/`OXELIA51_ADMIN_PASSWORD`
  换 Go JWT，**凭证只在服务端**，模块级缓存、提前 60s 续期
- `goFetch()`：带 `Authorization: Bearer <go-jwt>` 转发；并用
  `X-Oxelia51-Client-IP` 透传浏览器真实出口 IP（优先 nginx 的
  `X-Real-IP`，XFF 首段仅开发回退）——Go 侧 IP 白名单校验的是最终用户
  IP 而非 web 服务器 IP

### 5.4 桌面同步密钥（`server/syncTokenUtils.ts`）

- 格式 `oxs_` + 48 hex（24 字节随机）；**明文仅 `/api/sync/login` 下发一次**，
  库中只存 sha256（`oxelia51.sync_tokens`），`revoked_at` 置位即吊销
- 与 Go 后台的 `ox_` 代理密钥、NextAuth session 是**三套独立凭证**

## 6. 数据访问

### 6.1 PostgreSQL

- **Prisma schema（public schema）**：`packages/shared/prisma/schema.prisma`，
  收敛后 18 个 model——NextAuth 四表（Account/Session/User/VerificationToken）
  + 组织/项目 RBAC（Organization/Project/两种 Membership/MembershipInvitation）
  + ApiKey + AuditLog + 少量 langfuse 遗留（Dataset 系列、TraceSession、
  CronJobs、SsoConfig、Survey），因存活代码仍引用而保留
- **`oxelia51` schema（raw SQL）**：synced_events、sync_tokens、site_content、
  daily_stats、budget_configs、alert_logs、alert_channels、model_pricing、
  exchange_rates 等。这些表**不在 Prisma schema 内**，由
  `analytics/deploy/migrations/*.sql` 建管；web 一律参数化
  `$queryRaw`/`$executeRaw` 访问，禁止字符串拼接
  （`syncStore.ts` 头注释；`oxelia51Router.ts` 等）

### 6.2 ClickHouse

- 经 `queryClickhouse`（`@oxelia51/shared/src/server`）只读访问
  `oxelia51.token_events`；写入只发生在 proxy-gateway（云端模式）
- `token_events.cost_usd` 恒 0（成本由 C++ 引擎后算进 `daily_stats`），
  明细级成本在 web 侧用 token × `model_pricing` 现算
  （`workspaceRouter.ts` 头注释、`syncRouter.ts` 同口径）

### 6.3 云同步存储合约（`server/syncStore.ts`）

- **upload**：`event_id` 主键 `ON CONFLICT DO NOTHING` 幂等去重；被跳过的行
  回查比对内容，不一致才计 `conflicts`（区分「同内容重传」与「真冲突」）；
  单批上限 2000 条 × 15 列绑定参数，低于 PG 65535 上限无需分片
- **download**：`seq > after` 增量游标，升序，排除本设备，单页 2000；
  `hasMore = 恰好满页`
- BIGINT/BIGSERIAL 经 `$queryRaw` 出来是 BigInt，出参统一 `toNumber` 转换

## 7. packages/shared 的角色

`@oxelia51/shared` 是 web 唯一的数据/服务依赖层（其 AGENTS.md 是权威清单）：

- `prisma/schema.prisma` + `prisma/migrations/`：**已有迁移一律不动**
  （生产已应用，改动破坏 checksum）；**新增 migration 前必须人工审查是否
  夹带 DROP**（schema 移除的表仍存于生产库，属预期）
- 已知坑：迁移 `20260806070003_add_oxelia51_alert_channel_verification`
  直接 ALTER `oxelia51.alert_channels`（该表由 C++ 引擎建管），全新库上
  `prisma migrate deploy` 会失败；变通：先手工建空表再 migrate deploy
- `src/server/` 保留服务：`repositories/` + `db.ts`（Prisma + ClickHouse
  读路径）、`auth/`、`redis/`（仅连接工具，队列已删）、`clickhouse/`、
  `queries/clickhouse-sql/`（filter/CTE 查询构建器）、`ingestion/`（仅
  ingestionAttribution）、`instrumentation/`、`services/email/`（SES/SMTP
  + 存活模板）、`utils/`、`logger.ts`、`env.ts`
- 导出入口：`@oxelia51/shared`（前端安全）/ `/src/server`（服务端 barrel）/
  `/src/db`（Prisma client，**不得进客户端 bundle**）/ `/src/env` /
  `/encryption` / `/src/server/test-utils`（仅测试）
- 构建：纯 `tsc` → `dist/`；`package.json#exports` 全指向 dist

## 8. 构建与部署

### 8.1 Dockerfile（`web/Dockerfile`，200 行）

多阶段（全 `--platform` 参数化）：

```
alpine（补丁升级）→ build-base（turbo@2.10.5 + pnpm@11.10.0）
                 → runtime-base（删 corepack/yarn）
migrate-builder：golang:1.26 自编译 golang-migrate（仅 clickhouse tag，
                 避免预编译二进制携带多余 driver 的 CVE）
pruner：  turbo prune --scope=web --docker
builder： pnpm install --frozen-lockfile → turbo run build --filter=web
          （pnpm_config_verify_deps_before_run=false：规避 pnpm 11
            并发 auto-install 竞态，Dockerfile:56-60 注释）
runner：  standalone 产物 + packages/shared 的 prisma/clickhouse 目录
          + entrypoint.sh + cleanup.sql；非 root（nextjs:1001）；
          全局装 prisma@6.19.3 后删除 npm/corepack
```

### 8.2 容器入口（`web/entrypoint.sh`）

启动顺序：组装/校验 `DATABASE_URL` → 校验 `CLICKHOUSE_URL` →
`prisma db execute cleanup.sql` → `prisma migrate deploy`（可被
`LANGFUSE_AUTO_POSTGRES_MIGRATION_DISABLED=true` 跳过）→ ClickHouse 迁移
`packages/shared/clickhouse/scripts/up.sh`（可被
`LANGFUSE_AUTO_CLICKHOUSE_MIGRATION_DISABLED` 跳过）→ `exec "$@"` 启动
`web/server.js`。迁移失败时打印密码未 URL 编码的排查提示。

### 8.3 CI 管线（`.github/workflows/push-to-acr.yml`）

push master 且 `web/**`/`packages/**`/lockfile 变更时触发：docker build
（注入 umami 的 `NEXT_PUBLIC_*` build-arg）→ tag 为
`$ACR_REGISTRY/oxelia51/langfuse-token:latest` → 推阿里云 ACR。腾讯云侧由
compose 拉镜像运行（`deploy/tencent-cloud/docker-compose.langfuse.yml`）。

## 9. 关键设计决策与取舍

1. **tRPC 唯一内部 API 面**：REST 只剩认证/同步/健康检查等必须用稳定 HTTP
   合约的端点（桌面 sidecar 不跑 tRPC）。
2. **管理台不落库、全部代理到 Go 后台**：web 进程不持有后台 PG 凭据，权限
   边界清晰；代价是管理台可用性依赖 Go 后台与 `OXELIA51_ADMIN_ACCOUNT`
   凭证配置。
3. **邮箱制管理员分层**替代 langfuse RBAC：平台管理是运营动作而非租户内
   角色，名单制 fail-closed 更简单也更安全。
4. **`oxelia51` schema 走 raw SQL 而非 Prisma model**：表由 C++ 引擎的迁移
   建管，纳入 Prisma 会造成双写 schema 真相；代价是类型靠手写 DTO。
5. **同步写路径走 REST、读路径走 tRPC**：写是 sidecar 的对外合约（稳定、
   可版本化），读是站内 UI（享受 tRPC 类型安全）。
6. **siteStats 用内存缓存 + stale 兜底**：GitHub 匿名限额 60 次/小时/IP，
   客户端直连必被限流；单机缓存可接受（数据本非强一致），从未成功则返回
   null，前端不编造兜底数字。

## 10. 已知限制 / 注意事项

- **Windows 本地构建**必须绕过 package.json `build` 脚本（见 §1）。
- engines warning（want node 24 / current 22）可忽略（`web/AGENTS.md`）。
- `session` 回调每次请求都查库组装组织/项目树——langfuse 遗留设计，
  用户-组织-项目规模大时是放大点。
- `siteStatsRouter` 缓存是进程内内存：多实例各自缓存，重启清零。
- langfuse 命名残留遍布环境变量（`LANGFUSE_*`、`NEXT_PUBLIC_LANGFUSE_*`）、
  镜像名与容器名，改配置时注意不要被名字误导。
- 全新部署的 Prisma 迁移有 alert_channels 前置坑（见 §7）。
