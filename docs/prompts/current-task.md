## 后端任务：清理旧平台残留代码

### 背景

oxelia51.com v3.0 前端已迁移到 Langfuse（腾讯云 Docker），旧的 React SPA 不再使用。旧后端有大量只服务于旧前端的 API 路由和业务模块，需要删除以减少代码量、降低安全面、简化维护。

旧 SPA 的 Nginx 路由已改为直通 Langfuse，服务器旧前端文件已清理。

### 修改范围——只改这些文件

| 文件 | 改动 |
|------|------|
| `backend/internal/app/app.go` | 删除废弃路由注册，删除废弃 handler 初始化，删除废弃 import |
| `backend/internal/domain/article/` | **整个目录删除** |
| `backend/internal/domain/developer/` | **整个目录删除** |
| `backend/internal/domain/weather/` | **整个目录删除** |
| `backend/internal/domain/hero/` | 删除除 Upload handler 外的所有文件；Upload 保留 |
| `backend/internal/domain/tool/` | 删除 list/public/portfolio 等旧路由 handler；保留 admin 路由和 proxy |
| `backend/internal/domain/auth/` | 删除 Register/VerifyEmail/ResendVerification/ForgotPassword/ResetPassword handler；保留 Login/Refresh/Logout |
| `backend/internal/domain/user/` | 评估：如果不影响 `/api/users/me` 和 `/api/auth/profile`，可精简 |
| `frontend/` | **整个目录删除** |
| `backend/internal/domain/` 中不再使用的 model 文件 | 与删除的 handler 对应的 model |

**不得修改**：
- `backend/internal/gateway/` — 工具代理网关
- `backend/internal/domain/admin/` — IP 白名单、exec、stats
- `backend/internal/domain/health/` — 健康检查
- `backend/internal/middleware/` — JWT 中间件
- `backend/cmd/server/main.go` — 入口
- `backend/config/` — 配置
- `docs/`、`.github/`、`deploy/`、`proxy-gateway/`、`analytics/`、`langfuse-token/`

### 具体改动

#### 1. `backend/internal/app/app.go`

删除以下 import：
```go
"github.com/XiaoleC05/oxelia51-backend/internal/domain/article"
"github.com/XiaoleC05/oxelia51-backend/internal/domain/developer"
"github.com/XiaoleC05/oxelia51-backend/internal/domain/hero"
"github.com/XiaoleC05/oxelia51-backend/internal/domain/weather"
```

简化 tool import（如 tool 包只保留 proxy 和管理功能则不变）。

删除以下 handler 初始化：
```go
weatherH := weather.NewWeatherHandler(rdb)
heroH := hero.NewHeroHandler(pool)
devH := developer.NewDeveloperHandler(pool)
articleH := article.NewArticleHandler(pool)
```

删除以下路由注册（第 104-123 行对应项）：
```go
r.GET("/api/weather", weatherH.GetWeather)
r.POST("/api/auth/register", authH.Register)
r.GET("/api/auth/verify-email", authH.VerifyEmail)
r.POST("/api/auth/resend-verification", authH.ResendVerification)
r.POST("/api/auth/forgot-password", authH.ForgotPassword)
r.POST("/api/auth/reset-password", authH.ResetPassword)
r.GET("/api/tools", toolH.List)
r.GET("/api/tools/:slug", toolH.Get)
r.GET("/api/portfolio", toolH.ListPortfolioPublic)
r.GET("/api/hero-images", heroH.ListPublic)
r.GET("/api/developer/profile", devH.GetProfile)
r.GET("/api/articles", articleH.ListPublic)
r.GET("/api/articles/categories", articleH.Categories)
r.GET("/api/articles/:id", articleH.GetPublic)
r.GET("/api/pages/:slug", articleH.GetPage)
r.GET("/api/search", articleH.Search)
```

删除 admin 组中以下路由：
```go
adminGroup.GET("/tools", adminTool.ListTools)
adminGroup.PATCH("/tools/:slug", adminTool.PatchTool)
adminGroup.POST("/tools/scan-local", adminTool.ScanLocal)
adminGroup.GET("/portfolio", adminTool.ListPortfolio)
adminGroup.PUT("/portfolio/:slug", adminTool.UpdatePortfolio)
adminGroup.GET("/hero-images", heroH.ListAdmin)
adminGroup.POST("/hero-images", heroH.Create)
adminGroup.PUT("/hero-images/:id", heroH.Update)
adminGroup.DELETE("/hero-images/:id", heroH.Delete)
adminGroup.PUT("/carousel-settings", heroH.UpdateCarouselSettings)
adminGroup.PATCH("/developer/profile", devH.PatchProfile)
adminGroup.GET("/developer/profile", devH.GetProfileAdmin)
adminGroup.GET("/articles", articleH.ListAdmin)
adminGroup.POST("/articles", articleH.Create)
adminGroup.PUT("/articles/:id", articleH.Update)
adminGroup.DELETE("/articles/:id", articleH.Delete)
adminGroup.GET("/pages", articleH.ListPagesAdmin)
adminGroup.PUT("/pages/:slug", articleH.UpdatePage)
```

**保留**（确认不删）：
```go
// 这些必须保留
r.GET("/api/health", healthH.Health)
r.GET("/api/uptime", healthH.Uptime)
r.POST("/api/auth/login", authH.Login)
r.POST("/api/auth/refresh", authH.Refresh)
protected.POST("/auth/logout", authH.Logout)
protected.GET("/users/me", userH.Me)
protected.PATCH("/auth/profile", userH.PatchProfile)
r.Any("/api/tools/:slug/proxy/*path", gw.Proxy)  // ← 关键：工具代理
adminGroup.POST("/hero-images/upload", heroH.Upload)  // ← 文件上传
adminGroup.GET("/users", adminTool.ListUsers)
adminGroup.PATCH("/users/:id", adminTool.PatchUser)
adminGroup.DELETE("/users/:id", adminTool.DeleteUser)
adminGroup.GET("/server-stats", statsH.ServerStats)
adminGroup.GET("/dashboard-stats", adminTool.DashboardStats)
// IP whitelist CRUD
adminGroup.GET("/ip-whitelist", whitelistH.ListWhitelist)
adminGroup.POST("/ip-whitelist", whitelistH.CreateWhitelist)
adminGroup.PATCH("/ip-whitelist/:id", whitelistH.UpdateWhitelist)
adminGroup.DELETE("/ip-whitelist/:id", whitelistH.DeleteWhitelist)
adminIPGroup.POST("/exec", admin.Exec)
```

#### 2. auth handler 清理

`backend/internal/domain/auth/handler.go`：
- 删除 `Register` `VerifyEmail` `ResendVerification` `ForgotPassword` `ResetPassword` 方法
- 保留 `Login` `Refresh` `Logout`
- 删除对应的 service/store 依赖（如不再被其他路由使用）
- 如果 `NewAuthHandlerWithDeps` 参数中有些仅为已删除方法使用，一并精简

#### 3. tool handler 清理

`backend/internal/domain/tool/`：
- 删除 `List` `Get` `ListPortfolioPublic`
- 删除 admin 的 `ListTools` `PatchTool` `ScanLocal` `ListPortfolio` `UpdatePortfolio`（如这些是旧工具管理功能）
- 保留与新平台相关的 tool 功能（proxy 在 gateway 包，不受影响）

#### 4. 删除整个目录

```bash
rm -rf backend/internal/domain/article
rm -rf backend/internal/domain/developer
rm -rf backend/internal/domain/weather
rm -rf frontend
```

#### 5. hero handler 精简

`backend/internal/domain/hero/`：
- 保留 `Upload` handler 和对应的 `NewHeroHandler`（需要 pool 连接）
- 删除 `ListPublic` `ListAdmin` `Create` `Update` `Delete` `UpdateCarouselSettings`
- Upload 仍需要 `NewHeroHandler` 中的 `uploadDir`，构造函数需保留

### 验证

```bash
cd backend
go vet ./...
go build ./cmd/server/...
# 确认编译通过

# 确认关键端点存活
curl -sI https://oxelia51.com/api/health
curl -sI https://oxelia51.com/
curl -s -X POST https://oxelia51.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"oxelia51","password":"<password>"}'
```

### 完成标准

- `go vet ./...` 0 错误
- `go build ./cmd/server/...` 编译通过
- 旧 SPA 相关路由全部删除
- 核心路由（health/login/admin/exec/proxy）不受影响
- frontend/ 目录已删除

### 上报

完成后回报：变更摘要、验证结果、风险/疑问。
