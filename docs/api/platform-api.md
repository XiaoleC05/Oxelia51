# 平台 API 契约

**版本**：v1.1  
**状态**：已冻结（2026-07-05 修订，回应 Codex 审查）  
**日期**：2026-07-05

---

## 1. 约定

- 风格：REST，JSON body/response。
- 认证：JWT Bearer（`Authorization: Bearer <token>`），除公开接口外。
- 错误格式：

```json
{
  "error": "human_readable_message",
  "code": "MACHINE_CODE"
}
```

- 角色：`admin`（唯一用户 `oxelia51`）、`user`（普通注册用户）。
- 标识符：对外资源以 **`slug`** 为主；`id` 仅内部 DB，不在公共/管理 API 路径中使用。

---

## 2. 健康检查

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/health` | 无 | 服务与数据库状态 |

---

## 3. 认证与用户

### 3.1 注册

`POST /api/auth/register`

```json
{
  "username": "string",
  "password": "string",
  "password_confirm": "string",
  "email": "string"
}
```

- 成功：`201`，`{ "message": "verification_email_sent" }`
- 用户状态：`email_verified=false`，不可登录。
- **`email` 全局 UNIQUE**；重复 → `409`，`code: EMAIL_TAKEN`
- **`username` 全局 UNIQUE**；重复 → `409`，`code: USERNAME_TAKEN`
- 限流：同 IP ≤3 次/小时。

### 3.2 邮箱验证

`GET /api/auth/verify-email?token=<token>`

- 成功：`200`
- Token 无效 → `400`，`code: TOKEN_INVALID`
- Token 过期 → `400`，`code: TOKEN_EXPIRED`（有效期 **24h**，见 mailer-contract.md）

### 3.3 重发验证邮件

`POST /api/auth/resend-verification` — `{ "email": "string" }`

- 限流：**独立计数**，同邮箱 ≤1 次/天。

### 3.4 登录

`POST /api/auth/login`

```json
{ "username": "string", "password": "string" }
```

- 成功：`200`：

```json
{
  "token": "<access_jwt>",
  "expires_in": 604800,
  "user": { "id", "username", "role", "email" }
}
```

- 未验证邮箱：`403`，`code: EMAIL_NOT_VERIFIED`
- 凭证错误：`401`，`code: INVALID_CREDENTIALS`
- **限流（契约级）**：同 IP 登录失败 ≤10 次/15 分钟 → `429`

### 3.5 登出

`POST /api/auth/logout`  
认证：Bearer

- 将当前 JWT `jti` 写入 Redis 黑名单，直至原 `exp` 过期。
- 成功：`204`

### 3.6 刷新 Token（本期实现）

`POST /api/auth/refresh`

```json
{ "refresh_token": "string" }
```

- 签发新 access JWT；refresh token 轮换（旧 refresh 作废）。
- Access 有效期：**7 天**（`604800` 秒）；Refresh 有效期：**30 天**。
- 算法：HS256，密钥 `JWT_SECRET`（与现网实现一致，可后续升 RS256）。

### 3.7 当前用户

`GET /api/users/me` — Bearer


### 3.8 修改个人资料

`PATCH /api/auth/profile`
认证：Bearer

```json
{ "username": "string" }
```

- 更新当前用户的显示名 `username`。
- 成功：`200`，返回完整 User 对象（无 password 字段）。
- 用户名字符串为空 → `400`，`code: INVALID_REQUEST`
- 用户名重复 → `409`，`code: USERNAME_TAKEN`
- 至少提供一个要修改的字段，否则 → `400`

### 3.9 忘记密码

`POST /api/auth/forgot-password` — `{ "email": "string" }`

- 始终 `200`（防枚举）；邮件限流：**独立计数**，同邮箱 ≤1 次/天。

### 3.10 重置密码

`POST /api/auth/reset-password`

```json
{
  "token": "string",
  "password": "string",
  "password_confirm": "string"
}
```

- Token 规则同邮箱验证（24h、Redis、单次使用）。

---

## 4. 工具目录（公开读）

### 4.1 列表

`GET /api/tools`

返回**全部** `online_capable=true` 的工具，及作品集-only 条目是否展示由 portfolio API 负责。

响应项：

```json
{
  "slug": "dormguard",
  "name": "DormGuard",
  "description": "string",
  "user_accessible": false,
  "status": "enabled",
  "release_url": "https://github.com/.../releases",
  "online_capable": true,
  "badge": "closed_to_users"
}
```

**`badge` 字段映射（UI）**：

| 条件 | `badge` | 展示文案 |
|------|---------|----------|
| `status=disabled` | `offline` | 已下线 |
| `status=enabled` 且 `user_accessible=false` | `closed_to_users` | 暂未开放 |
| `status=enabled` 且 `user_accessible=true` | `open` | 已开放 |

未登录/普通用户：见 badge；`oxelia51` 无视 `user_accessible`，但仍见 `offline` 提示。

### 4.2 详情

`GET /api/tools/:slug`

- 存在 → `200` 元数据
- **不存在 → `404`，`code: TOOL_NOT_FOUND`**
- 进入在线使用页：前端要求已登录且已验证邮箱。

---

## 5. 管理 API（仅 `role=admin`）

| 方法 | 路径 | 说明 |
|------|------|------|
| PATCH | `/api/admin/tools/:slug` | 更新 `user_accessible`、`status`、描述覆盖等 |
| POST | `/api/admin/tools/scan-local` | 扫描 `code` 目录与 `oxelia51.tool.json` |
| GET | `/api/admin/portfolio` | 作品集列表 |
| PUT | `/api/admin/portfolio/:slug` | 覆盖名称/描述 |

---

## 6. JWT 载荷

```json
{
  "sub": "user_id",
  "username": "oxelia51",
  "role": "admin",
  "jti": "uuid",
  "exp": 1234567890
}
```

| 类型 | 有效期 | 存储 |
|------|--------|------|
| access | 7 天 | 客户端；吊销用 Redis 黑名单（`jwt:blacklist:<jti>`） |
| refresh | 30 天 | **Redis**（`refresh:<token>` → user_id）；logout 时删除；TTL 30d 自动过期 |

---

## 7. 限流汇总

| 操作 | 限制 | 独立计数 |
|------|------|----------|
| 注册 | 同 IP ≤3/小时 | 是 |
| 重发验证 | 同邮箱 ≤1/天 | 是 |
| 忘记密码 | 同邮箱 ≤1/天 | 是 |
| 登录失败 | 同 IP ≤10/15min | 是 |

---

## 8. 关联文档

- [gateway-contract.md](gateway-contract.md)
- [tool-registration.md](tool-registration.md)
- [mailer-contract.md](mailer-contract.md)
- [ADR-007](../adr/ADR-007-DormGuard内网化与数据库边界.md)
