# REV-02：AUTH-01 PR 审查简报

**任务 ID**：REV-02
**角色**：Codex + DeepSeek V4 Pro（只读审查，不写代码）
**日期**：2026-07-05
**基线**：契约 v1.1（已冻结）
**审查目标**：AUTH-01 邮箱验证注册 + 限流 + 未验证拦截 PR

---

## 1. 审查目标

验证 Cursor 主笔提交的 **AUTH-01 实现**是否：

1. **符合契约** `docs/api/platform-api.md §3.1～3.7` 与 `docs/api/mailer-contract.md` v1.1；
2. **符合 ADR-005** 用户模型与邮箱验证决策；
3. **安全**（密码哈希、JWT 签发、token 单次使用、限流不可绕过、防枚举）；
4. **正确**（注册→验证→登录→刷新→登出全链路状态机正确）；
5. **未越界**（不修改 `docs/api/*` 契约文本）。

输出：**闭环结论**（通过 / 有条件通过 / 不通过）+ 问题清单（按 P0～P3 分级）。

---

## 2. 必读文档（按顺序）

| 序号 | 路径 | 用途 |
|------|------|------|
| 1 | `docs/api/platform-api.md` | §3.1～3.7 注册/验证/重发/登录/登出/刷新/当前用户 |
| 2 | `docs/api/mailer-contract.md` | Token 规范、限流独立计数、安全 |
| 3 | `docs/adr/ADR-005-用户模型与邮箱验证.md` | 用户字段、邮箱 UNIQUE、限流策略 |
| 4 | `docs/adr/ADR-001-开放注册.md` | 开放注册决策 |
| 5 | `docs/06-多Agent任务板.md` | AUTH-01/02 任务定义与状态 |

---

## 3. 审查范围（代码）

### 3.1 涉及 commit（按时间倒序）

| commit | 说明 |
|--------|------|
| `f0d958f` | fix: improve JWT claims parsing and gateway proxy auth errors |
| `8749e4c` | fix: revoke refresh token on logout and cap gateway response size |
| `8b4ef65` | feat: implement v1.1 MVP platform backend, gateway, and frontend |

> 注：`c6cfd80`、`164da3f` 是 v1.0 阶段产物，v1.1 已在 `8b4ef65` 重构覆盖，可作为参考但非审查重点。

### 3.2 涉及文件

| 文件 | 审查重点 |
|------|----------|
| `backend/internal/handler/auth.go` | 注册/验证/重发/登录/登出/刷新/忘记密码/重置密码 handler |
| `backend/internal/auth/token.go` | JWT 签发与解析、claims、access/refresh 生命周期 |
| `backend/internal/auth/store.go` | refresh token 存储、黑名单、轮换 |
| `backend/internal/middleware/auth.go` | Bearer 解析、未验证邮箱拦截、角色注入 |
| `backend/internal/mailer/mailer.go` | 验证邮件发送、token 生成 |
| `backend/internal/model/user.go` | 用户模型、`email_verified`、`email` UNIQUE |
| `backend/migrations/003_auth_v11.up.sql` | auth v1.1 迁移（字段、索引、约束） |

获取完整 diff：

```bash
git diff 8b4ef65^..fde17c8 -- backend/internal/handler/auth.go backend/internal/auth/ backend/internal/middleware/auth.go backend/internal/mailer/ backend/internal/model/user.go backend/migrations/003_auth_v11.up.sql
```

---

## 4. 逐条验收清单

### P0（阻断级 — 必须通过）

| 编号 | 审查项 | 契约依据 | 验收要点 |
|------|--------|----------|----------|
| A1 | 注册 `POST /api/auth/register` | §3.1 | 字段 `username/password/password_confirm/email`；成功 `201` `verification_email_sent`；`email_verified=false` |
| A2 | 邮箱验证 `GET /api/auth/verify-email` | §3.2 | token 无效 `400 TOKEN_INVALID`；过期 `400 TOKEN_EXPIRED`；24h、单次使用 |
| A3 | 登录拦截未验证 | §3.4 | `email_verified=false` → `403 EMAIL_NOT_VERIFIED` |
| A4 | 登录限流 | §3.4 | 同 IP 失败 ≤10/15min → `429`；契约级（非建议） |
| A5 | 注册限流 | §3.1 + mailer §3 | 同 IP ≤3/小时 |
| A6 | 重发限流 | §3.3 + mailer §3 | 同邮箱 ≤1/天，独立计数 |
| A7 | email UNIQUE | §3.1 | 重复 → `409 EMAIL_TAKEN` |
| A8 | username UNIQUE | §3.1 | 重复 → `409 USERNAME_TAKEN` |
| A9 | 密码哈希 | ADR-005 | bcrypt（不可明文/可逆） |
| A10 | JWT 算法与密钥 | §3.6 | HS256 + `JWT_SECRET`；access 7d、refresh 30d |

### P1（重要）

| 编号 | 审查项 | 契约依据 | 验收要点 |
|------|--------|----------|----------|
| A11 | 登出黑名单 | §3.5 | `jti` 写入 Redis 直至 `exp`；`204` |
| A12 | Refresh 轮换 | §3.6 | 旧 refresh 作废，签发新 access + 新 refresh |
| A13 | 忘记密码防枚举 | §3.8 | 始终 `200`，不泄漏邮箱是否存在 |
| A14 | 重置密码 token | §3.9 + mailer §2 | 24h、Redis、单次；成功后删除 |
| A15 | 忘记密码限流 | §3.8 + mailer §3 | 同邮箱 ≤1/天，独立计数 |
| A16 | 当前用户 `GET /api/users/me` | §3.7 | Bearer；返回 `id/username/role/email` |

### P2（重要，可后补但应审查）

| 编号 | 审查项 | 验收要点 |
|------|--------|----------|
| A17 | `password_confirm` 一致性 | 不一致 → 明确错误码 |
| A18 | 密码强度 | 是否有最小长度/复杂度校验（契约未强制，但应审查） |
| A19 | JWT claims 注入 | `X-Oxelia51-*` 头值是否来自服务端解析的 JWT，不可被客户端伪造 |
| A20 | token 随机性 | 邮件 token 是否使用 `crypto/rand`，长度足够 |
| A21 | SQL 注入 | 是否全部使用参数化查询（pgx `$1`） |
| A22 | 时序攻击 | 密码比较是否使用 `subtle.ConstantTimeCompare` 或 bcrypt 自带 |
| A23 | 日志泄漏 | 是否打印 token 明文 / 密码 / 邮箱明文 |
| A24 | 迁移幂等 | `003_auth_v11.up.sql` 是否可重复执行/有 down 脚本 |

### P3（建议）

| 编号 | 审查项 | 验收要点 |
|------|--------|----------|
| A25 | 错误响应格式 | 是否统一 `{ "error": ..., "code": ... }` |
| A26 | 测试覆盖 | auth handler 是否有单元/集成测试 |
| A27 | 邮件模板 | 是否含验证链接、过期提示 |
| A28 | 可观测性 | 限流命中、验证成功/失败是否记录 |

---

## 5. 安全专项检查

| 检查项 | 风险 |
|--------|------|
| S1 | **未验证邮箱绕过**：是否存在不经过 middleware 的鉴权路径 |
| S2 | **JWT 伪造**：`JWT_SECRET` 是否从环境读取且未硬编码；解析是否校验签名与 exp |
| S3 | **Refresh token 重放**：旧 refresh 是否真正作废（Redis 删除/标记） |
| S4 | **限流绕过**：限流 key 是否可被伪造 IP 头绕过（注意：网关已剥离 X-Forwarded-For，但平台自身入站仍可能受影响） |
| S5 | **Token 枚举**：验证/重置 token 是否抗暴力（24h + 单次 + 足够长度） |
| S6 | **邮箱枚举**：注册/重发/忘记密码响应是否泄漏邮箱注册状态 |
| S7 | **密码明文泄漏**：日志、错误响应、DB 是否有任何明文密码 |
| S8 | **CSRF**：JWT Bearer 模式天然抗 CSRF，但需确认无 cookie 鉴权残留 |

---

## 6. 输出格式（请严格遵循）

```markdown
# REV-02 AUTH-01 PR 审查报告

**结论**：通过 | 有条件通过 | 不通过
**审查日期**：
**基线**：契约 v1.1
**审查 commit 范围**：8b4ef65^..fde17c8（auth 相关文件）

## 逐条验收（A1～A28）

| 编号 | 状态 | 证据（代码行/文件§） | 备注 |

## 安全专项（S1～S8）

| 检查项 | 通过 | 说明 |

## 残余问题（如有）

| 优先级 | 问题 | 建议修复 |

## 实施放行建议

- AUTH-01 是否可标记为最终 done：是/否
- AUTH-02（忘记密码/重置）是否一并覆盖：是/否
- 是否需 v1.2 契约修订：是/否
```

---

## 7. 约束

- **只读**：不修改仓库、不生成实现代码、不直接 push。
- 若发现 P0 级问题，必须标为 **不通过** 并指明文件与行号。
- 若仅存在 P3 级瑕疵，可 **有条件通过** 并列出待办。
- 审查完成后，结论同步到 `docs/06-多Agent任务板.md` 的 REV-02 状态字段。
- AUTH-02（忘记密码/重置）虽是独立任务 ID，但代码与 AUTH-01 同源，本次审查可一并覆盖并在报告中说明。

---

## 8. 提交说明（给审查员）

Cursor 主笔已完成 AUTH-01/02 全部实现，主要落在 commit `8b4ef65`（v1.1 MVP）及后续 fix commit。本地 `go build ./...` 通过。

请独立复核，勿仅依赖编译通过即放行；须打开 §2 所列契约文档逐项比对实现，特别关注限流独立计数、token 单次使用、防枚举三项。
