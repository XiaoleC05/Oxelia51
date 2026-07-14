# P9 审查：全平台安全审查

**日期**：2026-07-15 | **审查人**：Codex
**范围**：Nginx、CORS、SQL 注入、XSS、CSRF、JWT、HMAC、SSRF、数据库、服务器

---

## [严重] 2 项

### 1. Nginx 缺少安全响应头

`deploy/nginx/oxelia51.com.conf` 未设置以下头部：

| 缺失头 | 风险 | 建议值 |
|--------|------|--------|
| `Strict-Transport-Security` | 中间人降级攻击 | `max-age=31536000; includeSubDomains` |
| `X-Frame-Options` | 点击劫持 | `DENY` 或 `SAMEORIGIN` |
| `X-Content-Type-Options` | MIME 嗅探 | `nosniff` |
| `Content-Security-Policy` | XSS 纵深防御 | 至少 `default-src 'self'` |
| `Referrer-Policy` | 跨域信息泄漏 | `strict-origin-when-cross-origin` |

**影响**：缺少 HSTS 意味着首次访问（HTTP 重定向前）可能被中间人攻击。缺少 CSP 意味着任何成功的 XSS 注入可无限制执行。

**裁决点**：添加这些头部是否由 Claude Code 直接操作 Nginx 配置，还是开任务给 Trae Work 处理前端 CSP 策略？

### 2. `/api/exec` 端点未认证

Nginx 配置中 `/api/exec` 直接硬编码 admin 身份头（`X-User-Id 1; X-Role admin`），同时暴露在公网（`/api/exec` 不在 `location /api/` 块内受保护）。

**风险**：若端口 8088 的后端服务有漏洞，攻击者可直接以 admin 身份调用。该端点无 JWT 认证、无 IP 白名单、无 HMAC 签名。

**建议**：添加 IP 白名单（`allow 127.0.0.1; deny all;`），或移到 `/api/admin/exec` 下走 JWT+admin 双认证。

---

## [建议] 6 项

### 3. 数据库连接未加密

`config.go:72-77` DSN 中 `sslmode=disable`——PostgreSQL 连接不加密。当前部署在同一台机器（localhost），实际网络风险低。但若未来数据库迁移到独立服务器，需启用 SSL。

**建议**：在 DSN 中添加 `sslmode` 环境变量，默认 `disable`，生产环境可配置为 `require`。

### 4. JWT 使用 HS256 对称签名

`token.go:40` `jwt.SigningMethodHS256` 是对称算法。所有服务共享同一个 `JWT_SECRET`。若未来有独立微服务需要验证 JWT（不在当前架构中），对称密钥分发是安全隐患。

**当前状态**：单服务架构，HS256 可接受。若未来拆分微服务，迁移至 RS256。

### 5. 无 CSRF 保护

前端 JWT 存储在 `localStorage`，通过 `Authorization: Bearer` 头发送。这种模式下 CSRF 不可行（需要 `SameSite` cookie 才能被自动附带）。这是正确的架构选择。

**但**：若未来引入任何基于 cookie 的会话（如 OAuth2 回调），需要 CSRF token 保护。当前所有认证均为 `Authorization` header 模式，CSRF 风险低。

### 6. 密码策略宽松

`handler/auth.go` 注册时仅检查密码一致性，未检查长度或复杂度。`bcrypt` 会自动处理 72 字节截断，但不限制最小长度意味着空密码或单字符密码也可注册。

**建议**：注册时添加最小长度校验（如 8 字符），以及常见弱密码黑名单。

### 7. 邮件验证 link 中的 token 暴露在 URL 中

`handler/auth.go:264` 验证链接格式为 `AppPublicURL/verify-email?token=xxx`。token 通过 HTTP GET 传递，可能被浏览器历史、referrer header、服务器日志记录。

**当前可接受度**：token 24h 过期且仅可单次使用（验证后删除）。低风险但值得注意。

**建议**：长期方案可改为 POST 提交 token（前端从 URL 提取后 POST）。

### 8. 无请求体大小限制（后端层面）

`gateway/proxy.go:100-103` 网关设置了 `GatewayMaxBodyBytes`（默认 10MB），`c.Request.Body` 被 `http.MaxBytesReader` 包裹。但非网关路由（如 `/api/auth/login`、`/api/articles` POST 等）没有类似的 body 大小限制。若攻击者发送超大 JSON payload，可能耗尽内存。

**建议**：在 Gin 全局中间件中添加 `http.MaxBytesReader`，默认 10MB。

---

## Nginx 专项

| 检查点 | 状态 | 备注 |
|--------|------|------|
| HTTP → HTTPS 重定向 | ✅ | `return 301 https://$host$request_uri` |
| Let''s Encrypt SSL | ✅ | certbot 证书路径正确 |
| `/health` 仅本地访问 | ✅ | `allow 127.0.0.1; deny all` |
| `index.html` 禁用缓存 | ✅ | `Cache-Control: no-store, no-cache, must-revalidate` |
| API 响应禁用缓存 | ✅ | `add_header Cache-Control "no-store" always` |
| HSTS | ❌ | 缺失 |
| CSP | ❌ | 缺失 |
| X-Frame-Options | ❌ | 缺失 |
| X-Content-Type-Options | ❌ | 缺失 |
| Referrer-Policy | ❌ | 缺失 |

## 网关安全

| 检查点 | 状态 | 备注 |
|--------|------|------|
| 上游 Authorization 剥离 | ✅ | 防止用户 JWT 泄漏到工具后端 |
| 客户端 IP 头剥离（9 个） | ✅ | 防止上游工具被伪造 IP 欺骗 |
| Hop-by-hop 头剥离 | ✅ | Connection, TE, Transfer-Encoding 等 |
| 上游响应体限制 | ✅ | `readLimitedBody` + `GatewayMaxBodyBytes` |
| 上游超时 | ✅ | 默认 30s，可配置 |
| URL 跳转不跟随 | ✅ | `CheckRedirect: ErrUseLastResponse` |
| SSRF 防护（URL 白名单） | ⚠️ | `ResolveInternalAPIBase` 从环境变量/DB读取，未校验是否为内网地址。若 DB 被污染，可指向任意 URL |
| HMAC 签名可选 | ⚠️ | `GatewayHMACSecret` 为空时跳过签名，工具可无签名验证接受请求 |

## JWT 安全

| 检查点 | 状态 | 备注 |
|--------|------|------|
| 算法强制（无 alg=none） | ✅ | `SigningMethodHMAC` 类型断言 |
| 签名密钥强度检查 | ✅ | 启动时 `Validate()` 拒绝 <16 字符 |
| Access token TTL | ✅ | 7 天（可配置） |
| Refresh token TTL | ✅ | 30 天（可配置，建议缩短） |
| JTI 黑名单（logout） | ✅ | Redis 存储，TTL=剩余有效期 |
| email_verified claim | ✅ | 中间件二次校验 |
| Token 响应不含敏感字段 | ✅ | `user.Password = ""` 在响应前清空 |
| 密码 bcrypt 哈希 | ✅ | `bcrypt.DefaultCost`（cost=10） |

---

## 建议优先修复顺序

1. **HSTS + X-Frame-Options + X-Content-Type-Options**（Nginx 3 行配置，立即消除点击劫持和降级风险）
2. **`/api/exec` 端点加 IP 白名单**（Nginx 1 行配置）
3. **CSP header**（需与前端协作，可先设 `default-src ''self''` 逐步收紧）
4. **SSRF URL 白名单**（`ResolveInternalAPIBase` 添加内网网段校验）
5. **全局 body 大小限制**（Gin 中间件）
6. **密码最小长度校验**（注册 handler）