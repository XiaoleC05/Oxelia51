# ADR-007: DormGuard 内网化、认证改造与数据库边界

**日期**：2026-07-05  
**状态**：已采纳  
**修订**：回应 Codex 契约审查 P0（D2/D5/M3/M4）

---

## 背景

现网 DormGuard 审计结论：

| 项目 | 现状 |
|------|------|
| 部署 | `oxelia51.com/` + Nginx `location /api/` → `:8000` |
| 认证 | 单用户 `root`，自研 HMAC JWT，`get_current_user` 保护私有路由 |
| 密码 | `.env` 中 `ADMIN_PASSWORD` |
| Token 有效期 | 168h（7 天） |
| 数据库 | **独立 MySQL** `dorm_guard` |

平台契约规划：Go 网关 + 平台 JWT + 管理者 `oxelia51`。两套认证与 `/api/` 前缀存在冲突（见 ADR-006 §Nginx 共存）。

## 决策

### 1. 数据库边界

**DormGuard 保持独立 MySQL，不迁入平台 PostgreSQL。**

| 系统 | 数据库 | 职责 |
|------|--------|------|
| Oxelia51 平台 | PostgreSQL | users、tools、portfolio、邮件 token、JWT 黑名单 |
| DormGuard | MySQL `dorm_guard` | power_records、alert_rules、alert_logs |

网关仅 HTTP 转发，不合并 schema。

### 2. 用户体系不合并

| 账号 | 所属系统 | 用途 |
|------|----------|------|
| `oxelia51` | 平台 PostgreSQL | 平台管理者 |
| `root`（或 `.env` 配置名） | DormGuard `.env` | **现网独立站**日常登录，切换日前保持不变 |

**不做** `root` → `oxelia51` 映射。平台用户与 DormGuard 本地管理员是两套身份。

### 3. DormGuard 网关模式（代码改造范围）

新增环境变量：

```env
OXELIA_GATEWAY_MODE=false   # 现网默认 false，保持独立 JWT
OXELIA_GATEWAY_SECRET=...   # 网关模式校验（可选）
```

当 `OXELIA_GATEWAY_MODE=true` 且请求来自 `127.0.0.1` / 内网：

- 信任平台注入的请求头（见 gateway-contract.md §4）；
- **跳过** `_bearer` / `get_current_user` JWT 校验；
- 仅用于平台网关转发路径，**不影响**现网 `OXELIA_GATEWAY_MODE=false` 时的 `root` 登录。

现网生产配置保持 `OXELIA_GATEWAY_MODE=false`，直至 ADR-006 切换日。

### 4. CORS 开发期补充

DormGuard `allow_origins` 增加：

- `http://localhost:5173`
- `http://127.0.0.1:5173`

（审查项 D3；仅开发联调，生产仍限制域名。）

### 5. 现网 session 过渡

- 切换日前：DormGuard 独立 JWT 继续有效，无平台侧吊销操作。
- 切换日：Nginx 不再将公网 `/api/` 直连 DormGuard；用户改从 `/tools/dormguard` + 平台登录访问。
- DormGuard 旧 bookmark / 独立前端：切换日可选 302 或保留子路径只读说明页。

### 6. 阶段 1 工具目录状态（DormGuard）

| 字段 | 阶段 1 值 | 说明 |
|------|-----------|------|
| `online_capable` | `true` | 可经网关内测 |
| `user_accessible` | `false` | 普通用户不可用 |
| `status` | `enabled` | 非下线；管理者可通过网关内测 |

UI 徽章：对普通用户显示「暂未开放」；`oxelia51` 可进入 `/tools/dormguard`。

## 理由

- 独立 MySQL 避免迁移电费历史数据风险，符合「不影响现网 DormGuard」原则。
- 网关模式开关使 DormGuard 改造可渐进，现网零改动直至切换日。
- 平台与工具管理员分离，避免密码与 token 体系强行统一。

## 影响

- DormGuard 仓库需实现 `OXELIA_GATEWAY_MODE` 分支（任务 DG-INT-01）。
- 阶段 1 平台与现网 API **端口隔离**（ADR-006），无 Nginx `/api/` 冲突。
- Codex 审查 M3「root 迁移」关闭：改为双账号共存说明。
