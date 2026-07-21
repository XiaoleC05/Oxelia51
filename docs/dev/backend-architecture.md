# Oxelia51 后端架构重设计

**版本**：v1.0 | **日期**：2026-07-22 | **原则**：高内聚低耦合 · 按业务划分 · 单一职责

---

## 五问验证

### 1. 新人能否 10 分钟理解？

```
domain/
├── user/      → 用户相关
├── auth/      → 登录/注册/令牌
├── tool/      → 工具注册
├── article/   → 博客文章
├── leaderboard/ → 大模型榜单
└── site/      → 个人主页

一目了然。不需要猜测"handler 里有哪些业务"。
```

### 2. 增加一个功能是否容易？

```
新增"支付模块"：

domain/payment/
├── handler.go      # POST /api/payment
├── service.go      # 支付业务逻辑
├── repository.go   # 支付数据访问
└── model.go        # Payment 结构体

在 app.go 中注入依赖，注册路由。4 个文件，不改任何现有代码。
```

### 3. 修改一个功能是否影响其他模块？

```
修改 leaderboard 的数据源：
  只动 domain/leaderboard/repository.go
  user/ article/ tool/ 完全不受影响

每个 domain 文件夹是一个闭包——内部修改不影响外部。
```

### 4. 测试是否容易？

```
每个 domain 独立测试：

domain/leaderboard/service_test.go
  → mock repository 接口
  → 测试业务逻辑，不依赖数据库

domain/leaderboard/handler_test.go
  → httptest + mock service
  → 测试 HTTP 层

不需要启动整套服务。
```

### 5. AI Agent 是否容易定位代码？

```
"修改文章列表的排序逻辑"
  → domain/article/service.go → ListArticles()

"新增榜单数据源"
  → domain/leaderboard/repository.go → FetchScores()

"修改 JWT 过期时间"
  → config/config.go → JWTExpiry

路径即语义，不需要全文搜索。
```

---

## 新目录结构

```
backend/
├── cmd/server/main.go           # 入口：初始化 infra → 组装 app → 启动
│
├── config/
│   └── config.go                # 全部配置，集中管理
│
├── internal/
│   │
│   ├── app/
│   │   └── app.go               # 依赖注入 + 路由注册
│   │
│   ├── domain/                  # 业务领域（每个文件夹 = 一个业务模块）
│   │   ├── user/                # 用户 CRUD
│   │   │   ├── handler.go       # HTTP 层
│   │   │   ├── service.go       # 业务逻辑
│   │   │   ├── repository.go    # 数据访问
│   │   │   └── model.go         # 类型定义
│   │   │
│   │   ├── auth/                # 认证（注册/登录/令牌/限流）
│   │   │   ├── handler.go
│   │   │   ├── service.go
│   │   │   ├── repository.go    # Redis：blacklist/refresh/pending
│   │   │   └── model.go
│   │   │
│   │   ├── tool/                # 工具注册与发现
│   │   │   ├── handler.go
│   │   │   ├── service.go
│   │   │   ├── repository.go
│   │   │   └── model.go
│   │   │
│   │   ├── article/             # 博客文章
│   │   │   ├── handler.go
│   │   │   ├── service.go
│   │   │   ├── repository.go
│   │   │   └── model.go
│   │   │
│   │   ├── hero/                # 头图轮播
│   │   │   ├── handler.go
│   │   │   ├── service.go
│   │   │   ├── repository.go
│   │   │   └── model.go
│   │   │
│   │   ├── developer/           # 关于开发者
│   │   │   ├── handler.go
│   │   │   ├── service.go
│   │   │   ├── repository.go
│   │   │   └── model.go
│   │   │
│   │   ├── leaderboard/         # 大模型榜单（新增）
│   │   │   ├── handler.go
│   │   │   ├── service.go
│   │   │   ├── repository.go
│   │   │   ├── updater.go       # 定时拉取数据
│   │   │   └── model.go
│   │   │
│   │   └── site/                # 用户个人主页（新增）
│   │       ├── handler.go
│   │       ├── service.go
│   │       ├── repository.go
│   │       └── model.go
│   │
│   ├── gateway/                 # API 网关（跨域关注点）
│   │   ├── proxy.go
│   │   ├── access.go
│   │   └── resolver.go
│   │
│   ├── middleware/              # HTTP 中间件
│   │   ├── auth.go              # JWT 鉴权
│   │   └── admin.go             # 管理员校验
│   │
│   └── infra/                   # 基础设施（不包含业务逻辑）
│       ├── postgres.go          # 数据库连接池
│       ├── redis.go             # Redis 客户端
│       ├── mailer.go            # 邮件发送
│       └── migrate.go           # 迁移执行
│
└── migrations/                  # SQL 迁移脚本（扁平，按序号命名）
    ├── 001_users.up.sql
    ├── 002_tools.up.sql
    └── ...
```

---

## 命名规范

| 类别 | 规则 | 示例 |
|------|------|------|
| 文件名 | 单个职责，名词 | `handler.go` `service.go` `repository.go` `model.go` |
| 包名 | 业务名，单数 | `package user` `package auth` |
| 函数 | 动词开头 | `ListArticles()` `CreateUser()` |
| 类型 | 名词 | `User` `ArticleService` `ToolRepository` |
| 测试 | `_test.go` 同级目录 | `service_test.go` |

---

## 与旧结构对照

| 旧路径 | 新路径 |
|--------|--------|
| `internal/handler/auth.go` | `domain/auth/handler.go` |
| `internal/handler/article.go` | `domain/article/handler.go` |
| `internal/model/user.go` | `domain/user/model.go` |
| `internal/model/article.go` | `domain/article/model.go` |
| `internal/service/`（空） | 删除 |
| `internal/database/postgres.go` | `infra/postgres.go` |
| `internal/database/redis.go` | `infra/redis.go` |
| `internal/database/migrate.go` | `infra/migrate.go` |
| `internal/mailer/mailer.go` | `infra/mailer.go` |
| `internal/middleware/auth.go` | `middleware/auth.go` |
| `internal/gateway/proxy.go` | `gateway/proxy.go` |
| `internal/config/config.go` | `config/config.go` |
| `internal/auth/store.go` | `domain/auth/repository.go` |
| `internal/auth/token.go` | `domain/auth/service.go` |
| `internal/registry/` | `domain/tool/` |
| `internal/admin/seed.go` | `domain/user/seed.go` |
| `internal/handler/health.go` | `domain/health/handler.go`（或放在 `app/health.go`） |
| `internal/handler/stats.go` | `domain/admin/stats.go` |
| `internal/handler/weather.go` | 删除（首页不再展示天气） |

---

## 迁移原则

1. **先建新结构，不删旧代码**：新建 `domain/` `infra/` `config/`，逐步迁移
2. **每个 domain 独立迁移**：先迁 `user` → 验证 → 迁 `auth` → 验证 → ...
3. **每个文件保持 ≤300 行**：handler + service + repository + model 拆分后自然达标
4. **测试跟着 domain 走**：每个 domain 目录内有自己的 `_test.go`
5. **旧代码全删后提交**：一个 commit 完成迁移，不产生中间状态
