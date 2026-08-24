# data-flow — 数据流与存储总图

本文档把四个子系统（desktop / proxy-gateway / analytics / web+backend）串成一条数据链：Token 事件从桌面工具产生，到落库、同步、聚合、展示的全生命周期，以及三处迁移的治理边界。各子系统内部细节见对应篇目（[proxy-gateway.md](proxy-gateway.md)、[analytics.md](analytics.md)、[desktop.md](desktop.md)）。

---

## 1. 存储全景

Oxelia51 的数据分散在**四库三机**，每库有唯一写入权威：

| 存储 | 位置 | 内容 | 写入权威 |
|------|------|------|----------|
| 桌面 SQLite `~/.oxelia51/token_events.db` | 用户本机 | `token_events`（本地账本）+ `settings` KV | proxy-gateway 本地模式（sidecar） |
| 腾讯云 PostgreSQL（`:5434`，langfuse-postgres 容器） | 腾讯云 | `public`：users 等 Langfuse 基础表 + 遗留表；`oxelia51` schema：daily_stats / synced_events / sync_tokens / budget_configs / alert_* / model_pricing / exchange_rates / engine_state / site_content | web（Prisma/$queryRaw）、analytics 引擎 |
| 腾讯云 ClickHouse（`:8123`/`:9000`） | 腾讯云 | `oxelia51.token_events`（云端账本）；Langfuse 遗留表（traces/observations/scores 等） | proxy-gateway 云端模式 |
| 阿里云 PostgreSQL（`:5432`，与 Go 后端同机） | 阿里云 | Go 后端自有表：运维账号、proxy_keys、ip_whitelist、工具注册、站点设置等（`backend/migrations/`） | backend（Go） |

拓扑依据：`deploy/README.md` 架构图与 `backend/config/config.go`（`DB_HOST` 默认 localhost）。两台服务器之间靠 **SSH 隧道**连接：阿里云的网关经 `token-tunnel.service` 由本机 `127.0.0.1:9001` 访问腾讯云 ClickHouse；web（`127.0.0.1:3000`，跑在腾讯云 Langfuse compose 里）由阿里云 nginx 反代。

### 1.1 各库表清单（按写入权威归类）

**桌面 SQLite**（schema 见 `proxy-gateway/internal/recorder/sqlite.go` 启动建表）：

- `token_events`：event_id 主键，project/session/provider/agent/model、三套 token 字段（计价 prompt / 原始 total / 缓存细分）、duration_ms、本地时区时间戳字符串、api_key_hash、partial；
- `settings`：KV 表——theme、pricing、budgets、custom_providers、widget_fields/widget_pos、agent_aliases、usd_cny_rate、sync_token/sync_device/sync_up_ts/sync_dl_seq/sync_last/sync_enabled。

**腾讯云 PG `oxelia51` schema**（建表权威 `analytics/deploy/migrations/`）：

- 分析面：`daily_stats`（引擎 UPSERT）、`engine_state`（游标）、`model_pricing`、`exchange_rates`、`budget_configs`、`alert_channels`、`alert_logs`；
- 同步面：`synced_events`（event_id 主键 + `seq BIGSERIAL` 下载游标 + `synced_at`）、`sync_tokens`（sha256 哈希、revoked_at 吊销、关联 Langfuse `public.users(id)`）；
- 内容面：`site_content`（web 管理台「内容编辑」）。

**腾讯云 CH**：`oxelia51.token_events`（`MergeTree`，`PARTITION BY toYYYYMM(timestamp)`，`ORDER BY (project_id, timestamp)`，15 列含 agent 与缓存细分；建表/补列由 Go `ClickHouseWriter` 启动时幂等执行，`proxy-gateway/internal/recorder/clickhouse.go`）。

**阿里云 PG**（建表权威 `backend/migrations/`，Go 后端自有）：users/运维账号（001/003/009/013）、工具注册（002/004）、hero_images/carousel_settings（005/006）、articles（007/008）、developer_profile（010）、login_logs（011）、site_settings（012）、ip_whitelist（014）、proxy_keys（015，网关鉴权用，仅存 sha256）、synced_events（016，疑似残留，见 §4）。

```
┌──────────── 用户本机 ────────────┐
│ 桌面工具 → sidecar(:17800)       │
│              └→ SQLite 账本      │
│ 桌面 UI ← /api/* (localapi)      │
└───────┬──────────────────────────┘
        │ 登录后云同步 /api/sync/*
        ▼
┌──────────── 阿里云 ──────────────┐        ┌──────────── 腾讯云 ────────────────┐
│ nginx oxelia51.com               │        │ web (Next.js, :3000)               │
│  ├ /api/proxy/* → 网关 :9090 ────┼──SSH──→│ ClickHouse ← 云端 token_events     │
│  ├ /api/sync|auth|trpc → web ────┼──隧道─→│ PG :5434 ← public + oxelia51       │
│  └ /api/* → Go 后端 :8080        │        │ analytics 引擎（timer 5min）        │
│ Go 后端 → 本地 PG :5432          │        │   CH 读 → PG daily_stats 写        │
└──────────────────────────────────┘        └────────────────────────────────────┘
```

## 2. Token 事件全生命周期

一条事件有两条互补的路径：**本地优先路径**（始终成立）与**云端路径**（直连云代理 / 登录后同步）。

### 2.1 产生与本地落账

1. 桌面 AI 工具（Claude Code / Cursor 等）把 base URL 指向 `http://127.0.0.1:17800/api/proxy/<slug>/`；
2. sidecar（proxy-gateway 本地模式）转发到真实上游，从 SSE/JSON 响应提取 usage（`forward.go`），缓存 token 按 1.25×/0.1× 折算计价输入，构造 `TokenRecord`（`event_id = uuid`）；
3. `ChannelRecorder` 异步批量写入本地 SQLite `token_events`（`INSERT OR IGNORE`，event_id 主键）；
4. 桌面 UI 轮询 localapi `/api/overview` 等接口展示，成本在本地按用户定价/内置参考价计算（`settings.go costOf`）。

### 2.2 云同步（多设备合并）

登录后（`POST /api/sync/login` 签发长期 token，存 sidecar settings）：

- **上传**：sidecar 按游标 `sync_up_ts` 取本地新事件（≤2000 条/批）→ `POST /api/sync/upload`（`web/src/pages/api/sync/upload.ts`）→ 参数化多行 INSERT 进腾讯云 PG `oxelia51.synced_events`，`ON CONFLICT (event_id) DO NOTHING` 去重；被跳过的行做内容比对计 `conflicts`（`syncTokenUtils.ts countContentConflicts`，正常恒 0）。
- **下载**：sidecar 按游标 `sync_dl_seq` 分页拉**其他设备**的事件（`seq > after AND device_id <> 本机`）→ `GET /api/sync/download` → 本地 `INSERT OR IGNORE` 合并（`sync.go mergeCloudEvents`）。
- 双游标拆分的原因（`sync.go` 注释）：旧版上下行共用一个按事件 ts 推进的游标，对端设备晚上传的历史事件 ts 早于游标会被永久漏掉。

注意：**云同步的事件只进 PG `synced_events`，不进 ClickHouse**，也不参与 analytics 引擎聚合——它是「多设备账本合并」面，供 web `/app` 设置页「同步账本」汇总展示；云端分析链路的数据来源是 §2.3 的直连云代理。

### 2.3 云端落账与聚合

1. 客户端直连云端代理 `https://oxelia51.com/api/proxy/<slug>/`（携带代理密钥，云端模式 `:9090`）；
2. 网关鉴权（`proxy_keys`，阿里云 PG）→ 转发上游 → 提取 usage → `ChannelRecorder` → `ClickHouseWriter` 经 SSH 隧道（`127.0.0.1:9001`）写入腾讯云 CH `oxelia51.token_events`；
3. analytics 引擎每 5 分钟（systemd timer）从游标 `engine_state.last_processed` 起分块聚合 CH → 计价（`model_pricing`）→ 累加 UPSERT 进 PG `oxelia51.daily_stats` → 异常检测/预算检查写 `alert_logs` → 邮件/Webhook 外发；
4. web 端读 `daily_stats` 展示云端统计（`web/src/features/oxelia51/server/oxelia51Router.ts`、`adminStatsRouter.ts` 等）。

```
桌面工具 ──→ sidecar ──→ SQLite ──→ localapi ──→ 桌面 UI
              │ 登录后
              ▼ upload/download（event_id 去重，seq/ts 双游标）
        web /api/sync/* ──→ PG oxelia51.synced_events ──→ web /app 同步账本

云端客户端 ──→ 云网关 :9090 ──→ CH token_events ──→ analytics ──→ PG daily_stats ──→ web 统计页
                  │                                    │
            proxy_keys 鉴权                      alert_logs → 邮件/Webhook
            (阿里云 PG)
```

## 3. 同步协议要点

- **认证**：`sync_tokens` 表只存 `sha256(token)`，明文仅 login 时下发一次；`revoked_at` 置位即吊销（web 设置页「断开」）。token 格式 `oxs_` + 48 hex（`syncTokenUtils.ts`）。
- **login 防时序枚举**：账户不存在/SSO 无密码/密码错误统一 401 文案，且对 dummy bcrypt hash 也跑一次 compare 拉平响应时差（`login.ts`）。
- **游标**：上传游标 = 本地事件时间戳（`sync_up_ts`）；下载游标 = 云端单调序号 `seq`（`sync_dl_seq`，BIGSERIAL）。下载单页 2000 条，桌面端最多连拉 5 轮。
- **幂等与去重**：`event_id` 全链路唯一约束（SQLite 主键、PG 主键），重传安全；「去重跳过 + 内容比对」构成防御性冲突检测。
- **字段契约**：事件 13 个数据字段两端对齐（含 2026-08 新增的 `cache_read/cache_creation`，迁移 008 补列）；BIGINT 经 Prisma `$queryRaw` 出来是 BigInt，序列化前统一 `toNumber`。

## 4. 迁移治理：三处迁移的边界

| 迁移目录 | 管辖库 | 纪律 |
|----------|--------|------|
| `backend/migrations/` | 阿里云 PG（Go 后端自有库） | 只含后端自有表（users/tools/proxy_keys/ip_whitelist 等）；**不含也不应含 `oxelia51.` schema 对象**（已验证无引用） |
| `analytics/deploy/migrations/` | 腾讯云 PG 的 `oxelia51` schema | oxelia51 schema 的唯一权威；全部幂等（IF NOT EXISTS / ON CONFLICT） |
| `packages/shared/prisma/migrations/` | 腾讯云 PG 的 `public` schema（Langfuse 沿袭 + web 自有） | 已应用文件一律不动（生产 checksum）；新增迁移必须人工审查是否夹带 DROP（`packages/shared/AGENTS.md`） |

**历史教训**：`packages/shared/prisma/migrations/20260806070003_add_oxelia51_alert_channel_verification` 越界 `ALTER TABLE oxelia51.alert_channels`（该表由 analytics 迁移建管），导致全新数据库 `prisma migrate deploy` 失败；文件已被生产应用不能修改，变通是全新部署先手工建空表。结论：**oxelia51 schema 的迁移只放 `analytics/deploy/migrations/`**。

另有一处待澄清的冗余：`backend/migrations/016_sync_events.up.sql` 在阿里云 PG 建了 `synced_events` 表（`user_id BIGINT`、无 `seq` 列），但当前 backend Go 代码（`backend/internal/`）**没有任何对 `synced_events` 的引用**——现行同步链路用的是腾讯云 PG 的 `oxelia51.synced_events`（`user_id TEXT` 关联 Langfuse users、带 `seq` 游标）。016 表疑为早期设计的残留，删表需架构裁定。

## 5. Langfuse 遗留表

本项目 fork 自 Langfuse，其原生表仍在生产库中但**不再使用**：

- **PG `public`**：`packages/shared/prisma/schema.prisma` 已收敛为 Oxelia51 最小集（NextAuth + 组织/项目 RBAC + ApiKey + AuditLog），另保留少量 web 存活代码仍引用的遗留 model（Dataset 系列、TraceSession、SsoConfig 等）；已从 schema 移除的表仍存在于生产库。
- **ClickHouse**：Langfuse 的 traces/observations/scores 等表（`packages/shared/clickhouse/migrations/`）与 Oxelia51 自有的 `oxelia51.token_events` 并存。

**为何不删**：生产安全。`packages/shared/AGENTS.md` 明确——已从 schema 移除的表留在库中属预期，任何新迁移夹带 DROP 都必须人工拦截；对不再使用的表，「留着不读不写」的代价远低于误删生产数据的风险。清理是显式的、逐表的架构决策（先例：`20260723150000_drop_legacy_tracing_tables` 这类专项删除迁移）。

## 6. 口径与一致性要点

- **token 双口径**（全链路通用）：`prompt_tokens` = 计价输入（缓存折算后），`total_tokens` = 原始消耗（含缓存）；详见 [proxy-gateway.md](proxy-gateway.md) §4.3。展示用 total、算钱用 prompt。
- **定价三处同源**：云端 `model_pricing`（迁移 003/006 seed）、桌面内置参考价（`localapi/settings.go defaultPricing`）、引擎兜底（`pricing.cpp`）——共有模型价格有 Go 测试防漂移（`TestDefaultPricingMatchesSeed`）。
- **汇率两端同兜底**：桌面 `rate.go` 与云端 `exchange_rates` 的兜底值都是 7.2，都不做伪精确。
- **时区**：本地 SQLite 时间戳是本地时区字符串；CH `timestamp DateTime64(3)` 与 PG `TIMESTAMPTZ` 是 UTC 口径；同步上传时本地时间转 RFC3339 UTC（`sync.go`），下载转回本地。聚合边界（analytics 游标、localapi 趋势）各自处理毫秒/时区坑，改动这些代码前先读对应文件头注释。

## 7. 读路径汇总（谁消费哪份数据）

| 消费方 | 数据源 | 读取方式 |
|--------|--------|----------|
| 桌面主界面/悬浮卡片 | 本地 SQLite | localapi `/api/overview`、`/api/providers`、`/api/agents` 等（HTTP 轮询） |
| 桌面设置页 | 本地 SQLite settings | localapi `/api/settings`、`/api/pricing*` |
| web `/app` 同步账本 | 腾讯云 PG `synced_events` | tRPC `sync` router（`syncRouter.ts`） |
| web 统计/工作区页 | 腾讯云 PG `daily_stats` + CH `token_events` | tRPC（`oxelia51Router.ts`、`workspaceRouter.ts` 等，经 `@oxelia51/shared`） |
| web 管理台 | 腾讯云 PG（oxelia51 schema 各配置表 + `alert_logs`） | tRPC `oxelia51Admin` / `adminStatsRouter.ts` |
| analytics 引擎 | CH `token_events`（读）→ PG `daily_stats`/`alert_logs`（写） | libcurl HTTP + libpq |
| 云网关 | 阿里云 PG `proxy_keys`（鉴权） | pgx 连接池，sha256 匹配 |

同一指标可能有两条展示链路（如桌面成本 = 本地 pricing 现算，web 成本 = 引擎预聚合），口径对齐靠 §5 的「定价三处同源」与双 token 口径约定维持。

## 8. 失败路径与韧性

数据链每一环都有明确的降级/恢复策略，汇总如下（细节见各篇）：

| 环节 | 失败表现 | 兜底 |
|------|----------|------|
| sidecar → SQLite | 批写失败 / channel 满 | 写 `~/.oxelia51/fallback.jsonl`（完整 JSONL，可回收） |
| 云网关 → CH | 连接或批写失败 | `RecoveringWriter` ≤60s 节流重建、热切换；恢复窗口内批次丢弃（不阻塞请求） |
| 同步 upload/download | 网络/5xx | 游标不推进，下次手动/自动同步重试；event_id 去重保证重传幂等 |
| analytics 聚合 | 单块 UPSERT 失败 | 游标停在上一成功块，下个 5 分钟周期续跑；24h 分块防积压滚雪球 |
| analytics 计价 | `model_pricing` 读取失败 | 内置兜底定价（4 个模型），成本降级但不中断 |
| 告警外发 | SMTP/Webhook 失败 | 只记日志，告警仍标 sent（宁丢不轰炸） |
| 桌面更新检查 | GitHub API 失败/限流 | 静默忽略，不影响任何功能 |

共同原则：**记账链路永不阻塞代理转发，统计链路永不阻塞记账链路**；所有重试安全都建立在 event_id 幂等与游标精确（毫秒）推进之上。
