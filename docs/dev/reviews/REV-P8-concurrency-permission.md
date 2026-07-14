# P8 审查：多用户并发 + 权限隔离

**日期**：2026-07-15 | **审查人**：Codex
**范围**：auth 中间件、网关权限检查、JWT 验证、并发场景

---

## [严重] 1 项

### 1. 缺少用户级并发会话控制

`handler/auth.go` `Login` 方法无条件签发新 token pair——同一用户可以持有无限数量的有效 access+refresh token。没有旧会话失效机制（除手动 logout）。

**风险**：攻击者获取一组凭据后可与合法用户并行使用而不会被检测。refresh token 轮换是正确的（旧 token 被删除），但 access token 直到过期前继续有效——即使用户已登出当前设备。

**建议**：在 `RefreshStore` 中加入设备标识（如 User-Agent hash），限制每用户最多 N 个活跃 refresh token。或 logout 时将当前 access token 加入黑名单（已实现），但需确保 logout 在所有设备上都执行。

---

## [建议] 5 项

### 2. 网关网关头注入的 userID 校验不足

`gateway/proxy.go:155-163` `injectGatewayHeaders` 从 gin context 读取 `userID`/`username`/`role` 后注入到上游请求头。若某路由错误地未经过 auth 中间件就进入了 proxy handler（例如路由配置错误），`c.Get("userID")` 会返回 nil，函数会返回错误。

**当前状态**：路由配置正确——`proxy` 在 `protected` 组下，有 `authMW.Handle()` 前置。但缺少编译时保障。

**建议**：为 proxy handler 添加防御性检查，或使用类型安全的 context key 而非裸字符串。

### 3. 没有用户级数据隔离审查

后端所有公开 API（`/api/tools`、`/api/articles`、`/api/portfolio`）返回全局数据，无用户级筛选。这符合当前业务模型（平台工具目录对所有用户相同）。但若未来增加「用户私有工具」「用户文章草稿」等功能，需要在 handler 层添加 `WHERE user_id = $1` 过滤。

**当前状态**：无风险——所有数据均为全局共享。此条为架构提醒。

### 4. refresh token TTL 超长（30 天）

`config.go` `RefreshTokenTTL` 默认 30 天。刷新时旧 token 被删除（防重放正确），但若攻击者在 30 天内获得 refresh token，可持续刷新直到被发现。

**建议**：缩短为 14 天，添加 `/api/auth/sessions` 接口让用户查看和撤销活跃会话。

### 5. `/api/exec` 端点硬编码 admin 身份

Nginx 配置中 `/api/exec` location 直接注入 `X-User-Id 1; X-Username oxelia51; X-Role admin;`——不经过任何 JWT 认证。该端点暴露在公网上（在 `/api/` location 之外）。

**风险**：若 exec 端点（端口 8088）有任意代码执行能力，攻击者可直接以 admin 身份调用。

**建议**：`/api/exec` 端点添加 IP 白名单（如 `allow 127.0.0.1`）或要求内部 HMAC 签名。

### 6. Rate limiter key 仅基于 IP

`handler/auth.go` 中注册、登录、忘记密码的限流 key 仅使用 `c.ClientIP()`。共享 IP（如企业 NAT、学校网络）下，一名用户触发限流会影响所有其他用户。

**建议**：登录限流增加账号维度 key（`rl:login:account:X`），与 IP 限流并行。

---

## 验证通过项

| 检查点 | 文件 | 状态 |
|--------|------|------|
| JWT 签名算法强制 HMAC | `token.go:53` | ✅ `SigningMethodHMAC` 类型断言 |
| email_verified 纵深防御 | `auth.go:55` | ✅ 中间件二次校验 claim |
| refresh token 使用后删除（防重放） | `auth.go:226` | ✅ `Delete` 后签发新对 |
| logout 黑名单 | `auth.go:208-215` | ✅ jti 加入黑名单，TTL=剩余有效期 |
| 网关访问控制（admin/user/disabled/offline） | `access.go:15` | ✅ 四级状态完整覆盖 |
| 网关 IP 头剥离 | `proxy.go:58-75` | ✅ 9 个 IP 相关 header 全部过滤 |
| HMAC 签名注入 | `proxy.go:165-172` | ✅ HMAC-SHA256(timestamp + userID + secret) |
| 登录限流 | `auth.go:153-157` | ✅ 同 IP <=10/15min |
| 注册限流 | `auth.go:67-73` | ✅ 同 IP <=3/h |
| 可信代理配置 | `main.go:50` | ✅ `127.0.0.1, ::1` |
| 默认 JWT 密钥拒绝启动 | `config.go:67` | ✅ `<16 字符或默认值拒绝` |
| DB 密码缺失拒绝启动 | `config.go:70` | ✅ 空密码拒绝 |