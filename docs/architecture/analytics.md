# analytics — C++ 分析引擎（token-analytics）

**模块路径**：`analytics/` | **语言**：C++17 | **入口**：`analytics/src/main.cpp`

离线批处理引擎：从 ClickHouse 读 token 事件，聚合成日统计并计价写入 PostgreSQL，再做异常检测、预算检查与告警外发。由 **systemd timer 每 5 分钟**触发一次 oneshot 运行，非常驻进程。

---

## 1. 模块职责

```
ClickHouse (oxelia51.token_events)          PostgreSQL (腾讯云, oxelia51 schema)
        │ 读取原始事件                            ▲ 写入聚合/告警/状态
        ▼                                        │
  token-analytics（每 5 分钟 oneshot）───────────┘
        │
        ▼ 外发
  SMTP 邮件 / Webhook（alert_channels 配置的通道）
```

- **读**：ClickHouse HTTP 接口（默认 `127.0.0.1:8123`），不走原生 TCP 协议；
- **写**：libpq 直连腾讯云 PostgreSQL（默认 `127.0.0.1:5434`，即 langfuse-postgres 容器）的 `oxelia51` schema；
- **外发**：libcurl 发 SMTP 邮件与 Webhook。

非职责：在线请求路径（proxy-gateway 负责）、成本展示（web/桌面端直接读 `daily_stats`）。

## 2. 目录结构

```
analytics/
├── src/
│   ├── main.cpp            ← 入口：参数解析、连接建立、Step 1-8 流水线编排
│   ├── aggregator.{h,cpp}  ← Step 1：CH 聚合查询（按 project+model+date 分组，分块）
│   ├── pricing.{h,cpp}     ← Step 2：成本计算（PG model_pricing 表 + 内置兜底）
│   ├── detector.{h,cpp}    ← Step 4：异常检测（同比基线 × 阈值）
│   ├── alerter.{h,cpp}     ← Step 8：告警外发（SMTP 品牌邮件 + Webhook JSON）
│   ├── db/
│   │   ├── clickhouse.{h,cpp}  ← CH HTTP 客户端（libcurl，Basic Auth，TSV 解析）
│   │   └── postgres.{h,cpp}    ← PG 客户端（libpq 封装，UPSERT/告警/预算/游标）
│   └── util/log.h          ← 日志
├── CMakeLists.txt          ← 构建：libpq + libcurl，-Wall -Wextra，C++17
├── Dockerfile              ← 本地构建镜像（禁止服务器编译，见 §6）
└── deploy/
    ├── token-analytics.service ← systemd oneshot 单元（--interval 5）
    ├── token-analytics.timer   ← 每 5 分钟触发（OnUnitActiveSec=5min）
    └── migrations/             ← oxelia51 schema 迁移（002-008，见 §7）
```

## 3. 流水线（main.cpp，Step 1-8）

每次运行按序执行；除 Step 1 聚合失败直接退出外，各步失败只记日志不中断后续步骤。

| Step | 内容 | 代码位置 |
|------|------|----------|
| 1 | 从游标后聚合 CH 事件（24h 分块追平积压，逐块 UPSERT + 推进游标） | `aggregator.cpp` + `main.cpp` 循环 |
| 2 | 按 `model_pricing` 逐事件组计算 `cost_usd`（失败则成本置 0 继续） | `pricing.cpp` |
| 3 | （已并入 Step 1 循环）批量 UPSERT `daily_stats` | `postgres.cpp upsertDailyStats` |
| 4 | 异常检测：当日用量 vs 昨日同 project+model 基线 | `detector.cpp` |
| 5 | 预算检查：本月累计成本（`daily_stats` 汇总）≥ 预算 × 阈值 → 告警 | `main.cpp` |
| 6 | 游标状态汇总日志（实际推进已在 Step 1 逐块完成） | `main.cpp` |
| 7 | 确保今日汇率记录存在（无则写兜底 7.20） | `postgres.cpp ensureTodayExchangeRate` |
| 8 | 分发 pending 告警：邮件 + Webhook，然后标 sent | `alerter.cpp` |

`--dry-run` 跳过全部写操作（Step 1 游标只在内存推进）；`--interval N` 控制**无游标时**的首次回看窗口（默认 5 分钟，与 timer 周期对齐）。

### 3.1 Step 1 详解：聚合、分块与游标（`aggregator.cpp`）

- **起点**：`engine_state.last_processed`（PG 里的游标）；为空时用 `now() - INTERVAL 5 MINUTE`。
- **毫秒精度**：游标比较用 `parseDateTime64BestEffort(..., 3)`——`parseDateTimeBestEffort` 会截断小数秒，导致恰在游标时刻的边界行每轮被重复聚合、`daily_stats` 重复累加（代码注释记载的历史 bug）。
- **分块 catch-up**：单块窗口上限 `kChunkHours = 24` 小时，单次运行最多 `kMaxChunksPerRun = 40` 块（≈40 天积压），剩余留给下个周期。每块独立 UPSERT + 推进游标，单块失败只损失该块进度（游标停在上一成功块），下个 timer 周期自动重试——避免「积压越长单次查询越重 → 失败 → 游标不动 → 积压滚雪球」。
- **护栏**：`chunkMax <= cursor`（游标未前进）时中止追平，防解析精度回归造成死循环重复计数。
- **聚合维度**：`project_id + model + toDate(timestamp)`，求和 prompt/completion/total tokens、duration_ms、请求数。结果格式 `TabSeparatedWithNames`，单行脏数据跳过不阻断整批。

### 3.2 Step 3：UPSERT 幂等（`postgres.cpp upsertDailyStats`）

```sql
INSERT INTO oxelia51.daily_stats (...) VALUES (...)
ON CONFLICT (project_id, model, date) DO UPDATE SET
  prompt_tokens = daily_stats.prompt_tokens + EXCLUDED.prompt_tokens, ...
```

**累加模式**而非覆盖：与「游标精确推进 + 单块事务」配合，同一块重试不会产生重复计数之外的中间态——块内事务失败则整体回滚、游标不动，重跑时该块完整重算再累加。注意这意味着**同一 (project, model, date) 被两个块各加一次会重复**——正确性完全依赖游标的毫秒精度（§3.1）。

### 3.3 Step 4-5：异常检测与预算

- 异常检测（`detector.cpp`）：配置来自 `projects.metadata->'oxelia51'->'anomaly'`（JSONB 路径查询，`postgres.cpp getAnomalyConfigs`）；无配置的 project 用默认值（enabled=true，spike_ratio=3.0）。基线 = 昨日同 project+model 的 `total_tokens` 之和（`clickhouse.cpp getYesterdayUsage`）；基线为 0 时用绝对阈值 10000。命中即写 `alert_logs`（severity=warning）。
- 预算检查：从 `budget_configs`（enabled=true）读预算，本月成本从 `daily_stats` 汇总（**按 USD 成本而非 token 数**——代码注释记载的修正），≥ `budget_usd × threshold`（默认 0.8）即告警。

### 3.4 Step 8：告警外发（`alerter.cpp`）

- 从 `alert_logs` 取 `status='pending'` 的告警，按 project 查 `alert_channels`：email 通道要求 `verified=true`，webhook 通道直接 POST JSON。
- **SMTP**：解析 Nodemailer 格式 URL（`smtps://user:pass@host:465`，凭据百分号解码、按最后一个 `@` 分割以兼容邮箱用户名含 `@`）；RFC 5322 multipart/alternative（纯文本 + 品牌 HTML，与 web 端 OxeliaEmailLayout 风格一致）。QQ 邮箱兼容性：`CURLOPT_SASL_IR` 一次性发送 AUTH 凭据（默认分步 PLAIN 会被拒）。
- **安全处理**：日志只记 host:port（`extractHostPort` 脱敏，不含 user:pass）；邮件头字段剔除 `\r\n` 防 CRLF 注入（`sanitizeHeader`）；HTML 正文全量转义（`htmlEscape`）；Webhook JSON 手工转义（`jsonEscape`）。
- **标 sent 策略**：无论外发是否成功都标记 sent（站内通知已写入），避免重复轰炸；外发失败仅记日志。

## 4. 数据存储

写入方（PG `oxelia51` schema，表结构见 `deploy/migrations/002_analytics_tables.sql`）：

| 表 | 用途 | 写入者 |
|----|------|--------|
| `daily_stats` | 日聚合（PK: project+model+date，累加 UPSERT） | Step 3 |
| `alert_logs` | 告警记录（pending → sent） | Step 4/5 写、Step 8 更新 |
| `alert_channels` | 通知通道（email/webhook，per-project） | web 管理端 |
| `budget_configs` | 预算与阈值 | web 管理端 |
| `model_pricing` | 模型单价（USD/1M tokens） | 迁移 seed + 管理端 |
| `exchange_rates` | USD→CNY 日汇率（兜底 7.20） | Step 7 / 定时任务 |
| `engine_state` | 引擎游标 KV（`last_processed`） | Step 1 逐块推进 |

读取方：ClickHouse `oxelia51.token_events`（由 proxy-gateway 云端模式写入，表结构见 [proxy-gateway.md](proxy-gateway.md) §5）。

环境变量：`CH_ADDR`/`CH_USER`/`CH_PASS`（后两者回退 `CLICKHOUSE_USER`/`CLICKHOUSE_PASSWORD`）、`PG_CONNSTR`（或由 `POSTGRES_*` 拼装）、`SMTP_CONNECTION_URL`、`EMAIL_FROM_ADDRESS`。service 单元经 `EnvironmentFile=-/opt/langfuse/.env` 加载。

## 5. 外部依赖

- **libpq**：PostgreSQL 协议（`pkg-config libpq`）；
- **libcurl**：ClickHouse HTTP、SMTP、Webhook 三处共用；
- 刻意**不用** clickhouse-cpp 原生客户端：HTTP 接口（8123）减少依赖、便于穿隧道/调试（`CMakeLists.txt` 注释）。
- PG 侧查询全走 `PQexecParams` 参数化；CH 侧 HTTP 接口不支持参数绑定，用 `escapeSql`（单引号/反斜杠转义）处理内联值。

## 6. 构建与部署

- **构建纪律**：本地编译，禁止服务器上 make/cmake（AGENTS.md §5）。`analytics/Dockerfile` 提供可复现的 Linux 构建镜像（ubuntu:24.04 + cmake/g++/libcurl4-openssl-dev/libpq-dev），产物拷贝到宿主机后上传。
- **部署**：二进制放 `/opt/oxelia51/analytics/token-analytics`；`deploy/token-analytics.service`（`Type=oneshot`）+ `token-analytics.timer`（`OnBootSec=1min`、`OnUnitActiveSec=5min`、`RandomizedDelaySec=30`）。oneshot + timer 而非守护进程：崩溃不影响下一周期，无状态残留，天然适配「每 5 分钟跑一批」。

## 7. 迁移治理（重要）

`oxelia51` schema 的迁移**只放 `analytics/deploy/migrations/`**，不放 `backend/migrations/`（后者是阿里云 Go 后端的自有库，已验证其中无任何 `oxelia51.` schema 引用）。现有迁移：

| 文件 | 内容 |
|------|------|
| `002_analytics_tables.sql` | 引擎六张表（daily_stats/budget/alerts/engine_state/pricing/exchange_rates） |
| `003_model_pricing_seed.sql` | 定价 seed（与桌面端 defaultPricing 口径对齐） |
| `004_pricing_update.sql` | 定价修订 |
| `005_synced_events.sql` | 云同步表（synced_events + sync_tokens，web `/api/sync/*` 使用） |
| `006_pricing_sync_202608.sql` | 定价全量 reconcile（收敛新旧库分叉，ON CONFLICT DO UPDATE） |
| `007_site_content.sql` | 站点内容（web 管理台「内容编辑」） |
| `008_cache_tokens.sql` | synced_events 补缓存细分列 |

历史教训：`oxelia51` schema 的表由 C++ 引擎/本目录迁移建管，但 `packages/shared/prisma/migrations` 里存在一条 `20260806070003_add_oxelia51_alert_channel_verification` 直接 `ALTER TABLE oxelia51.alert_channels`——在全新数据库上 `prisma migrate deploy` 会因表不存在而失败，且该文件已被生产应用不能修改（checksum）。全新部署需先手工建空表再跑 migrate deploy（详见 `packages/shared/AGENTS.md`）。结论：**oxelia51 schema 的迁移纪律是本目录为准**，跨工具触碰同一 schema 是已踩过的坑。

## 8. 关键设计决策

1. **oneshot 批处理而非流式**：token 统计允许 5 分钟级延迟，换来实现与运维的极简（无消费组、无 checkpoint 服务）。
2. **游标存 PG 而非本地文件**：`engine_state` 与业务表同库同事务语义，重装/迁移不丢进度。
3. **分块追平 + 逐块推进**：把「长积压」从内存与失败半径两个维度切片，每块都是独立的幂等单位。
4. **定价双源**：DB 优先、内置兜底（`pricing.cpp loadBuiltinFallback` 仅 4 个模型，与 003 seed 对齐）——DB 挂掉时流水线仍可跑，成本口径降级但不中断。
5. **告警「宁标 sent 不重发」**：外发失败只记日志，用可能的丢失换绝对不轰炸。

## 9. 已知限制

- **异常检测算法简单**：仅「vs 昨日同维度」的倍数阈值，无周基线/滑动窗口；昨日即高峰时今天更高可能漏报。
- **汇率是兜底值**：`ensureTodayExchangeRate` 只保证「今天有记录」（7.20），真实汇率依赖另外的定时任务写入（`ON CONFLICT DO NOTHING` 不覆盖）。
- **CH 查询非参数化**：`escapeSql` 手工转义 + 内联 SQL（HTTP 接口限制），新增查询时必须过 `escapeSql`。
- **daily_stats 无 agent 维度**：聚合只有 project+model+date；Agent 维度统计目前只存在于本地 SQLite 与 CH 原表。
- **告警状态机极简**：只有 pending/sent（schema 注释提到 acknowledged 但代码未用），外发失败无重试队列。
