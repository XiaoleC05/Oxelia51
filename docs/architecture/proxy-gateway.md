# proxy-gateway — Go 记账代理网关

**模块路径**：`proxy-gateway/` | **语言**：Go（无 Web 框架，裸 `net/http`） | **入口**：`proxy-gateway/cmd/proxy/main.go`

同一个二进制，两种运行模式：云端网关（ClickHouse 落账 + PG 密钥鉴权，监听 `:9090`）与本地 sidecar（SQLite 落账、免鉴权、只读统计 API，监听 `127.0.0.1:17800`）。桌面端打包的就是这个二进制（见 [desktop.md](desktop.md)）。

---

## 1. 模块职责

对 LLM 上行请求做**透明反向代理 + Token 记账**：

- 客户端把 LLM API base URL 指向网关（`/api/proxy/<slug>/`），网关转发到真实上游；
- 从响应（含 SSE 流）中提取 token 用量，按项目/会话/供应商/Agent/模型落账；
- 不改写请求与响应语义（除注入 `stream_options.include_usage` 与鉴权头改写，见 §3）。

非职责：成本聚合、告警（由 C++ 分析引擎做，见 [analytics.md](analytics.md)）、用户账户体系（web 侧）。

## 2. 目录结构

```
proxy-gateway/
├── cmd/proxy/main.go            ← 组装入口：模式判定、依赖装配、路由、优雅关闭
├── internal/
│   ├── adapter/                 ← 供应商适配层
│   │   ├── adapter.go           ← Adapter 接口、TokenUsage / TokenRecord / Route 类型
│   │   ├── registry.go          ← 路由注册表：12 条 providerSpecs（11 家厂商）+ Anthropic 变体合成
│   │   ├── openai.go            ← OpenAI 兼容协议 usage 提取（含 Response API）
│   │   ├── anthropic.go         ← Anthropic 协议 usage 提取（含 prompt caching 字段）
│   │   └── custom.go            ← 用户自定义供应商：校验（SSRF 防护）+ 动态路由
│   ├── proxy/
│   │   ├── handler.go           ← 路由注册：/health、/api/proxy/status、/api/proxy/
│   │   ├── forward.go           ← 核心反向代理：SSE 包装、usage 提取、落账构造
│   │   ├── middleware.go        ← keyAuth / rateLimit / recovery 中间件链
│   │   ├── keystore.go          ← 代理密钥解析（proxy_keys 表，sha256 比对）
│   │   └── sessionizer.go       ← 会话指纹推断 + Agent（客户端工具）识别
│   ├── recorder/
│   │   ├── recorder.go          ← Recorder 接口 + ChannelRecorder 异步批写
│   │   ├── clickhouse.go        ← ClickHouse 写入器 + RecoveringWriter 自愈
│   │   ├── sqlite.go            ← SQLite 写入器（本地模式）+ 启动时幂等补列
│   │   └── keyhash.go           ← api_key_hash 解析
│   ├── localapi/                ← 仅本地模式挂载的桌面端 API（/api/*）
│   │   ├── localapi.go          ← 路由 mux、CORS 白名单、/api/overview
│   │   ├── ext.go               ← 供应商/Agent/模型维度统计、告警、明细查询
│   │   ├── settings.go          ← 设置读写、定价表、预算、costOf 成本计算
│   │   ├── custom.go            ← 自定义供应商管理端点（带 5s 缓存）
│   │   ├── rate.go              ← USD→CNY 汇率（每日拉取，离线回退 7.2）
│   │   ├── detect.go            ← 本机已装 AI 工具探测（CLI/配置目录/VS Code 插件，结果 60s 缓存）
│   │   ├── exec_windows.go / exec_other.go  ← 子进程隐藏控制台（Windows CREATE_NO_WINDOW，防探测时终端一闪）
│   │   └── sync.go              ← 云同步客户端（upload/download、游标、去重合并）
│   ├── limiter/limiter.go       ← 按 project 维度的 token bucket 限流
│   ├── stats/stats.go           ← 网关实时统计（5 分钟滑动窗口）
│   └── version/version.go       ← 版本号（构建时 -ldflags -X 注入）
└── go.mod
```

## 3. 双模式

模式判定在 `cmd/proxy/main.go`：`-local` flag 或 `LOCAL_MODE=true` → 本地模式。命令行 flag > 环境变量 > 默认值。

| 维度 | 云端模式 | 本地模式（sidecar） |
|------|----------|---------------------|
| 监听 | `0.0.0.0:9090`（nginx 同机反代） | `127.0.0.1:17800`（仅回环） |
| 落账 | ClickHouse `oxelia51.token_events` | SQLite `~/.oxelia51/token_events.db` |
| 鉴权 | `PROXY_AUTH_MODE`（optional/required）+ `proxy_keys` 表 | 免鉴权（`ks == nil`，见下） |
| 限流 | 60 请求/分钟/项目 | 600 请求/分钟/项目 |
| localapi | 不挂载 | 挂载 `/api/*` 只读统计 + 设置 + 同步 |
| 启动方式 | systemd `token-proxy.service` | Tauri 壳托管或独立后台代理 |

关键行为差异（`middleware.go` 的 `keyAuth`）：

- **本地模式（`ks == nil`）**：客户端带的 `Authorization` / `x-api-key` 被视为**真实上游 LLM key**，改写进 `X-Oxelia51-Upstream-Key` 供 Director 上行；项目 ID 缺省为 `local`。
- **云端 optional**：有密钥则查 `proxy_keys`（sha256 匹配）并用解析出的 `project_id` **覆盖**客户端自填的 `X-Project-ID`（防用量归属伪造）；无密钥则统一归入固定匿名项目 `anonymous`，同样不采纳客户端自填值。
- **云端 required**：无密钥直接 401。
- 代理密钥本身**绝不上行**：`keyAuth` 删除 `Authorization`/`X-Api-Key`，客户端真实上游 key 只经 `X-Oxelia51-Upstream-Key` 传递，由 `forward.go` 的 Director 按协议改写为 `x-api-key`（Anthropic 协议）或 `Authorization: Bearer`（OpenAI 兼容协议）后删除该头。

裸启动（未设 `LOCAL_MODE`）默认云端模式——`main.go` 会打醒目警告日志提示桌面端应为 `LOCAL_MODE=true PROXY_PORT=17800`。

## 4. 请求链路

```
客户端 (Claude Code / curl / SDK)
  │  Authorization: Bearer <key>   X-Project-ID / X-Session-ID（可选）
  ▼
nginx（仅云端）→ :9090 或 :17800
  ▼
mux: /api/proxy/ → ChainMiddleware(recovery → keyAuth → rateLimit)     [handler.go, middleware.go]
  ▼
Forwarder.ServeHTTP                                                    [forward.go]
  1. registry.Match(path)         最长前缀匹配 → Route（静态表 → 自定义供应商回退）
  2. 取 X-Project-ID / X-Session-ID；无会话头 → Sessionizer 指纹推断
  3. 读请求体：extractModel / isStreamRequest；OpenAI 系流式注入 include_usage
  4. ResolveTarget 去重路径前缀 → 拼上游 URL
  5. httputil.ReverseProxy
     Director:        Host/URL 改写、Accept-Encoding: identity、上游 key 注入
     ModifyResponse:  仅 2xx 落账；流式 → 包 sseRecorder；非流式 → 读全body提取usage
  ▼
recorder.Record(TokenRecord) → ChannelRecorder（异步批量）
  ▼
ClickHouseWriter.WriteBatch / SQLiteWriter.WriteBatch
```

### 4.1 路由注册表（`adapter/registry.go`）

- 12 条 `providerSpecs` 静态行（slug / 上游 host / pathPrefix / 协议）：11 家厂商，分两组（旧独立 slug `deepseek-anthropic` 已收敛为路由别名，不再是独立供应商）；（国内可直接访问 / 国际直连）；其余平台一律走**自定义供应商**接入，不再内置。新增供应商 = 加一行数据。
- `anthropicEndpoints`（deepseek、zhipu）自动合成 `/api/proxy/<slug>/anthropic/` 变体路由，供 Claude Code 等 Anthropic 协议客户端使用 → 合计 **15 条路由**。
- `Match` 为最长前缀匹配；静态表未命中时回退**自定义供应商**（`matchCustom`，数据源是 localapi 的设置缓存，仅本地模式接线）。
- `Route.XAPIKeyAuth` 决定上行鉴权头形态：Anthropic 协议行用 `x-api-key`，唯一例外 `kimi-for-coding`（上游要求 Bearer）。
- `ResolveTarget` 处理客户端重复携带路径前缀的幂等去重（如 OpenAI SDK 习惯自带 `/v1`，而 qwen 的 pathPrefix 是 `/compatible-mode/v1`）：先剥完整 pathPrefix，再对多段前缀的末尾版本段（`v1`/`v3` 形态）去重，非版本段（如 gemini 的 `/openai`）不动。

### 4.2 SSE 流式转发与 token 提取（`forward.go`）

- `sseRecorder` 包装响应 body：透传同时累积缓冲，流结束（`Close`）时解析 usage。完成标记检测：OpenAI `data: [DONE]`、Anthropic `event: message_stop`；客户端中途断开（未见完成标记但拿到 usage）落 `partial=1`。
- gzip 防御：请求侧强制 `Accept-Encoding: identity`；上游仍返回 gzip 时在解析前解压（8MB 上限防解压炸弹）。
- OpenAI 系流式默认末帧无 usage → 网关注入 `stream_options.include_usage=true`（Anthropic 流式天然带 usage，跳过）。
- **仅 2xx 落账**：429/4xx/5xx 的错误体不再产生 0-token 垃圾行。
- usage 提取分协议：`openai.go`（prompt/completion，兼容 Response API 的 input/output 字段与流式 `response.completed` 嵌套）；`anthropic.go`（累积式解析：`message_start` 带 input+cache，`message_delta` 带 output 取末值）。

### 4.3 计价口径与缓存 token（`forward.go buildRecord`）

`TokenRecord` 的 token 字段有**两套口径**，不可混用：

- `prompt_tokens` = **计价输入**：Anthropic 缓存按 `cache_creation × 1.25 + cache_read × 0.1` 折算后与未缓存 input 相加（三者不相交），供成本计算直接乘单价；
- `total_tokens` = **原始 token**（含缓存 1×），供 UI 展示真实消耗；
- `cache_read_tokens` / `cache_creation_tokens` 单独落列，供缓存命中分析，不参与现有成本计算。

防御：`model` 为空且全部 token 为 0 的记录不落账。

### 4.4 会话推断与 Agent 识别（`sessionizer.go`）

- `X-Session-ID` 头优先；缺失时按**指纹**（User-Agent + 连接 IP，剥离临时端口）+ 30 分钟空闲窗口推断同一会话。已知局限：同机并行两个同类客户端会并为一个会话。
- Agent 识别：`X-Oxelia51-Agent` 头优先，否则 `InferAgent(User-Agent)` 按子串匹配（claude-code / codex / cursor / cline / aider / copilot / kimi …，未识别归 `其他`）。

## 5. 数据存储与异步落账（`recorder/`）

`ChannelRecorder`（`recorder.go`）：所有写入经容量 1000 的 channel 进入单一消费 goroutine，批量 100 条或 1s 定时 flush。并发安全设计：`batch` 只被 `run()` 访问，`Flush()` 经 `flushReq` 信号驱动（修复过 5000 条并发丢账的竞态）。channel 满或批写失败 → 降级写 `~/.oxelia51/fallback.jsonl`（完整 JSONL，可由回收脚本解析）。

**ClickHouseWriter**（`clickhouse.go`）：启动时 `CREATE TABLE IF NOT EXISTS oxelia51.token_events` + 幂等 `ADD COLUMN IF NOT EXISTS`（agent、缓存细分列），15 列批量 INSERT。表结构：`MergeTree`，按月分区，`ORDER BY (project_id, timestamp)`，`timestamp DateTime64(3)`。

**RecoveringWriter**（`clickhouse.go`）：ClickHouse 初始化失败或写失败时不再永久降级 no-op——以 ≤60s 节流尝试重建连接，成功后热切换并重放当前批次；恢复窗口内的批次按 no-op 丢弃（不阻塞请求链路，重建阻塞只发生在 recorder 消费 goroutine）。

**SQLiteWriter**（`sqlite.go`）：本地账本 `~/.oxelia51/token_events.db`（`SQLITE_PATH` 可覆盖）。WAL + `synchronous(NORMAL)` + `busy_timeout(5000)`，最多 8 连接（recorder 写与 localapi 读并行）。`INSERT OR IGNORE` 按 `event_id` 主键去重（云同步下载合并也依赖此幂等）。启动时对老库做增量补列（`partial`、`agent`、缓存列，`duplicate column` 错误属预期忽略）。同库还有 `settings` KV 表（主题/定价/预算/同步游标等）。

## 6. localapi — 桌面端 API（仅本地模式）

路由见 `localapi.go Handler()`，全部挂在 `/api/` 下：

- **统计**：`/api/overview`（今日/7日/30日/累计 + 模型/供应商/Agent 排行 + 14 天趋势）、`/api/providers[/<slug>]`、`/api/agents[/<id>]`、`/api/models`、`/api/alerts`；
- **设置**：`/api/settings`（主题/定价/预算/悬浮卡片字段）、`/api/pricing[/defaults|/catalog|/rate]`、`/api/custom-providers[/delete]`、`/api/clear-data`（清账本保留设置）；
- **工具与同步**：`/api/detect-tools`（本机 AI 工具探测，`detect.go`）、`/api/sync`（云同步，`sync.go`）、`/api/health`。

横切机制：

- **CORS 白名单**（`localapi.go`）：仅放行 Tauri webview（`tauri.localhost`）、Vite dev（`:5173`）与同源自兜底；无 Origin 头（curl 等非浏览器）放行，未知 Origin 403。
- **成本计算**（`settings.go costOf`）：用户保存的定价优先，缺失回退内置参考价 `defaultPricing`（模型名带 `[1M]` 等上下文后缀时先剥离再查），未收录按 0（不虚构）。定价缓存 5s TTL，保存时主动失效。`defaultPricing` 与云端最新定价迁移（`analytics/deploy/migrations/009_pricing_refactor_202609.sql`）的共有模型价格有测试防漂移。
- **汇率**（`rate.go`）：USD→CNY 每日拉取一次持久化到 settings；失败回退上次成功值，再回退 7.2（与云端 `exchange_rates` 兜底口径一致）。
- **云同步**（`sync.go`）：`POST /api/sync {action: upload|download}`，端点默认 `https://oxelia51.com/api/sync`（`OXELIA_SYNC_BASE` 可覆盖）。双游标：`sync_up_ts`（上传，本地事件时间戳）与 `sync_dl_seq`（下载，云端单调序号）互不影响；上传按游标后 2000 条/批，下载最多 5 轮分页；合并按 `event_id` `INSERT OR IGNORE` 去重，被跳过的行做内容比对计 `conflicts`（正常恒 0）。设备 ID `dev-<8字节hex>` 首用生成并持久化。详见 [data-flow.md](data-flow.md)。

## 7. 部署

- **云端**：`deploy/deploy-proxy.sh`（install/deploy/status/restart/logs）+ `deploy/systemd/token-proxy.service`（`MemoryMax=384M`、`SIGINT` 优雅关闭、`Restart=always`）。二进制 `proxy-server` 放 `/opt/oxelia51/proxy/`，配置在同目录 `.env`。ClickHouse 经 **SSH 隧道**（`token-tunnel.service`）：本机 `127.0.0.1:9001` → 腾讯云 `127.0.0.1:9000`（CH native 协议绑 loopback）。nginx 把 `/api/proxy/` 反代到 `127.0.0.1:9090`（`deploy/nginx/oxelia51.com.conf`）。
- **桌面 sidecar**：由 Tauri 壳以 `LOCAL_MODE=true PROXY_PORT=17800` 启动，或经「独立后台代理」注册开机自启（`--local --port 17800`），详见 [desktop.md](desktop.md)。
- 构建全部在本地/CI 完成（`go build`），禁止在服务器编译（AGENTS.md §5）。

## 8. 关键设计决策

1. **单二进制双模式**：桌面与云端共用转发/落账代码，token 语义两端一致，避免两份实现漂移；模式差异集中在 `main.go` 装配与 `keyAuth`。
2. **读全量请求体再转发**：为提取 model/stream 标志必须读体；代价是内存驻留单请求体（LLM 请求体通常 KB~MB 级，可接受）。
3. **usage 提取不阻塞转发**：记录走异步 channel；提取失败只记日志，客户端响应不受影响。
4. **可见性优先于精确**：2xx 但无 usage 的响应仍落账（0 token + model），让用户能看到「上游没给 usage」而非请求凭空消失。
5. **自定义供应商 SSRF 防护**（`adapter/custom.go`）：slug 正则 + 内置冲突 409、仅 https（http 仅限 127.0.0.1/localhost）、禁 userinfo/query/fragment、写入时 DNS 解析阻断私网地址；解析失败放行（离线自托管场景），由「仅回环可写」兜底。

## 9. 已知限制

- **会话推断是启发式**：无 `X-Session-ID` 且同机并行同类客户端时会话合并。
- **DNS rebinding 未完全防住**：自定义供应商只做写入时校验，连接时校验是后续加固项（`custom.go` 注释明示）。
- **恢复窗口丢账**：`RecoveringWriter` 重建期间的批次按 no-op 丢弃，不进 fallback 文件。
- **本地账本时间戳为本地时区字符串**（`2006-01-02 15:04:05.000`）：统计 SQL 的日期边界必须用 `localtime` 口径（`localapi.go`/`ext.go` 已处理），跨端比较时注意。
- **限流是单实例内存态**：云端多副本部署时配额不共享（当前单实例部署，未构成问题）。
