# 概要架构设计

**项目**：oxelia51.com | **版本**：3.0.0 | **日期**：2026-07-27

---

## 1. 架构原则

| # | 原则 | 说明 |
|:--:|------|------|
| 1 | 关注点分离 | Go 代理只做转发+记录，C++ 引擎只做分析，Web（本仓 `web/`）只做展示 |
| 2 | 异步解耦 | Token 记录不阻塞 LLM 响应；分析引擎离线批处理 |
| 3 | 最小依赖 | Go 代理只用标准库（除 ClickHouse 驱动）；C++ 只用 clickhouse-cpp + libpq |
| 4 | 单二进制部署 | Go 代理和 C++ 引擎各产出一个可执行文件 |
| 5 | Fork 已脱钩 | `web/` 原为 langfuse fork（langfuse-token 仓库），已并入本仓并删除 langfuse 原生功能（追踪/提示词/评估等），独立演进，不再 rebase 上游 |
| 6 | 自建表隔离 | `oxelia51` schema 独立于原 Langfuse 表 |

---

## 2. 逻辑视图

### 2.1 子系统

```
oxelia51.com v3.0
│
├── 子系统 1: Go 代理网关
│   职责: HTTP 反向代理、Token 记录、供应商适配、限流
│   输入: LLM API 请求 (HTTP POST, SSE)
│   输出: Token 事件 → ClickHouse
│
├── 子系统 2: C++ 分析引擎
│   职责: 离线聚合统计、成本计算、异常检测、告警触发
│   输入: ClickHouse (原始事件)
│   输出: 聚合结果 → PostgreSQL / 告警通知
│
├── 子系统 3: Oxelia51 Web（本仓 web/）
│   职责: 落地页/文档站、仪表盘、Token 统计面板、成本分析
│   输入: PostgreSQL + ClickHouse 查询
│   输出: Web UI
│
├── 子系统 4: 管理后台
│   职责: DormGuard、SecretStore、服务器监控、IP 白名单、Token 管理
│   输入: HTTP 请求
│   输出: Web UI
│
└── 子系统 5: 部署与 CI/CD
    职责: 编译、测试、打包、部署、监控
    输入: git push
    输出: 运行中的服务
```

### 2.2 模块依赖

```
                    ┌──────────┐
                    │  Nginx   │
                    └────┬─────┘
                         │
          ┌──────────────┼──────────────────┐
          │              │                  │
          ▼              ▼                  ▼
   /api/proxy/*     /api/tools/*          /
          │              │                  │
          ▼              ▼                  ▼
   ┌──────────┐   ┌──────────┐   ┌──────────────┐
   │Go 代理网关│   │Go 管理后台│   │Oxelia51 Web  │
   └────┬─────┘   └────┬─────┘   └──────┬───────┘
        │              │                │
        │ INSERT       │ SELECT         │ SELECT
        ▼              ▼                ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ClickHouse│   │PostgreSQL│   │ClickHouse│
   └────┬─────┘   └────┬─────┘   └──────────┘
        │              │
        │ SELECT       │ INSERT
        ▼              ▼
   ┌──────────────────────┐
   │   C++ 分析引擎        │
   │   (systemd timer)    │
   └──────────────────────┘
```

**依赖方向**：Go 代理网关 → ClickHouse（写），C++ 引擎 → ClickHouse（读）→ PostgreSQL（写），Oxelia51 Web → ClickHouse + PostgreSQL（读）。没有循环依赖。

---

## 3. 进程视图

### 3.1 请求生命周期（同步路径）

```
客户端                     Go 代理网关                  上游 LLM
  │                           │                           │
  │ POST /api/proxy/openai/   │                           │
  │ X-Project-ID: proj_xxx    │                           │
  │ Authorization: sk-xxx     │                           │
  ├──────────────────────────►│                           │
  │                           │ 1. 提取 project_id       │
  │                           │ 2. 识别 provider         │
  │                           │ 3. 选择 adapter          │
  │                           │                           │
  │                           │ POST /v1/chat/completions│
  │                           │ Authorization: sk-xxx    │
  │                           ├──────────────────────────►│
  │                           │                           │
  │                           │       SSE stream          │
  │                           │◄──────────────────────────┤
  │                           │                           │
  │                           │ 4. 逐 chunk 转发         │
  │      SSE stream           │ 5. 从最后 chunk 提取 usage│
  │◄──────────────────────────┤                           │
  │                           │                           │
  │                           │ 6. go recorder.Record()  │
  │                           │    INSERT token_events   │
  │                           │    (异步，不阻塞响应)     │
```

### 3.2 分析引擎生命周期（异步路径）

```
systemd timer (每 5 分钟)
  │
  ▼
C++ 引擎启动
  │
  ├── 1. 连接 ClickHouse
  │     SELECT ... FROM token_events
  │     WHERE timestamp >= now() - INTERVAL 5 MINUTE
  │     GROUP BY project_id, model, date
  │
  ├── 2. 连接 PostgreSQL
  │     SELECT monthly_budget_usd, alert_threshold
  │     FROM oxelia51.budget_configs
  │     WHERE enabled = true
  │
  ├── 3. 计算成本
  │     cost = prompt_tokens/1e6 * price.prompt
  │          + completion_tokens/1e6 * price.completion
  │
  ├── 4. 异常检测
  │     同比（vs 昨天同时段）：> 3x → 异常
  │     环比（连续 3 窗口 +50%）：→ 趋势告警
  │
  ├── 5. 预算检查
  │     month_total / budget > threshold → 告警
  │
  ├── 6. 写入 PostgreSQL
  │     INSERT INTO oxelia51.daily_stats ON CONFLICT UPDATE
  │     INSERT INTO oxelia51.alert_logs
  │
  ├── 7. 发送通知
  │     站内 INSERT / 邮件 SMTP / Webhook POST
  │
  └── 8. 退出
```

### 3.3 并发模型

```
Go 代理网关：
  - 每个 HTTP 请求 → 一个 goroutine（~2KB 栈）
  - 异步写入 ClickHouse → 独立 goroutine，通过 channel 传递 TokenRecord
  - 优雅关闭：先停止接收新请求 → 等待所有 inflight 完成 → 关闭 ClickHouse 连接

C++ 引擎：
  - 单线程批处理（不需要并发）
  - systemd timer 保证同一时间只有一个实例运行
```

---

## 4. 开发视图

### 4.1 仓库与模块

```
XiaoleC05/
│
├── Oxelia51/                          # 主仓库（部署入口）
│   ├── proxy-gateway/                 # Go module
│   │   ├── cmd/proxy/main.go          # 入口
│   │   └── internal/
│   │       ├── proxy/                 # HTTP 处理 + 转发
│   │       ├── adapter/               # 供应商适配
│   │       ├── recorder/              # Token 记录
│   │       └── limiter/               # 限流
│   │
│   ├── analytics/                     # C++ 项目
│   │   ├── src/
│   │   │   ├── main.cpp               # 入口
│   │   │   ├── aggregator.cpp/.h      # 聚合
│   │   │   ├── detector.cpp/.h        # 异常检测
│   │   │   ├── pricing.cpp/.h         # 成本
│   │   │   ├── alerter.cpp/.h         # 告警
│   │   │   └── db/
│   │   │       ├── clickhouse.cpp/.h
│   │   │       └── postgres.cpp/.h
│   │   ├── CMakeLists.txt
│   │   └── deploy/
│   │
│   ├── backend/                       # Go module（管理后台）
│   ├── web/                           # Web 应用（原 langfuse-token fork，已脱钩并入本仓）
│   │   └── src/
│   │       ├── features/
│   │       │   ├── oxelia51/          # Oxelia51 自有功能（landing/admin/同步/工作区）
│   │       │   ├── dashboard/         # Token 统计组件
│   │       │   └── theming/           # Cozy/Cosmos 变量
│   │       └── pages/
│   │           ├── app/               # 应用主界面（overview/analytics/agents/…）
│   │           ├── admin/             # 管理台页面
│   │           └── api/sync/          # 桌面端同步端点
│   ├── packages/
│   │   └── shared/                    # @oxelia51/shared（Prisma/ClickHouse/领域常量）
│   ├── deploy/                        # Docker Compose + Nginx + Webhook + systemd
│   ├── scripts/                       # 构建辅助脚本
│   └── docs/                          # 6 份核心文档
```

### 4.2 设计模式

| 模式 | 位置 | 用途 |
|------|------|------|
| Adapter | `proxy-gateway/internal/adapter/` | 每个 LLM 供应商一个 Adapter，统一 `Adapter` interface |
| Repository | `analytics/src/db/` | 封装 ClickHouse 和 PostgreSQL 访问 |
| Middleware Pipeline | `proxy-gateway/internal/proxy/middleware.go` | 鉴权→限流→转发，链式处理 |
| Producer-Consumer | `proxy-gateway/internal/recorder/` | Go 代理生产 TokenRecord → channel → Consumer 批量写 ClickHouse |
| Strategy | `analytics/src/detector.cpp` | 不同告警策略（同比/环比/阈值），可插拔 |

### 4.3 错误处理策略

| 层 | 错误 | 处理 |
|------|------|------|
| Go 代理—转发 | 上游 LLM 不可达 | 返回 502 + `{"error":"upstream unavailable"}` |
| Go 代理—解析 | usage 字段缺失 | 记录 `usage=0` + WARN 日志，不阻断 |
| Go 代理—写入 | ClickHouse 不可达 | `go func()` 中 catch → 降级写本地 JSONL |
| C++ 引擎—读取 | ClickHouse 查询超时 | 重试一次，仍失败则跳过本轮 |
| C++ 引擎—写入 | PostgreSQL 不可达 | WARN 日志 + 下轮重试（幂等 UPSERT） |
| 所有层 | panic | recovery 中间件捕获 → 500 + 堆栈日志，不 crash |

---

## 5. 物理视图

### 5.1 服务拓扑

```
                             Internet
                                │
                                ▼
┌──────────────────────────────────────────────────────────────┐
│                    阿里云 47.108.202.199 (2C2G)                │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Nginx :80/:443                        │ │
│  │                                                         │ │
│  │  location /                    → /opt/Oxelia51/frontend  │ │
│  │  location /admin               → 127.0.0.1:8080         │ │
│  │  location /api/proxy/          → 127.0.0.1:9090         │ │
│  │  location /api/tools/          → 127.0.0.1:8080         │ │
│  │  location /token/              → 118.25.138.177:80      │ │
│  │  location /webhook             → 127.0.0.1:9000         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Go 代理网关   │  │ Go 管理后台   │  │ Webhook 接收器    │   │
│  │ :9090         │  │ :8080         │  │ :9000             │   │
│  │ systemd       │  │ systemd       │  │ systemd           │   │
│  └──────┬───────┘  └──────────────┘  └──────────────────┘   │
│         │                                                    │
│         │ INSERT token_events                               │
│         ▼                                                    │
│    腾讯云 ClickHouse :8123                                    │
└──────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────┐
│                  腾讯云 118.25.138.177 (4C4G)                  │
│                                                              │
│  Docker Compose (langfuse_default network):                   │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────┐  ┌───────┐            │
│  │ClickHouse│  │PostgreSQL│  │Redis │  │ MinIO │            │
│  │  :8123   │  │  :5434   │  │:6379 │  │ :9000 │            │
│  │  :9000   │  │ (Docker) │  │      │  │       │            │
│  └──────────┘  └──────────┘  └──────┘  └───────┘            │
│                                                              │
│  ┌──────────────────────────────────────┐                    │
│  │  Web :3000                            │                    │
│  │  Next.js（本仓 web/），落地页 + 文档   │                    │
│  │  + 仪表盘/Token 统计                  │                    │
│  └──────────────────────────────────────┘                    │
│                                                              │
│  ┌──────────────────────────────────────┐                    │
│  │  ~~Langfuse Worker :3030~~            │                    │
│  │  已随 fork 脱钩删除（原生 ingestion/  │                    │
│  │  evals 队列一并移除），新部署不再有    │                    │
│  └──────────────────────────────────────┘                    │
│                                                              │
│  ┌──────────────────────────────────────┐                    │
│  │  C++ 分析引擎 (systemd timer)          │                    │
│  │  每 5 分钟调度，读 ClickHouse         │                    │
│  │  写 PostgreSQL                        │                    │
│  └──────────────────────────────────────┘                    │
│                                                              │
│  ┌──────────┐                                                │
│  │ SmartKB   │  独立服务（pgvector :5433 + Ollama），不参与    │
│  │  :8007    │  Token 平台链路                                │
│  └──────────┘                                                │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 网络规则

| 源 | 目标 | 端口 | 协议 | 用途 |
|------|------|:--:|------|------|
| Internet | 阿里云 Nginx | 443 | HTTPS | 用户访问 |
| 阿里云 Go 代理 | 腾讯云 ClickHouse | 9000 | TCP | Token 写入 (Native) |
| 阿里云 Go 代理 | 上游 LLM API | 443 | HTTPS | 请求转发 |
| 阿里云 Nginx | 腾讯云 Nginx | 80 | HTTP | /token/ 反代 Langfuse |
| 阿里云 Webhook | GitHub API | 443 | HTTPS | 接收部署通知 |
| 腾讯云 C++ 引擎 | 腾讯云 ClickHouse | 9000 | TCP | 聚合查询 |
| 腾讯云 C++ 引擎 | 腾讯云 PostgreSQL | 5434 | TCP | 写统计结果 |

所有非公网端口均绑定 `127.0.0.1` 或防火墙（UFW/安全组）限制访问。

---

## 6. 前端架构

### 6.1 页面路由

| 路径 | 来源 | 说明 |
|------|------|------|
| `/` | **自制** | 落地页（主入口下载桌面版） |
| `/docs` | **自制** | 文档站 |
| `/app` | **自制** | 应用主界面（overview/analytics/agents/providers/settings） |
| `/project/:id` | Fork 改造 | 项目首页（原 Trace 列表等 langfuse 原生页面已删除） |
| `/project/:id/dashboard/tokens` | **自制** | Token 统计面板（ECharts） |
| `/project/:id/dashboard/cost` | **自制** | 成本分析页（ECharts） |
| `/project/:id/settings/alerts` | **自制** | 告警配置页 |
| `/admin` | **现有** | 管理后台（DormGuard 等） |

### 6.2 设计系统（继承自 v2）

```
CRAP 四原则：
  对齐 (Alignment)     — 8px 网格，1120px 最大宽度
  亲密 (Proximity)     — sp-{sm:8, md:16, 2xl:48} 间距尺度
  对比 (Contrast)      — --text / --text-h / --accent 三级色
  重复 (Repetition)    — .card / .btn--* / .badge--* 统一组件

双主题：
  Cozy  — #fdf6ee 背景, #c8553d accent, 10px 圆角, 0.3s 过渡
  Cosmos — #0a0e17 背景, #7c3aed accent, 6px 圆角, 0.2s 过渡

响应式断点：
  移动端 ≤640px / 平板 ≤1024px / 桌面 默认
```

---

## 7. 安全架构

```
                    ┌──────────────────────────────┐
                    │       Internet (HTTPS)         │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  Nginx (TLS 终止 + HSTS)      │
                    │  add_header Strict-Transport  │
                    │  add_header X-Frame DENY      │
                    │  add_header X-Content nosniff │
                    └──────────────┬───────────────┘
                                   │
          ┌────────────────────────┼────────────────────┐
          │                        │                    │
          ▼                        ▼                    ▼
   /api/proxy/*              /api/tools/*            /admin
          │                        │                    │
          ▼                        ▼                    ▼
   ┌──────────────┐    ┌──────────────────┐   ┌──────────────┐
   │ Project 鉴权  │    │ JWT 鉴权          │   │ JWT + Admin   │
   │ X-Project-ID │    │ + 网关转发        │   │ + IP 白名单   │
   │ 存在即可转发  │    │                  │   │ (exec 专用)   │
   └──────────────┘    └──────────────────┘   └──────────────┘

安全措施：
  API Key：仅转发 Authorization 头，不存储，不出现在日志中
  ClickHouse：api_key_hash 字段存储 SHA-256，不可逆
  Webhook：HMAC-SHA256 签名验证
  SSH：22 端口不对外，Workbench 管理
  ClickHouse/PostgreSQL/Redis：绑定 127.0.0.1，不对外
```

---

## 8. 实现阶段

| 阶段 | 内容 | 状态 |
|:--:|------|:--:|
| 1 | Langfuse 部署 + Fork + 数据链路验证 | ✅ |
| 2 | Go 代理网关（转发 + 6 供应商 + ClickHouse + SSE + 限流） | ✅ |
| 3 | C++ 分析引擎（聚合 + 成本 + 异常 + 告警） | ✅ |
| 4 | 前端定制（Token 面板 + 成本页 + 中文 UI + 告警页 + 主题） | ⬜ |
| 5 | 联调 + 上线 | ⬜ |
