# Oxelia51 审查续报（REV-Full-2）

**审查日期**：2026-07-06
**基线**：f7f26d5（Admin UI）+ 58bfcc4（P1+P2 fixes）

## 新增代码审查

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| N1 | P2 | handler/tool.go:ListUsers + model/user.go:AdminUserItem | ListUsers 的 SQL 不 SELECT password，AdminUserItem 结构体无 Password 字段 | 确认无泄漏 |
| N2 | P1 | handler/tool.go:PatchUser + middleware chain | PATCH /admin/users/:id 未防止 admin 把自己降级为 user | 在 PatchUser 中添加：if id == currentUserID { return 422 CANNOT_DEMOTE_SELF }。当前用户 ID 需从 JWT claims 提取 |
| N3 | P2 | frontend/Admin.jsx:113 | description_override 留空时发送空字符串 ""，COALESCE("", description_override) = ""，而非回退至 manifest 原文 | 后端将 COALESCE($4, description_override) 改为 NULLIF($4, '')，或前端在值为空时发送 null/不发送该字段 |
| N4 | P2 | frontend/Admin.jsx:107 | Admin.jsx 中 admin 角色检查是客户端只读判断（不阻断请求），无引导提示 | 用户可见级别较低；后端鉴权已正确，此项为 UX 改善 |
| N5 | P3 | frontend/Admin.jsx | 用户列表无分页 | 当前项目用户量小，可接受 |
| N6 | P1 | frontend/Admin.jsx | scan-local API 后端 60s 超时但前端 fetch 无 timeout。若后端在 60s 后无响应，前端可能无限等待 | 添加 AbortController timeout（如 65s）或前端 loading 态继续展示 |
| N7 | P2 | frontend/Admin.jsx | admin 路由未添加登录守卫，未登录用户直接访问 /admin 看到"仅管理员可访问"（不跳转登录）| 添加 useEffect 检查 token，无 token 时 navigate('/login', { state: { from: '/admin' } }) |

## 修复验证（上轮 P1+P2）

| 编号 | 验证结果 | 说明 |
|------|----------|------|
| S2 config.go Validate() | **已修复** | main.go 调用 cfg.Validate() 启动时检查 JWT_SECRET 和 DB_PASSWORD |
| S7 DormGuard auth.py | **已修复** | 拒绝 3 段 JWT（防 alg=none）；_is_trusted_gateway_client 用 ipaddress.is_loopback；可选 OXELIA_GATEWAY_SECRET；header 验证全面 |
| S4 env_manager.py | **已修复** | _acquire_lock fcntl.LOCK_EX + try/finally 释放；read 路径无锁（可接受）|
| D1 deploy.sh flock | **已修复** | exec 9"$LOCK_FILE" + flock -n 9；若锁定则 exit 0；自动释放 |
| UI1 ToolShell 闪现 | **已修复** | if (!token) return null 阻止渲染 |
| L5 Tools.jsx canUseTool | **已修复** | 导入并使用 canUseTool(t, user) |
| B2 VerifyEmail 区分错误 | **已修复** | invalid / network-error / success 三态 |
| U3 ResetPassword minLength | **已修复** | 两个密码输入框 minLength=8 + maxLength=128 |
| U5 Register loading | **已修复** | submitting 状态 + button disabled；ResetPassword 仍缺（见 R2）|
| B1 DormGuardTool key | **已修复** | 历史表使用 r.id 代替 index i；但该响应字段缺少 id 时回退逻辑未处理 | 见新问题 N8 |

### 修复未覆盖 / 不完整

| 原编号 | 状态 | 说明 |
|--------|------|------|
| B3 ForgotPassword 生产文案 | **未修复** | 仍显示"开发模式请查看后端日志" | 建议修复 |
| B4 QQ_BOT_ENABLED bool 转换 | **仍需测试** | DormGuard config.py 中 QQ_BOT_ENABLED 字段类型是 bool + pydantic_settings；从 .env 读取字符串 'true'/'false' 时，pydantic 行为未验证 |
| B5 apply-release.sh PG 超时 | **未修复** | PG 30 轮超时后仍继续执行 | 建议超时后 exit 1 |
| S6 X-Oxelia51-Access-Token | **未修复** | 前端同时发送 Authorization 和 X-Oxelia51-Access-Token | 安全风险低但推荐后续清理 |
| U2 Register 2s 延迟 | **未修复** | 注册成功后的 2s 延迟跳转仍存在 | 不影响功能 |

## 补全维度

### 维度A：Admin UI 专项

| 编号 | 严重度 | 问题 | 建议 |
|------|--------|------|------|
| A1 | P3 | Admin.jsx 使用 React JSX 无 XSS 风险（React 自动转义） | 无操作 |
| A2 | P2 | 编辑弹窗表单验证弱：user_accessible 和 status 无确认步骤，误操作无撤销 | 添加确认对话框；考虑记录 audit log |
| A3 | P1 | 扫描 manifest 按钮 60s 超时期间前端无进度反馈（仅 spinner），长时间无响应用户可能刷新页面导致并发扫描 | 添加 AbortController + 进度条/超时提示 |
| A4 | P3 | 用户列表无分页 | OMIT（当前规模无需） |
| A5 | P3 | 批量操作为评估 | OMIT |

### 维度B：并发与竞态

| 编号 | 严重度 | 问题 | 建议 |
|------|--------|------|------|
| B1 | P1 | CI 中 go test -race 未运行（deploy.yml 只有 go vet + go test，无 -race 标志）| 将 go test 改为 go test -race ./... |
| B2 | P3 | PATCH /admin/users/:id 与用户自行修改密码无直接冲突（不同字段）| 当前 OK，后续若引入用户修改自身 profile 需关注 |
| B3 | P2 | env_manager 文件锁在 write 时获取，但不保护 read。重启服务发生在锁释放后 | 建议 read 也获取共享锁 (LOCK_SH) 防止读到部分写入 | 当前 write_text 非原子操作，read 可能读到不完整内容 |

### 维度C：数据一致性

| 编号 | 严重度 | 问题 | 建议 |
|------|--------|------|------|
| C1 | P1 | ListUsers SELECT 不包含 updated_at，PatchTool UPDATE 后 updated_at 自增但 ListUsers 不返回 | 将 updated_at 加入 AdminUserItem 和 ListUsers SQL |
| C2 | P2 | COALESCE(description_override, description) 在 List、Get、ListTools、PatchTool 四个位置一致 | 已一致 |
| C3 | P1 | manifest 扫描覆盖更新时 description_override 不会被清空（扫描逻辑遵守"不自动改写 user_accessible"原则）。但若 manifest 中 description 被删除，旧的 description_override 可能不匹配 | 当前行为正确：scan-local 不修改 description_override。后续若需清除，加 --reset-overrides 标志 |
| C4 | P2 | 无用户删除 API。若日后实现删除，需考虑：被删除用户的 JWT 在 expiry 前仍有效（当前 blacklist 仅存登出添加的 jti）| 建议删除用户时将其活跃 session 的 jti 加入黑名单 |

### 维度D：前端状态管理

| 编号 | 严重度 | 问题 | 建议 |
|------|--------|------|------|
| D1 | P2 | Admin 修改用户角色后，该用户需重新登录才能改变 Navbar 中 admin 入口的可见性（user 对象存 localStorage）| 短期可接受。长期可考虑 WebSocket 推送或页面 refresh 时重新获取 user 数据 |
| D2 | P1 | Token 过期后 Admin 页面 API 调用返回 401，但页面无跳转登录行为，仅显示 generic error | 在 apiGet/apiPost/apiPatch 的 parseResponse 中拦截 401 → 调用 logout() + navigate('/login')，或 Admin.jsx 监听 401 |
| D3 | P2 | Tab 切换时 useEffect 依赖 tab 变化触发 loadData，数据正确刷新 | 已正确 |
| D4 | P3 | Admin.jsx 从 localStorage 读取 user（getStoredUser），直读而非通过 context/state 传递 | 与 Navbar 一致，可接受但后续建议统一至 AuthContext |

## 新发现问题汇总

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| N2 | P1 | handler/tool.go PatchUser | admin 可把自己降级为 user，锁死管理后台 | 添加当前用户 ID 比对：if id === currentUserID { return 422 CANNOT_DEMOTE_SELF } |
| N3 | P2 | frontend/Admin.jsx + handler/tool.go PatchTool | description_override 空字符串被当作有效值写入，无法恢复 manifest 原文 | 后端改为 NULLIF($4, '') 或前端不发送空字符串 |
| N6 | P1 | frontend/Admin.jsx scan-local | 前端 fetch 无超时，后端 60s 超时后前端不会 abort | 添加 AbortController timeout |
| N7 | P2 | frontend/Admin.jsx | /admin 路由无登录守卫 | 添加 useEffect 检查 token |
| N8 | P2 | DormGuardTool.jsx | B1 已修复使用 r.id 代替 index i，但若 API 返回无 id 字段，map key 回退为 undefined | 确认 DormGuard 最新响应含 id 字段 |
| C1 | P1 | handler/tool.go ListUsers | updated_at 未被 SELECT 或返回 | 添加到 AdminUserItem 和 SQL |
| D2 | P1 | frontend/api/index.js | 401 响应无统一登出 + 跳转登录逻辑 | 在 parseResponse 中添加 401 自动处理 |
| B1 | P1 | .github/workflows/deploy.yml | go test 未加 -race | 改为 go test -race ./... |
| B3 | P2 | DormGuard env_manager.py | read 操作无读锁，可能读到部分写入内容 | 添加 LOCK_SH 读锁（可选）|

## 总体评价

上轮 P1+P2 修复整体质量高，10 项已验证通过 9 项（JWT 默认密钥、DormGuard auth alg=none 防护、.env 文件锁、部署互斥锁、前端闪现、canUseTool 统一、VerifyEmail 三态、密码 minLength、按钮 loading）。1 项仍缺（ResetPassword 无 loading 状态）。

新增 Admin UI 代码质量合格，路由鉴权正确、SQL 参数化。主要风险集中在 admin 自降级锁定（N2 P1）、description_override 无法恢复（N3 P2）、scan-local 前端超时（N6 P1）、401 无统一拦截（D2 P1）、CI 缺 -race（B1 P1）。

**总体评分：7.0/10**（上轮 6.5→7.0，因 P1+P2 修复质量高）
**上生产建议：待 N2 + N6 + D2 + B1 修复后，可进入受控公测**
