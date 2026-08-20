# 详细设计

**项目**：oxelia51.com | **版本**：3.0.0 | **日期**：2026-07-27

---

## 1. Go 代理网关

### 1.1 模块结构

```
proxy-gateway/
├── cmd/proxy/main.go               # 入口：组装 + 启动 + 优雅关闭
└── internal/
    ├── proxy/
    │   ├── handler.go              # ServeHTTP 路由分发
    │   ├── forward.go              # ReverseProxy + Director + SSE
    │   └── middleware.go           # ProjectAuth · RateLimit · Recovery
    ├── adapter/
    │   ├── adapter.go              # Adapter interface + TokenRecord 定义
    │   ├── openai.go               # OpenAI / DeepSeek / Moonshot / 智谱
    │   ├── anthropic.go            # Anthropic / Gemini
    │   └── registry.go             # URL → Adapter 映射表
    ├── recorder/
    │   ├── recorder.go             # Recorder interface + 缓冲 + 批量写入
    │   └── clickhouse.go           # ClickHouse 客户端实现
    └── limiter/
        └── limiter.go              # Token Bucket 限流器
```

### 1.2 核心类型定义

```go
// adapter/adapter.go

// TokenUsage 从 LLM 响应中提取的原始 Token 数据
type TokenUsage struct {
    PromptTokens     int    `json:"prompt_tokens"`
    CompletionTokens int    `json:"completion_tokens"`
    TotalTokens      int    `json:"total_tokens"`
}

// TokenRecord 标准化后的 Token 记录（写入 ClickHouse）
type TokenRecord struct {
    EventID          string
    ProjectID        string
    SessionID        string
    Provider         string    // anthropic / openai / deepseek / gemini / moonshot / zhipu
    Model            string
    PromptTokens     uint32
    CompletionTokens uint32
    TotalTokens      uint32
    DurationMs       uint32
    Timestamp        time.Time
    APIKeyHash       string    // SHA-256(Authorization header)
}

// Adapter 每个供应商必须实现的接口
type Adapter interface {
    ProviderName() string
    ExtractUsage(resp *http.Response) (*TokenUsage, error)
    ExtractUsageFromStream(reader io.Reader) (*TokenUsage, error)
}
```

### 1.3 HTTP 转发算法

```go
// proxy/forward.go

func NewForwarder(registry *adapter.Registry, recorder recorder.Recorder) *Forwarder {
    return &Forwarder{
        registry: registry,
        recorder: recorder,
        client: &http.Client{
            Timeout: 10 * time.Minute, // LLM 调用可能很长
            Transport: &http.Transport{
                MaxIdleConns:        100,
                IdleConnTimeout:     90 * time.Second,
                DisableCompression:  false,
            },
        },
    }
}

func (f *Forwarder) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    // 1. 提取元数据
    projectID := r.Header.Get("X-Project-ID")
    if projectID == "" {
        http.Error(w, `{"error":"missing X-Project-ID"}`, 400)
        return
    }
    sessionID := r.Header.Get("X-Session-ID")
    if sessionID == "" {
        sessionID = uuid.New().String()
    }

    // 2. 选择 Adapter
    adp := f.registry.Match(r.URL.Path)  // "/api/proxy/openai/..." → OpenAIAdapter
    if adp == nil {
        http.Error(w, `{"error":"unknown provider"}`, 404)
        return
    }

    // 3. 提取模型名（从请求体）
    model := extractModel(r)

    // 4. 记录开始时间
    start := time.Now()

    // 5. 创建 ReverseProxy
    proxy := &httputil.ReverseProxy{
        Director: func(req *http.Request) {
            target := f.registry.ResolveTarget(r.URL.Path)
            req.URL.Scheme = "https"
            req.URL.Host = target.Host
            req.Host = target.Host
            req.URL.Path = target.StripPrefix(r.URL.Path) // /api/proxy/openai/v1/... → /v1/...
        },
        ModifyResponse: func(resp *http.Response) error {
            // 异步记录
            go f.recordAsync(adp, resp, projectID, sessionID, model, start, r)
            return nil
        },
    }

    // 6. 转发
    proxy.ServeHTTP(w, r)
}

func (f *Forwarder) recordAsync(adp adapter.Adapter, resp *http.Response,
    projectID, sessionID, model string, start time.Time, r *http.Request) {

    var usage *adapter.TokenUsage
    var err error

    // 判断是否为流式
    if isStreaming(resp) {
        usage, err = adp.ExtractUsageFromStream(resp.Body)
    } else {
        usage, err = adp.ExtractUsage(resp)
    }

    if err != nil || usage == nil {
        log.Printf("[WARN] extract usage failed: %v, project=%s model=%s", err, projectID, model)
        usage = &adapter.TokenUsage{} // 零值兜底
    }

    record := adapter.TokenRecord{
        EventID:          uuid.New().String(),
        ProjectID:        projectID,
        SessionID:        sessionID,
        Provider:         adp.ProviderName(),
        Model:            model,
        PromptTokens:     uint32(usage.PromptTokens),
        CompletionTokens: uint32(usage.CompletionTokens),
        TotalTokens:      uint32(usage.TotalTokens),
        DurationMs:       uint32(time.Since(start).Milliseconds()),
        Timestamp:        start,
        APIKeyHash:       sha256Hex(r.Header.Get("Authorization")),
    }

    f.recorder.Record(record)
}
```

### 1.4 SSE 流式解析算法

```go
// adapter/openai.go

func (a *OpenAIAdapter) ExtractUsageFromStream(reader io.Reader) (*TokenUsage, error) {
    scanner := bufio.NewScanner(reader)
    scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024) // 最大 1MB 行
    var lastDataLine string

    for scanner.Scan() {
        line := scanner.Text()
        if line == "" {
            continue // SSE 空行
        }
        if !strings.HasPrefix(line, "data: ") {
            continue
        }
        data := strings.TrimPrefix(line, "data: ")
        if data == "[DONE]" {
            break
        }

        // 同时透传给客户端（如果正在流式转发）
        // ... writer.Write([]byte(line + "\n"))

        lastDataLine = data
    }

    if err := scanner.Err(); err != nil {
        return nil, fmt.Errorf("scan sse: %w", err)
    }

    if lastDataLine == "" {
        return nil, fmt.Errorf("no data chunk found in stream")
    }

    var chunk struct {
        Usage *TokenUsage `json:"usage"`
    }
    if err := json.Unmarshal([]byte(lastDataLine), &chunk); err != nil {
        return nil, fmt.Errorf("parse usage: %w", err)
    }
    if chunk.Usage == nil {
        return nil, fmt.Errorf("usage field missing in final chunk")
    }

    return chunk.Usage, nil
}
```

### 1.5 限流器

```go
// limiter/limiter.go

type RateLimiter struct {
    mu       sync.Mutex
    buckets  map[string]*tokenBucket  // projectID → bucket
    rate     int                       // 令牌/分钟
    capacity int
}

type tokenBucket struct {
    tokens   float64
    lastTime time.Time
}

func NewRateLimiter(ratePerMinute int) *RateLimiter {
    return &RateLimiter{
        buckets:  make(map[string]*tokenBucket),
        rate:     ratePerMinute,
        capacity: ratePerMinute,
    }
}

func (rl *RateLimiter) Allow(projectID string) bool {
    rl.mu.Lock()
    defer rl.mu.Unlock()

    b, ok := rl.buckets[projectID]
    if !ok {
        b = &tokenBucket{tokens: float64(rl.capacity), lastTime: time.Now()}
        rl.buckets[projectID] = b
    }

    // 补充令牌
    elapsed := time.Since(b.lastTime).Minutes()
    b.tokens += elapsed * float64(rl.rate)
    if b.tokens > float64(rl.capacity) {
        b.tokens = float64(rl.capacity)
    }
    b.lastTime = time.Now()

    // 消费
    if b.tokens >= 1 {
        b.tokens--
        return true
    }
    return false
}
```

### 1.6 优雅关闭

```go
// cmd/proxy/main.go

func main() {
    // ... 初始化 ...

    srv := &http.Server{
        Addr:         ":" + port,
        Handler:      mux,
        ReadTimeout:  30 * time.Second,
        WriteTimeout: 10 * time.Minute,
        IdleTimeout:  60 * time.Second,
    }

    // 监听系统信号
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        <-quit
        log.Println("shutting down...")

        // 1. 停止接收新请求（设置 10s 超时）
        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()

        // 2. 等待正在处理的请求完成
        srv.Shutdown(ctx)

        // 3. 刷新 Recorder 缓冲区
        recorder.Flush()

        // 4. 关闭 ClickHouse 连接
        clickhouse.Close()
    }()

    log.Printf("proxy gateway listening on :%s", port)
    if err := srv.ListenAndServe(); err != http.ErrServerClosed {
        log.Fatalf("server error: %v", err)
    }
    log.Println("server stopped")
}
```

---

## 2. C++ 分析引擎

### 2.1 模块结构

```
analytics/
├── src/
│   ├── main.cpp                   # 入口 + 命令行 + 定时器
│   ├── aggregator.cpp / .h        # 聚合查询 + 统计
│   ├── pricing.cpp / .h           # 成本计算 + 定价表
│   ├── detector.cpp / .h          # 异常检测算法
│   ├── alerter.cpp / .h           # 告警触发 + 通道分发
│   └── db/
│       ├── clickhouse.cpp / .h    # ClickHouse 连接 + 查询
│       └── postgres.cpp / .h      # PostgreSQL 连接 + 写入
├── CMakeLists.txt
└── deploy/
    ├── token-analytics.service
    └── token-analytics.timer
```

### 2.2 主流程

```cpp
// src/main.cpp

int main() {
    try {
        // 1. 连接数据库
        ClickHouseClient ch(CH_HOST, CH_PORT, CH_USER, CH_PASSWORD);
        PostgresClient  pg(PG_CONNSTR);

        // 2. 聚合查询（最近 5 分钟的新事件）
        auto events = ch.query(R"(
            SELECT project_id, model, toDate(timestamp) AS date,
                   sum(prompt_tokens) AS prompt,
                   sum(completion_tokens) AS completion,
                   sum(total_tokens) AS total,
                   sum(duration_ms) AS dur,
                   count() AS requests
            FROM token_events
            WHERE timestamp >= now() - INTERVAL 5 MINUTE
            GROUP BY project_id, model, date
        )");

        // 3. 计算成本
        Pricing pricing;
        for (auto& e : events) {
            e.cost_usd = pricing.calculate(e.model, e.prompt, e.completion);
        }

        // 4. 写入日统计（幂等 UPSERT）
        for (auto& e : events) {
            pg.exec(R"(
                INSERT INTO oxelia51.daily_stats
                    (project_id, model, date, prompt_tokens, completion_tokens,
                     total_tokens, cost_usd, request_count)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                ON CONFLICT (project_id, model, date) DO UPDATE SET
                    prompt_tokens = daily_stats.prompt_tokens + EXCLUDED.prompt_tokens,
                    completion_tokens = daily_stats.completion_tokens + EXCLUDED.completion_tokens,
                    total_tokens = daily_stats.total_tokens + EXCLUDED.total_tokens,
                    cost_usd = daily_stats.cost_usd + EXCLUDED.cost_usd,
                    request_count = daily_stats.request_count + EXCLUDED.request_count
            )", e.project_id, e.model, e.date, e.prompt, e.completion,
               e.total, e.cost_usd, e.requests);
        }

        // 5. 异常检测
        Detector detector(ch);
        for (auto& e : events) {
            auto baseline = ch.getYesterdayUsage(e.project_id, e.model, e.date);
            if (detector.isAnomalous(e.total, baseline)) {
                Alert alert{AlertType::ANOMALY, Severity::WARNING,
                    fmt::format("Token usage for {} spiked {}x vs yesterday", e.model, e.total / (baseline+1))};
                alerter.send(e.project_id, alert);
            }
        }

        // 6. 预算检查
        auto configs = pg.getBudgetConfigs();
        for (auto& cfg : configs) {
            auto monthUsage = ch.getMonthUsage(cfg.project_id);
            if (monthUsage >= cfg.budget * cfg.threshold) {
                Alert alert{AlertType::BUDGET, Severity::WARNING,
                    fmt::format("Budget {:.0f}% reached", monthUsage / cfg.budget * 100)};
                alerter.send(cfg.project_id, alert);
            }
        }

    } catch (const std::exception& e) {
        std::cerr << "[ERROR] " << e.what() << std::endl;
        return 1;
    }
    return 0;
}
```

### 2.3 成本计算

定价存储在数据库 `oxelia51.model_pricing` 表中，以 USD 为基准。前端显示时按当日汇率换算 CNY，用户可点击按钮切换币种。

```sql
CREATE TABLE oxelia51.model_pricing (
    model             String,
    provider          LowCardinality(String),
    prompt_price_usd  Float64,  -- per 1M tokens, USD
    completion_price_usd Float64,
    updated_at        DateTime
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY model;
```

汇率通过定时任务每日从中国银行 API 拉取存入 `oxelia51.exchange_rates` 表。

```cpp
// src/pricing.cpp

double Pricing::calculate(const std::string& model,
                          uint64_t prompt_tokens, uint64_t completion_tokens) const {
    auto price = pricingRepo_->find(model);
    if (!price) {
        return 0.0;
    }
    return (prompt_tokens / 1'000'000.0) * price->prompt_usd
         + (completion_tokens / 1'000'000.0) * price->completion_usd;
}
```

### 2.4 异常检测

```cpp
// src/detector.cpp

bool Detector::isAnomalous(uint64_t current, uint64_t baseline) const {
    if (baseline == 0) {
        return current > 10'000;  // 无历史数据：绝对阈值 1 万
    }
    return current > baseline * 3;  // 同比 > 3 倍
}

bool Detector::isTrendingUp(const std::deque<uint64_t>& recent) const {
    if (recent.size() < 3) return false;
    auto a = recent[0], b = recent[1], c = recent[2];
    return c > b * 1.5 && b > a * 1.5;  // 连续 3 窗口增长 > 50%
}
```

### 2.5 告警分发

```cpp
// src/alerter.cpp

void Alerter::send(const std::string& project_id, const Alert& alert) {
    // 1. 站内通知（PostgreSQL）
    pg_->exec("INSERT INTO oxelia51.alert_logs (project_id, alert_type, severity, message) "
              "VALUES ($1,$2,$3,$4)",
              project_id, alert.type_str(), alert.severity_str(), alert.message);

    // 2. 获取该项目的通知通道
    auto channels = pg_->getChannels(project_id);
    for (auto& ch : channels) {
        switch (ch.type) {
        case ChannelType::EMAIL:
            if (ch.verified) mailer_->send(ch.config["email"], alert.subject(), alert.body());
            break;
        case ChannelType::WEBHOOK:
            http_->post(ch.config["url"], alert.to_webhook_json());
            break;
        }
    }
}
```

---

## 3. ClickHouse 数据模型

### 3.1 DDL

```sql
CREATE DATABASE IF NOT EXISTS oxelia51;

CREATE TABLE oxelia51.token_events (
    event_id          String,
    project_id        String,
    session_id        String,
    provider          LowCardinality(String),
    model             String,
    prompt_tokens     UInt32,
    completion_tokens UInt32,
    total_tokens      UInt32,
    cost_usd          Float64,
    duration_ms       UInt32,
    timestamp         DateTime64(3),
    api_key_hash      FixedString(64)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp)
SETTINGS index_granularity = 8192;
```

### 3.2 常用查询

```sql
-- 今日总览
SELECT sum(total_tokens) AS tokens, sum(cost_usd) AS cost, count() AS requests
FROM oxelia51.token_events
WHERE project_id = 'proj_xxx' AND toDate(timestamp) = today();

-- 近 30 天按日趋势
SELECT toDate(timestamp) AS date,
       sum(total_tokens) AS tokens, sum(cost_usd) AS cost
FROM oxelia51.token_events
WHERE project_id = 'proj_xxx' AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY date ORDER BY date;

-- 按模型占比
SELECT model, sum(total_tokens) AS tokens, sum(cost_usd) AS cost
FROM oxelia51.token_events
WHERE project_id = 'proj_xxx' AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY model ORDER BY tokens DESC;

-- 按会话明细
SELECT session_id, min(timestamp) AS started,
       sum(total_tokens) AS tokens, sum(cost_usd) AS cost,
       count() AS requests
FROM oxelia51.token_events
WHERE project_id = 'proj_xxx'
GROUP BY session_id ORDER BY started DESC LIMIT 50;
```

---

## 4. Web 定制（web/）

### 4.1 改动文件清单（已实现，2026-07-29 更新；2026-08 随 fork 脱钩并入本仓）

```
web/src/  ← 原 langfuse-token 仓库，已并入本仓
│
├── features/dashboard/components/
│   ├── TokenWidget.tsx                   新增：Token 统计卡片（概览）
│   ├── TokenChart.tsx                    新增：Token 趋势图（ECharts 折线，日/周/月）
│   ├── CostChart.tsx                     新增：成本饼图（ECharts，CNY/USD 切换）
│   ├── EChart.tsx                        新增：ECharts React 轻量封装
│   └── useOxeliaChartTheme.ts            新增：图表主题色 hook（读 --ox-chart-* 变量）
│
├── features/oxelia51/
│   ├── server/oxelia51Router.ts          新增：tRPC router（PG $queryRaw + ClickHouse）
│   ├── currency.tsx                      新增：CNY/USD 上下文（汇率取 exchange_rates）
│   └── components/
│       ├── AlertsSettings.tsx            新增：告警设置（预算/异常/通道/历史）
│       └── SegmentedControl.tsx          新增：分段切换控件
│
├── features/theming/
│   ├── ThemeProvider.tsx                 修改：注入 data-theme 并同步 next-themes
│   ├── oxelia51-theme.css                新增：Cozy/Cosmos 变量（--ox- 前缀）
│   ├── oxelia51-theme.ts                 新增：主题 store（localStorage 持久化）
│   └── Oxelia51ThemeToggle.tsx           新增：侧边栏底部主题切换
│
├── components/
│   ├── FilingInfo.tsx                    新增：ICP/公安备案 + MIT 开源声明页脚
│   ├── Oxelia51Logo.tsx                  修改：Oxelia51 字标（黄/蓝双版；原 LangfuseLogo，已改名）
│   ├── layouts/routes.tsx                修改：导航分组（Token 统计 / 管理外链）
│   ├── layouts/app-layout/variants/AuthenticatedLayout.tsx
│   │                                     修改：全局页脚 + title/favicon
│   └── layouts/app-layout/hooks/useLayoutMetadata.ts
│                                         修改：title=Oxelia51、favicon=favicon.ico
│
├── pages/project/[projectId]/
│   ├── dashboard/tokens.tsx              新增：Token 统计页
│   ├── dashboard/cost.tsx                新增：成本分析页
│   └── settings/index.tsx                修改：注册 alerts slug（/settings/alerts）
│
├── pages/_document.tsx                   修改：lang=zh-CN + 主题防闪烁脚本
├── pages/_app.tsx                        修改：引入主题 CSS
├── styles/oxelia51-vars.css              新增：Langfuse shadcn 变量映射（HSL）
└── next.config.mjs                       修改：i18n locales [en, zh-CN]

数据层约定：
  - PostgreSQL oxelia51 schema → prisma.$queryRaw（复用 web 的 DATABASE_URL）
  - ClickHouse oxelia51.token_events → queryClickhouse（@oxelia51/shared）
  - 路由注册于 web/src/server/api/root.ts（appRouter.oxelia51）
```

### 4.2 同步上游

> 注：原 langfuse-token fork 仓库已并入本仓 `web/`（仓库归档），以下基于独立 fork 的 rebase 流程不再适用，仅存档；新的上游同步方式需架构裁定。

```bash
cd langfuse-token
git fetch upstream
git rebase upstream/main
# 只有 CSS + 自定义页面，冲突概率极低
# 如有冲突，优先保留上游逻辑，重新应用 CSS 变量
```

---

## 5. UI 主题系统

> 实现备注（2026-07-29）：为避免与 Langfuse shadcn 变量（--accent/--border/--radius）
> 冲突，实际代码中所有变量加 `--ox-` 前缀（如 `--ox-accent`），并通过
> `web/src/styles/oxelia51-vars.css` 将主题色映射为 Langfuse 的 HSL 变量。

### 5.1 Cozy 暖色

```css
:root, [data-theme="cozy"] {
  --bg: #fdf6ee; --bg-alt: #f5ebe0;
  --bg-glass: rgba(253,246,238,0.75);
  --text: #3d2e25; --text-h: #2a1a0e; --text-muted: #8b7355;
  --accent: #c8553d; --accent-hover: #a04030; --accent-2: #6b8e5a;
  --accent-border: rgba(200,85,61,0.35);
  --border: #e0d3c0; --border-light: #ede4d4;
  --radius: 10px; --speed: 0.3s;
  --ok: #4a7c59; --danger: #c8553d; --warn: #c4943d;
}
```

### 5.2 Cosmos 深色

```css
[data-theme="cosmos"] {
  --bg: #0a0e17; --bg-alt: #111620;
  --bg-glass: rgba(17,22,32,0.78);
  --text: #c9d1d9; --text-h: #e6edf3; --text-muted: #6e7681;
  --accent: #7c3aed; --accent-hover: #9d6ff5; --accent-2: #3b82f6;
  --accent-border: rgba(124,58,237,0.4);
  --border: #1e2430; --border-light: #252c38;
  --radius: 6px; --speed: 0.2s;
  --ok: #3fb950; --danger: #f85149; --warn: #d29922;
}
```

### 5.3 Canvas 粒子背景

**Cozy 暖光尘埃**：
```
粒子: 150 个（桌面）/ 80 个（移动），r=1-3px
颜色: #f5d5a0 #e8c8b0 #d4a880
运动: vx: ±0.1, vy: -0.3~-0.1，微微上浮
透明度: 0.12-0.35，3-7s 正弦呼吸
光斑: 8 个，r=60-120px, blur(30px)，暖金/暖粉
帧率: 30fps
```

**Cosmos 星空**：
```
第一层(远景): 300 个，1px，#fff，0.2-0.8 闪烁
第二层(近景): 80 个，1.5-3px，#c8d6ff，顺时针旋转 0.05rad/s，鼠标视差 ±3px
第三层(星云): 2000 个，0.5-1px，紫/蓝/青色，离屏 Canvas 预渲染
第四层(流星): 每 15-40s 触发，右上→左下，1.5s，白色渐变 + 3px 光点
帧率: 30fps
```

---

## 6. 组件库

```css
/* 卡片 */    .card           { bg-glass + border + radius + shadow + hover translateY(-2px) }
/* 按钮 */    .btn--primary   { accent 填充 }
             .btn--ghost     { 透明边框 }
             .btn--danger    { --danger }
             .btn--sm        { 小尺寸 }
/* 输入框 */  .input          { 底部线条，focus → accent }
/* 徽章 */    .badge--ok      { --ok } / .badge--warn { --warn } / .badge--off { --text-muted }
/* 加载 */    .spinner        { 旋转 } / .skeleton { 骨架屏 }
/* 空状态 */  .empty-state    { 居中灰色文字 }
/* 错误 */    .error-state    { --danger }
```

### 间距尺度

| 变量 | 值 | 用途 |
|------|----|------|
| `--space-sm` | 8px | 元素内紧凑间距 |
| `--space-gap` | 16px | 元素间基础间距 |
| `--space-card` | 24px | 卡片内边距 |
| `--space-section` | 80px / 48px | 页面 section 间距（桌面/移动） |
