# Oxelia51 Backend 性能剖析报告

> 日期：2026-07-16 | 采样方式：pprof + 代码级静态分析

---

## 1. 测试环境

| 项 | 值 |
|----|-----|
| OS | Windows 25H2 / Linux (生产) |
| Go 版本 | 1.26+ |
| Web 框架 | Gin v1 |
| 数据库 | PostgreSQL 17 |
| 缓存 | Redis 7 |
| 采样工具 | `go tool pprof` + `net/http/pprof` |
| 负载工具 | `wrk -t4 -c50 -d30s` |

### pprof 端点接入

在 `main.go` 注册了 10 个 pprof 路由（`/debug/pprof/*`），覆盖 CPU、内存、goroutine、阻塞、互斥锁分析。

**安全提示**：生产环境 Nginx 必须屏蔽 `/debug/*` 路径，防止 pprof 端点泄露内部状态。

---

## 2. CPU Profile 分析

### 采集命令

```bash
# CPU 采样 30 秒
go tool pprof -http=:8081 http://127.0.0.1:8080/debug/pprof/profile?seconds=30

# 负载
wrk -t4 -c50 -d30s http://127.0.0.1:8080/api/weather
wrk -t4 -c50 -d30s http://127.0.0.1:8080/api/tools
wrk -t4 -c50 -d30s http://127.0.0.1:8080/api/articles
```

### 静态分析 Top 3 CPU 热点

| 排名 | 函数 | 所在文件 | 热点原因 | 优化状态 |
|------|------|----------|----------|----------|
| 1 | `fetchCityWeather` | weather.go:112 | 6 次 HTTP round-trip 到 api.open-meteo.com，网络 I/O 是最大延迟来源 | 已优化：并发 + 连接池 |
| 2 | `gin.Context.JSON` | gin/render.go | JSON 序列化 `weatherCitiesResponse`（每次 cache miss 时） | 可接受：30 分钟缓存命中率高 |
| 3 | `redis.Client.Get` | go-redis/internal | Redis GET 用于缓存查询，单次 ~0.5ms | 可接受：Redis 本身足够快 |

### 热点 1 详细分析 — `fetchCityWeather`

**瓶颈**：6 城市天气查询，若串行执行则总延迟 = Σ(单城市延迟) ≈ 6 × 200ms = 1200ms。

**已优化措施**：
1. **6 goroutine 并发** — 总延迟降为 max(单城市延迟) ≈ 200ms（6 倍提升）
2. **Redis 30 分钟缓存** — 缓存命中时直接返回，0 次 Open-Meteo 调用
3. **HTTP Transport 连接池** — `MaxIdleConnsPerHost=6`，6 个并发请求复用 TCP 连接，避免 TLS 握手开销

### 热点 2 详细分析 — JSON 序列化

`weatherCitiesResponse` 包含 6 个城市 × 4 字段 = 24 个 JSON 字段。序列化一次约 2μs，在 30 分钟缓存窗口内仅执行 1 次（cache miss），后续命中缓存走 `json.Unmarshal` 反序列化。

**评估**：JSON 编解码不是瓶颈，无需引入 `easyjson` 或 ` sonic` 等第三方库。

---

## 3. 内存 Profile 分析

### 采集命令

```bash
go tool pprof -http=:8081 http://127.0.0.1:8080/debug/pprof/heap
go tool pprof -http=:8081 http://127.0.0.1:8080/debug/pprof/allocs
```

### 静态分析 Top 3 堆分配点

| 排名 | 分配点 | 所在文件 | 分配内容 | 优化状态 |
|------|--------|----------|----------|----------|
| 1 | `results []weatherResponse` | weather.go:87 | 6 元素切片，原为 nil 从零增长（3 次 realloc） | 已优化：`make([]weatherResponse, 0, 6)` 预分配 |
| 2 | `fmt.Sprintf` URL 构建 | weather.go:116 | 每次调用分配一个新字符串 | 可接受：6 次/请求，单次 ~100B |
| 3 | `json.Marshal(resp)` | weather.go:108 | 缓存写入时序列化整个响应 | 可接受：30 分钟一次 |

### 优化 1 — 预分配 results 切片

**优化前**：
```go
results []weatherResponse  // nil 切片，append 时经历 cap=0→1→2→4→8 三次扩容
```

**优化后**：
```go
results = make([]weatherResponse, 0, len(cities))  // 一次分配，零扩容
```

**效果**：消除 3 次 `growslice` 调用（每次涉及 memmove + 新分配），节省 ~96B 临时分配。

### 优化 2 — HTTP Transport 连接池

**优化前**：
```go
hc: &http.Client{Timeout: 10 * time.Second}  // 默认 Transport，MaxIdleConnsPerHost=2
```

**优化后**：
```go
transport := &http.Transport{
    MaxIdleConns:        10,
    MaxIdleConnsPerHost: 6,  // 匹配 6 城市并发数
    IdleConnTimeout:     90 * time.Second,
}
hc: &http.Client{Timeout: 10 * time.Second, Transport: transport}
```

**效果**：默认 `MaxIdleConnsPerHost=2`，6 个并发请求只有 2 个复用连接，其余 4 个需新建 TCP+TLS 连接（每次 ~50ms + ~100ms）。设置为 6 后，所有请求复用连接池，首次请求后 0 连接建立开销。

---

## 4. goroutine 分析

### 采集命令

```bash
go tool pprof -http=:8081 http://127.0.0.1:8080/debug/pprof/goroutine
```

### 检查项

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `sync.WaitGroup` 配对 | ✅ | 每个 `wg.Add(1)` 都有对应 `defer wg.Done()`，`wg.Wait()` 在函数末尾 |
| HTTP 请求超时 | ✅ | `http.Client{Timeout: 10s}` + `http.NewRequestWithContext(ctx)` 双重超时 |
| goroutine 泄漏 | ✅ | goroutine 内无阻塞 channel 操作，函数返回后自动退出 |
| Redis 操作阻塞 | ✅ | Redis GET/SET 带请求 context，超时自动取消 |

---

## 5. 优化前后对比

### /api/weather 端点

| 指标 | 优化前（估算） | 优化后（估算） | 变化 |
|------|---------------|---------------|------|
| 缓存命中延迟 | ~1ms | ~1ms | 无变化（Redis 路径不涉及优化点） |
| 缓存未命中延迟 | ~250ms | ~210ms | -16%（连接池消除 TLS 握手 + 切片预分配） |
| 内存分配/请求（cache miss） | ~3KB | ~2.5KB | -17%（消除 3 次 growslice + 连接复用减少 buffer 分配） |
| goroutine 数量 | 6 + main | 6 + main | 无变化 |

### 其他端点

| 端点 | 主要瓶颈 | 建议 |
|------|----------|------|
| `/api/tools` | PostgreSQL 查询 + JSON 序列化 | 数据量小，无需优化 |
| `/api/articles` | PostgreSQL 查询 + JSON 序列化 | 考虑分页和 Redis 缓存热门文章 |
| `/api/health` | PostgreSQL ping | 已足够快 |

---

## 6. 建议路线

### 短期（立即可改）

1. **~~pprof 端点~~** — 已完成 ✅
2. **~~weather.go 切片预分配~~** — 已完成 ✅
3. **~~weather.go HTTP Transport 连接池~~** — 已完成 ✅
4. **Nginx 屏蔽 /debug/\*** — 部署配置变更，在 Nginx `location /debug/` 添加 `deny all;`
5. **文章列表 Redis 缓存** — `/api/articles` 每次查询 PG，可加 5 分钟 Redis 缓存

### 长期（架构级）

1. **连接池调优** — PostgreSQL `pgxpool` 当前默认配置，可根据并发量调整 `MaxConns`
2. **JSON 编解码** — 若 QPS 增长到 1000+，考虑 `encoding/json` → `bytedance/sonic`（兼容 API，3-5x 性能）
3. **Open-Meteo 请求合并** — Open-Meteo 支持多坐标单请求（`latitude=39.9,31.2&longitude=116.4,121.5`），可将 6 次 HTTP 调用合并为 1 次
4. **pprof 自动化** — 接入 CI 定期采集 profile，监控性能回归

---

## 7. 采集验证清单

```bash
# 1. 确认 pprof 端点可访问
curl http://127.0.0.1:8080/debug/pprof/

# 2. CPU 采样（30 秒）
go tool pprof -seconds=30 http://127.0.0.1:8080/debug/pprof/profile

# 3. 堆内存
go tool pprof http://127.0.0.1:8080/debug/pprof/heap

# 4. goroutine 检查
go tool pprof http://127.0.0.1:8080/debug/pprof/goroutine

# 5. 负载测试
wrk -t4 -c50 -d30s http://127.0.0.1:8080/api/weather
```
