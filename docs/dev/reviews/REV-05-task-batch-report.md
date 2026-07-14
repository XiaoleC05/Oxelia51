# REV-05 Tasks 1-9 全量代码审查报告

**审查日期**：2026-07-07  
**审查员**：Trae Work + Kimi K2.7 Code  
**基线**：AGENTS.md v2.0、docs/07-需求确认摘要.md（契约 v1.1）  
**结论**：**有条件通过** —— 无 P0 阻断问题，P1 问题需在合并前修复，P2 问题建议在本批次内清理。

---

## 1. 审查总结

本次变更围绕 **account_id 账号体系重构** 与 **前端页面/视觉增强** 两大主题，后端由 Cursor 完成，前端由 Codex / Qoder Wake 完成。

### 后端（Task E）

- 成功引入 `account_id` 作为不可变唯一登录标识，`username` 降级为可修改显示名。
- 注册、登录、管理端用户列表、管理员种子均已适配 `account_id`。
- 新增 `PATCH /api/auth/profile` 供用户修改自己的 `username`。
- 迁移脚本 `009_account_id.up.sql` 对存量数据做了回填与 NOT NULL 约束，回滚脚本完整。
- `go build ./...` 通过。

### 前端（Tasks 1-4, 6-7, 9 + Task E 适配）

- 新增 `/friends` 友情链接页、`/profile` 个人资料页、全局 `MouseGlow` 鼠标光晕效果。
- 登录页改为 `account` 字段（支持 account_id 或邮箱），注册页新增 `account_id` 字段。
- Auth.css 创意分屏样式统一应用到 Login / Register / Profile，视觉一致性较好。
- 移除所有页面中的 `chapter-num` 相关 class，清理彻底。
- `npm run build` 零 error、零 warning 通过。

### 关键风险

- `PatchProfile` 对空字符串 `username` 缺少防御，可能把显示名更新为空。
- `Landing.css` 存在两条重复/冲突的“奇偶交替背景”规则，长期会造成维护困惑。
- `Login.jsx` 移除了重发验证链接，但错误文案仍提示用户“可重发验证邮件”，文案未同步。

---

## 2. 发现的问题（P0 / P1 / P2）

### P0 — 无

本次批次未发现阻断构建、阻断登录流程或导致数据丢失的 P0 问题。

---

### P1 — 需在合并前修复

| 编号 | 位置 | 问题 | 影响 | 建议修复 |
|------|------|------|------|----------|
| P1-1 | `backend/internal/handler/auth.go:438-481` | `PatchProfile` 使用 `COALESCE($2, username)`，若请求传 `""` 空字符串（指针非 nil），会把 `username` 更新为空。 | 用户可能无意/恶意将显示名置空，破坏后续展示。 | 在绑定后增加 `strings.TrimSpace` 与空串校验：`if req.Username == nil || *req.Username == ""` 返回 400；或改用 `NULLIF($2, '')` 配合 COALESCE。 |
| P1-2 | `frontend/src/pages/Landing.css:170-258` | 同时存在 `.landing-content-sections > section:nth-of-type(even)` 与 `.landing-section:nth-child(even)` 两套交替背景规则，后者选择器优先级低且被前者覆盖。 | 样式冗余、维护者无法判断哪条生效；未来调整时容易改错。 | 删除 `.landing-section:nth-child(even)` 及其注释（第 250-257 行），仅保留 `.landing-content-sections > section:nth-of-type(even)` 规则。 |
| P1-3 | `frontend/src/pages/Login.jsx:77-82` | 错误提示文案仍包含“未收到？可重发验证邮件”，但本次任务已移除重发验证邮件链接/入口。 | 用户看到可操作提示却无法操作，产生困惑。 | 同步文案为“邮箱未验证，请查收验证邮件或联系站长”，或保留重发入口（若业务需要）。 |

---

### P2 — 建议本批次内清理

| 编号 | 位置 | 问题 | 影响 | 建议修复 |
|------|------|------|------|----------|
| P2-1 | `frontend/src/pages/Profile.jsx:41-59` / `:61-72` | 加载态与正常态各自重复书写整段 `auth-brand` 品牌面板 JSX。 | 与 Login.jsx / Register.jsx 共三处重复，后续品牌文案/动画调整成本高。 | 抽取 `<AuthBrand />` 组件到 `frontend/src/components/AuthBrand.jsx`，在三处复用。 |
| P2-2 | `frontend/src/pages/Profile.jsx:87-95` | 邮箱字段只读但未加 `auth-field--readonly` class，样式与账号 ID 字段不一致。 | 视觉上邮箱像可编辑，降低可信度。 | 将外层 `<div className="auth-field">` 改为 `<div className="auth-field auth-field--readonly">`。 |
| P2-3 | `frontend/src/index.css:97-99` | `.chapter-num` 定义已删除，但保留空的 `/* ---- Chapter number ---- */` 注释块。 | 死注释，无功能价值。 | 删除该注释块。 |
| P2-4 | `frontend/src/pages/Friends.jsx:3-6` | 友情链接数据硬编码为 `example.com` / `placeholder.com` 示例。 | 页面上线后展示占位内容，不符合平台调性。 | 改为从后端 API 读取（需新增接口），或在部署前替换为真实友链；至少加 TODO 标注。 |
| P2-5 | `frontend/src/pages/Login.jsx:27-30` | 错误处理通过 `err.message.includes('邮箱')` 判断未验证状态，依赖后端文案而非错误码。 | 后端文案微调即会导致提示逻辑失效。 | 建议后端在 403 响应体增加 `code: "EMAIL_NOT_VERIFIED"`，前端按 `err.code` 判断。 |
| P2-6 | `frontend/src/effects/MouseGlow.css:12` | `.mouse-glow` 使用 `z-index: 0`，在某些浏览器/叠加场景下可能被正文背景部分遮挡。 | 光晕效果可能不明显或失效。 | 提升至 `z-index: -1` 并确保 `body`/`#root` 背景位于其上方，或提升至 `z-index: 1` 并确保 `pointer-events: none`。 |
| P2-7 | `frontend/src/pages/Landing.css:482-492` | Footer 使用 `width: 100vw` + `margin-left: calc(-50vw + 50%)`，在存在垂直滚动条时可能触发水平滚动条（100vw 包含滚动条宽度）。 | 小屏幕下可能出现不必要的横向滚动。 | 改用 `width: 100%` 配合 `margin-left: calc(-1 * clamp(24px, 5vw, 80px)); margin-right: 相同`，与 `.landing` 做法保持一致。 |

---

## 3. 各文件变更摘要

### 后端

| 文件 | 变更内容 | 质量评价 |
|------|----------|----------|
| `backend/cmd/server/main.go` | 在 `protected` 路由组注册 `PATCH /api/auth/profile`。 | ✅ 路由位置正确，受 JWT 保护。 |
| `backend/internal/admin/seed.go` | 管理员种子写入 `account_id = username = "oxelia51"`，保持唯一管理者账号不变。 | ✅ 符合 ADR-005。 |
| `backend/internal/handler/auth.go` | Register 新增 `account_id` 校验与唯一冲突处理；Login 支持 `account` 字段按 `@` 区分 email/account_id；新增 `PatchProfile`；新增 `fetchUserByAccountID`。 | ⚠️ 整体稳健，见 P1-1。 |
| `backend/internal/handler/tool.go` | `ListUsers` 返回字段增加 `account_id`。 | ✅ 与管理端用户表需求一致。 |
| `backend/internal/model/user.go` | `User`/`RegisterRequest`/`LoginRequest` 增加 `account_id`/`account`；新增 `PatchProfileRequest`。 | ✅ 模型清晰。 |
| `backend/migrations/009_account_id.up.sql` | 添加列、回填、NOT NULL、唯一索引。 | ✅ 向后兼容，可安全迁移。 |
| `backend/migrations/009_account_id.down.sql` | 删除索引与列。 | ✅ 回滚完整。 |

### 前端

| 文件 | 变更内容 | 质量评价 |
|------|----------|----------|
| `frontend/src/App.jsx` | 新增 `/friends`、`/profile` 路由；全局渲染 `<MouseGlow />`。 | ✅ 路由结构清晰。 |
| `frontend/src/components/Navbar.jsx` | 新增友链、资料入口；补充 `IconProfile`、`IconLink` SVG。 | ✅ 命名一致，图标风格统一。 |
| `frontend/src/index.css` | 删除 `.chapter-num` 定义。 | ⚠️ 死注释未清，见 P2-3。 |
| `frontend/src/pages/About.jsx` / `Admin.jsx` / `Blog.jsx` / `Portfolio.jsx` / `Tools.jsx` | 移除 `chapter-num` 使用。 | ✅ 清理彻底。 |
| `frontend/src/pages/Auth.css` | 新增分屏品牌面板、浮动几何图形、输入框下划线、响应式断点。 | ✅ 选择器均以 `.auth-` 为前缀，未污染全局。 |
| `frontend/src/pages/Landing.css` | 内容区 section 奇偶交替背景、footer 全宽深色分栏。 | ⚠️ 规则重复，见 P1-2、P2-7。 |
| `frontend/src/pages/Login.jsx` | 使用 `account` 字段登录；错误提示调整。 | ⚠️ 文案与移除的链接不匹配，见 P1-3、P2-5。 |
| `frontend/src/pages/Register.jsx` | 新增 `account_id` 字段，客户端校验 pattern/minLength/maxLength。 | ✅ 前后端校验口径一致。 |
| `frontend/src/effects/MouseGlow.jsx` + `.css` | 鼠标跟随光晕，对触屏/减少动画场景自动禁用。 | ✅ 考虑无障碍，见 P2-6。 |
| `frontend/src/pages/Friends.jsx` + `.css` | 新友链页面，网格卡片布局，移动端单列。 | ⚠️ 数据为占位符，见 P2-4。 |
| `frontend/src/pages/Profile.jsx` | 新个人资料页，读取 `/users/me`，支持修改 username。 | ⚠️ 重复 JSX 与只读样式不一致，见 P2-1、P2-2。 |

---

## 4. 重构建议

1. **抽取 `AuthBrand` 组件**（P2-1）
   - 将 Login / Register / Profile 中重复的品牌面板 JSX 抽取为 `frontend/src/components/AuthBrand.jsx`。
   - 三处均改为 `<AuthBrand tagline="探索 · 创造 · 分享" />`。

2. **统一认证表单状态管理**（非阻塞，可后续）
   - Login / Register / Profile 的提交逻辑（`setSubmitting(true)`、`try/catch/finally`、错误/成功提示）结构相似，但字段差异较大。当前提取 hook 收益有限，保持现状即可；若后续增加更多字段，再考虑 `useAuthForm`。

3. **后端 `PatchProfile` 校验强化**（P1-1）
   - 建议同时限制 `username` 字符白名单（与注册一致），防止注入特殊字符影响前端展示或 admin 列表导出。

4. **Landing 样式去重**（P1-2）
   - 删除 `.landing-section:nth-child(even)` 规则，并检查 `.landing-section` 是否仍需显式 `background: var(--bg)`（已被全局/父级覆盖可删）。

5. **错误码契约**（P2-5）
   - 后端 `apiError` 已返回 `code` 字段，建议前端 `api/index.js` 将 `data.code` 透传到 Error 对象，页面按 code 判断业务状态。

---

## 5. 文档更新建议

| 文档 | 是否需更新 | 说明 |
|------|------------|------|
| `AGENTS.md` | 否 | v2.0 已落地，本次无角色/流程变更。 |
| `README.md` / `README_CN.md` | 建议更新 | 新增 `/friends`、`/profile` 路由；登录方式由“邮箱”改为“账号 ID 或邮箱”；注册字段增加账号 ID。 |
| `docs/api/platform-api.md` | 建议更新 | 补充 `PATCH /api/auth/profile` 接口契约、请求/响应字段、错误码（`USERNAME_TAKEN`、`EMAIL_NOT_VERIFIED` 等）。 |
| `CHANGELOG` | 建议创建 | 项目目前无 CHANGELOG。建议以本次批次为契机创建 `CHANGELOG.md`，记录“新增 account_id 账号体系、新增友链/资料页、登录页视觉升级”。 |
| `docs/adr/` | 可选 | account_id 是 v1.2 需求变更，若超出契约 v1.1 范围，建议追加 ADR 说明“为何将 username 拆分为 account_id + 显示名”。 |

---

## 6. 构建与验证

| 命令 | 结果 | 备注 |
|------|------|------|
| `npm run build`（frontend） | ✅ 通过，零 error、零 warning | 生产包大小：CSS 51 kB / JS 323 kB |
| `go build ./...`（backend） | ✅ 通过 | 无输出即成功 |
| `npm run lint`（frontend） | ❌ 21 errors，0 warnings | 全部为既有代码问题（Admin/ArticleDetail/Blog/Home/Landing/VerifyEmail/DormGuardTool），**非本次任务新增文件引入**。本次新增文件 Friends.jsx、Profile.jsx、MouseGlow.jsx、Register.jsx、Login.jsx 未产生 lint 错误。 |

---

## 7. 放行意见

- **后端**：修复 P1-1 后即可合并。
- **前端**：修复 P1-2、P1-3 后合并；P2-1、P2-2、P2-3 建议同批次处理，成本低。
- **文档**：建议同步更新 `docs/api/platform-api.md` 与 `README.md`，并创建 `CHANGELOG.md`。

**最终结论**：本次批次功能实现完整、构建通过，修正如上 P1 问题后准予进入下一阶段。
