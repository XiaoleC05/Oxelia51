# P11 审查：Oxelia51 + SmartKB 会话变更

**日期**：2026-07-16 | **审查人**：Codex
**范围**：Oxelia51 3900c6f→d024837 (5 commits) + SmartKB 53cc35c→b99cd4b (4 commits)

---

## 严重（必须修复）1 项

### 1. ResendVerification 断裂——新旧 store 不匹配

[handler/auth.go](/D:/07_Projects/code/Oxelia51/backend/internal/handler/auth.go:260)

**问题**：注册流程改为 Redis 暂存（`PendingRegistrationStore`）后，`VerifyEmail` 正确地从 `h.pending` 读取注册数据。但 `ResendVerification` 仍调用旧的 `h.sendVerificationEmail()`，该函数 `h.email.Set("verify", token, userID)` 写入 `EmailTokenStore`。

当未验证用户点击「重新发送验证邮件」时：

1. `ResendVerification` 查询 `users` 表 — 新流程中未验证用户不在 DB 中
2. 若用户不在 DB → `pgx.ErrNoRows` → 静默返回 200 "ok"，不发送任何邮件
3. 即使绕过此分支（如被旧注册残留数据命中），`sendVerificationEmail` 写入 `h.email` 而非 `h.pending`，后续 `VerifyEmail` 从 `h.pending` 读取时会返回「验证链接无效」

**修复方案**：`ResendVerification` 需改为：
1. 先在 `h.pending` 中查找该 email 的暂存数据（需要按 email 索引，当前 `PendingRegistrationStore` 仅按 token 索引）
2. 生成新 token → `h.pending.Delete(oldToken)` → `h.pending.Set(newToken, data)` → 发送新邮件

**影响范围**：所有通过新注册流程提交的用户，若首封邮件丢失，无法重发。前端重发按钮返回成功但无邮件发出，用户被困在未验证状态。

---

## 建议（应修复）4 项

### 2. VerifyEmail 二次查重未处理 DB 错误

[handler/auth.go:181-191](/D:/07_Projects/code/Oxelia51/backend/internal/handler/auth.go:181)

`VerifyEmail` 中两次 `h.db.QueryRow(...).Scan(&existing)` 均未检查 `Scan` 返回值：

```go
var existing int
h.db.QueryRow(ctx, `SELECT 1 FROM users WHERE account_id = $1`, pending.AccountID).Scan(&existing)
if existing == 1 { ... }
existing = 0
h.db.QueryRow(ctx, `SELECT 1 FROM users WHERE email = $1`, pending.Email).Scan(&existing)
if existing == 1 { ... }
```

若 DB 连接在此时异常，`Scan` 返回错误但被丢弃，`existing` 保持 0，重复检查被绕过。而 `Register` handler 中相同模式的查询正确地处理了 `err != nil && !ErrNoRows`。

**对比**：`Register` handler 同类查询有完整错误处理（`if err != nil && !errors.Is(err, pgx.ErrNoRows)`）。`VerifyEmail` 应一致。

### 3. SmartKB API Key 输入 type=password，但 API Base 未遮蔽

[SmartKBWidget.jsx](/D:/07_Projects/code/Oxelia51/frontend/src/components/SmartKBWidget.jsx)

API Key 字段使用 `type="password"`（正确），但自定义模型名和 API Base 使用 `type="text"`。API Base 作为明文 URL 合理，但模型名不应有隐私风险。此条为确认——无实际泄漏面。

### 4. DeleteUser 未清理关联数据

[handler/tool.go](/D:/07_Projects/code/Oxelia51/backend/internal/handler/tool.go) `DeleteUser` 仅执行 `DELETE FROM users WHERE id = $1`，未级联删除或检查：

- `login_logs` 表中的用户记录
- 用户可能持有的 API Keys（若 `api_keys` 表有关联）
- 用户创建的文章（当前 admin 创建，但未来可能有用户文章）

当前数据模型中文章无 `author_id`（管理员创建），API keys 表不确定结构。**建议**：至少添加 `login_logs` 清理（`DELETE FROM login_logs WHERE user_id = $1` 在 `DELETE FROM users` 之前）。

### 5. roles 下拉无撤销 admin 确认

[Admin.jsx](/D:/07_Projects/code/Oxelia51/frontend/src/pages/Admin.jsx)

用户列表的 role 列从静态 badge 改为 `<select>` 下拉后，管理员可以一键将其他用户的 role 从 admin 改为 user（反之亦然），无确认弹窗。这与删除操作的 `DELETE <account_id>` 多重确认形成对比。

**建议**：降级 admin→user 时弹出确认对话框（`window.confirm`），防止误操作。从 user→admin 升权保留快捷行为。

---

## 参考（可选修复）3 项

### 6. SmartKBWidget isCustomModel 状态使用 localStorage 而非 URL 持久化

自定义模型参数存储在 `localStorage`（正确选择），但会话恢复时直接从 localStorage 读取。若用户清除浏览器数据，设置会丢失。可考虑将 preset 模型选择同步到后端偏好设置。

### 7. 构建脚本中 step 编号未平滑

`build-all-tools.bat` 移除 MusicBox/CS2Lab 后，步骤编号改写为 `[1/4]` 至 `[4/4]`（正确）。但未添加 SmartKB 的构建步骤——SmartKB 部署在腾讯云独立构建，不在本地构建批次中（有意设计，SmartKB 在腾讯云 4C4G 服务器上编译）。

### 8. CSS 修复项总结（已确认正确）

| 修复 | 文件 | 状态 |
|------|------|------|
| 移动端 Navbar separator 延伸到边缘 | [Navbar.css](/D:/07_Projects/code/Oxelia51/frontend/src/components/Navbar.css) | ✅ `width: calc(100% + 40px); margin: 8px -20px` |
| 首页 section 间距分隔线 | [Landing.css](/D:/07_Projects/code/Oxelia51/frontend/src/pages/Landing.css) | ✅ `border-bottom: 1px solid var(--border)` |
| 移动端 landing margin-top 对齐 | [Landing.css](/D:/07_Projects/code/Oxelia51/frontend/src/pages/Landing.css) | ✅ `-50px` |
| 移动端 root padding 修正 | [index.css](/D:/07_Projects/code/Oxelia51/frontend/src/index.css) | ✅ `padding: 50px 16px 0` |

---

## 正确实现项目确认

| 变更 | 文件 | 评价 |
|------|------|------|
| 注册数据暂存 Redis（防未验证占 username） | [auth.go](/D:/07_Projects/code/Oxelia51/backend/internal/handler/auth.go) + [store.go](/D:/07_Projects/code/Oxelia51/backend/internal/auth/store.go) | ✅ 架构合理。defer-until-verified 消除僵尸行。|
| VerifyEmail 中账户重复二次校验 | [auth.go:178-192](/D:/07_Projects/code/Oxelia51/backend/internal/handler/auth.go:178) | ✅ 防御 TOCTOU 竞态。|
| DeleteUser 多重确认 + 防删自己 | [tool.go](/D:/07_Projects/code/Oxelia51/backend/internal/handler/tool.go) | ✅ "DELETE <account_id>" 挑战 + account_id DB 校验 + 自删保护。|
| Admin 危险按钮样式 | [Admin.css](/D:/07_Projects/code/Oxelia51/frontend/src/pages/Admin.css) | ✅ `#dc2626` 亮红，hover `#b91c1c`。|
| SmartKB SSRF 防护 | [smartkb.go](/D:/07_Projects/code/SmartKB/internal/handler/smartkb.go) | ✅ `req.APIBase != "" && req.APIKey == ""` 拦截。环境变量 API Key 不泄露给自定义端点。|
| SmartKB ILIKE 中文回退 | [kb.go](/D:/07_Projects/code/SmartKB/internal/db/kb.go) | ✅ tsquery 0 结果时 ILIKE 回退，closed rows2。|
| SmartKB 系统提示词改进 | [smartkb.go](/D:/07_Projects/code/SmartKB/internal/handler/smartkb.go) | ✅ 4 条清晰规则 + unknown handling + Oxelia51 context。|
| SmartKB isCustomModel 独立 state | [SmartKBWidget.jsx](/D:/07_Projects/code/Oxelia51/frontend/src/components/SmartKBWidget.jsx) | ✅ 独立 `useState` 解决预设列表不含 '__custom__' 导致的打字消失问题。|
| CS2Lab/MusicBox 清理 | seed-tools.sql + build-all-tools.bat + deploy-all-tools.sh + deploy/README.md | ✅ 4 个文件完整清理，无遗漏引用。|
| username UNIQUE 约束移除 | [migration 013](/D:/07_Projects/code/Oxelia51/backend/migrations/013_username_not_unique.up.sql) + [init migration](/D:/07_Projects/code/Oxelia51/backend/migrations/001_user.up.sql) | ✅ DROP CONSTRAINT IF EXISTS + init schema 同步。|
| SmartKB 腾讯云部署文档 | [deploy/README.md](/D:/07_Projects/code/Oxelia51/deploy/README.md) | ✅ 新增 SmartKB :8007 行 + Ollama 说明。|

---

## 总结

- **9 commits / 19 files** 变更审查完成
- **1 严重**：ResendVerification 因 store 迁移断裂，新注册用户无法重发验证邮件
- **4 建议**：VerifyEmail 错误处理不一致、DeleteUser 缺级联清理、角色降级无确认、CSS 已确认
- **11 项实现**全部正确，特别是 SSRF 防护、注册暂存、DeleteUser 多重确认质量高
- 推荐的修复顺序：**#1（严重）→ #2（建议）→ #4（建议）→ #3（建议）**