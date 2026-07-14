# P10 审查：用户/管理员权限与内容可见性

**日期**：2026-07-15 | **审查人**：Codex
**范围**：导航栏、路由、API 中间件、工具权限、页面渲染逻辑

---

## 权限矩阵

| # | 页面/组件 | 未登录 | 普通用户 (user) | 管理员 (admin) |
|---|----------|--------|----------------|---------------|
| 1 | **首页 `/`** | 完整可见。Hero、统计栏、时间线、Bug 卡片、CTA「免费注册」 | 完整可见。CTA 变为「浏览工具」 | 同普通用户 |
| 2 | **导航栏：首页/工具/博客/关于** | 可见 | 可见 | 可见 |
| 3 | **导航栏：「管理」入口** | 隐藏 | 隐藏 | **可见** |
| 4 | **导航栏：搜索/主题切换** | 可见 | 可见 | 可见 |
| 5 | **导航栏：用户菜单** | 「账户」→ 下拉显示「登录」「注册」 | 用户名 + 下拉（资料/密钥/退出） | 用户名 + 下拉（资料/密钥/退出） |
| 6 | **`/tools` 工具目录** | 完整可见 | 完整可见 | 完整可见 |
| 7 | **`/tools/:slug` 工具壳** | 重定向到 `/login` | 可用。受 `user_accessible` 限制 | 全部工具可用。跳过 `user_accessible` |
| 8 | **`/blog` + `/blog/:id`** | 完整可见 | 完整可见 | 完整可见 |
| 9 | **`/about` 关于开发者** | 完整可见 | 完整可见 | 完整可见 |
| 10 | **`/friends` 友情链接** | 完整可见 | 完整可见 | 完整可见 |
| 11 | **`/login` `/register` 等认证页** | 可用 | 可访问但无意义 | 同普通用户 |
| 12 | **`/profile` 个人资料** | 页面加载，API 返回 401 | 可修改显示名 | 同普通用户 |
| 13 | **`/settings/keys` API 密钥** | 页面加载，API 返回 401 | 可管理密钥 | 同普通用户 |
| 14 | **`/admin` 管理后台** | 页面加载，API 全部 401 | 页面加载，API 全部 403 | **完整可用** |
| 15 | **全局页脚** | 完整可见 | 完整可见 | 完整可见 |
| 16 | **SmartKB 浮球** | 可见 | 可见 | 可见 |
| 17 | **回顶按钮/滚动进度条** | 可见 | 可见 | 可见 |

---

## 管理员独有功能明细

| 功能 | API 路由 | 中间件 |
|------|---------|--------|
| 工具元数据 CRUD | `GET/PATCH /api/admin/tools` | auth + RequireAdmin |
| 扫描本地工具 | `POST /api/admin/tools/scan-local` | auth + RequireAdmin |
| 用户列表与编辑 | `GET/PATCH /api/admin/users` | auth + RequireAdmin |
| 作品集管理 | `GET/PUT /api/admin/portfolio` | auth + RequireAdmin |
| 头图轮播管理 | `GET/POST/PUT/DELETE /api/admin/hero-images` | auth + RequireAdmin |
| 上传头图 | `POST /api/admin/hero-images/upload` | auth + RequireAdmin |
| 轮播设置 | `PUT /api/admin/carousel-settings` | auth + RequireAdmin |
| 开发者资料编辑 | `GET/PATCH /api/admin/developer/profile` | auth + RequireAdmin |
| 文章 CRUD（含页面） | `GET/POST/PUT/DELETE /api/admin/articles` | auth + RequireAdmin |
| 服务器资源监控 | `GET /api/admin/server-stats` | auth + RequireAdmin |
| 仪表盘统计 | `GET /api/admin/dashboard-stats` | auth + RequireAdmin |

---

## 工具权限模型（`user_accessible`）

`gateway/access.go` `CheckAccess()` 逻辑：

```text
1. online_capable=false → 404 TOOL_NOT_ONLINE
2. status=disabled      → 503 TOOL_OFFLINE
3. role=admin           → 直接放行（跳过 user_accessible）
4. user_accessible=false → 403 TOOL_NOT_ACCESSIBLE
5. 其他                 → 放行
```

**结论**：管理员可访问所有工具（无论 `user_accessible` 值）。普通用户仅可访问 `user_accessible=true` 的工具。

---

## 前端 vs 后端守卫对比

| 层面 | 实现 | 强度 |
|------|------|------|
| React Router | 无路由守卫，所有页面 URL 可直接访问 | 弱 |
| `ToolShell.jsx` | `!token` 时 `navigate('/login')` | 中 |
| `Admin.jsx` | **无前端守卫** | 弱 |
| 后端 public API | 无认证 | — |
| 后端 protected API | `authMW.Handle()`：JWT + jti 黑名单 + email_verified | 强 |
| 后端 admin API | `authMW.Handle()` + `RequireAdmin()` | 强 |
| 网关代理 | `CheckAccess()`：role + user_accessible + status | 强 |

**风险点**：未登录用户访问 `/admin` 时，React 页面组件会渲染（可能空白或报错），但所有后端 API 返回 401/403。后端防线有效——前端仅影响 UX。

---

## [建议] 1 项

### `Admin.jsx` 缺少前端重定向

`ToolShell.jsx` 检测 `!token` → `navigate('/login')`，但 `Admin.jsx` 没有等效守卫。未登录用户手动访问 `/admin` 看到报错而非友好重定向。

**建议**：在 `Admin.jsx` 添加 token 检查 + 重定向逻辑（3 行代码）。

---

## 验证通过项

| 检查点 | 状态 |
|--------|------|
| 管理员可绕过 user_accessible（设计如此） | ✅ |
| 管理员导航栏多出「管理」入口 | ✅ Navbar.jsx `user?.role === 'admin'` |
| 未登录用户无法调用任何 protected API | ✅ auth 中间件 |
| 普通用户无法调用 admin API | ✅ RequireAdmin 中间件 |
| 网关代理正确区分 admin/user | ✅ CheckAccess role=admin 分支 |
| 首页 CTA 按钮根据登录状态切换 | ✅ Landing.jsx `isLoggedIn` |
| 导航栏用户菜单根据登录状态切换 | ✅ Navbar.jsx `token && user` |
| API 响应不含密码字段 | ✅ `user.Password = ""` |
| ToolShell 未登录自动重定向 | ✅ `navigate('/login')` |