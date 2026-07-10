# Oxelia51 多 Agent 任务板

**版本**：v2.0 | **日期**：2026-07-07  
**规约状态**：v2.0 已冻结（依据 AGENTS.md v2.0 重构）

---

## 规约状态

| 文档 | 版本 | 状态 |
|------|------|------|
| 07-项目定位摘要.md | v1.1 | FROZEN |
| api/*.md | v1.1 | FROZEN |
| ADR-001~007 | v1.1 | 已采纳 |
| 08-契约审查修订记录.md | - | 持续更新 |

**规则**：任何修改规约或 ADR 需版本号 bump + 全体 Agent 周知。

---

## Agent 分工

角色定义与详细职责参见 [AGENTS.md §4](../AGENTS.md)。

| 角色 | 智能体 + 模型 |
|------|-------------|
| **架构智能体** | Codex + DeepSeek V4 Pro |
| **后端智能体** | Cursor + Qwen3.7-Max |
| **前端智能体** | Hermes + GLM-5.2 |
| **QA 与部署智能体** | Qoder + DeepSeek V4 Flash |
| **审查与知识智能体** | Trae Work + Kimi K2.7 Code |

---

## 全局任务

- [x] **AUTH-01** 邮箱认证 + 登录流程
- [x] **GW-01** 网关骨架（/api/tools/:slug/proxy/*path）
- [ ] 首页风格切换（ADR-006 阶段 2）——需开发者明确同意，任何 Agent 不得自行执行

---

## 任务列表

### Cursor（后端）

| ID | 任务 | 来源分支 | 范围 | 状态 |
|----|------|----------|------|------|
| AUTH-01 | 邮箱认证注册 + 登录 + 未认证提醒 | feature/email-verification | backend/ auth、mailer、migrations | **done** |
| AUTH-02 | 找回密码 / 重置 | feature/password-reset | 同上 | **done** |
| ADMIN-01 | 管理员用户 oxelia51 + 初始化配置 | feature/admin-seed | migrations、config、cmd | **done** |
| TOOL-01 | tools 表扩展 + manifest 扫描 API | feature/tool-registry-v2 | migrations、handler/tool、registry | **done** |
| GW-01 | API 网关 internal/gateway/ | feature/api-gateway | gateway、main.go | **done** |
| INT-01 | 路由注册与集成合并 | main 或集成 PR | main.go、App.jsx | **done** |
| **TASK-09** | **account_id 字段 + PatchProfile** | feature/account-id | backend/ auth、model、migrations | **done** |
| **TASK-10** | **阈值配置项迁移** | feature/threshold-config | backend/ config、DormGuard 对接 | **done** |
| **TASK-11** | **服务器资源监控** | feature/server-monitor | backend/ monitor、frontend/ admin | **done** |

### Hermes（前端页面）

| ID | 任务 | 来源分支 | 范围 | 依赖 | 状态 |
|----|------|----------|------|------|------|
| UI-01 | 首页 / | feature/landing-page | frontend/src/pages/Landing* | 无 | **done** |
| UI-02 | 工具目录 /tools | feature/tools-catalog | frontend/src/pages/Tools* | platform-api | **done** |
| UI-03 | 作品集 /portfolio | feature/portfolio | frontend/src/pages/Portfolio* | GET /api/portfolio | **done** |
| UI-04 | 认证/密码页 | feature/auth-pages | VerifyEmail、ResetPassword、Auth.css | AUTH-01/02 | **done** |
| UI-05 | 工具壳 /tools/:slug | feature/tool-shell | frontend/src/tools/ | GW-01 | **done** |
| **UI-06** | **全站视觉打磨 + 去 AI 味** | feature/ui-06-visual-polish | frontend/src/**/*.{css,jsx} | 无 | **done** |
| **UI-07** | **DormGuard 配置面板** | feature/dormguard-config | frontend/src/tools/dormguard/DormGuardTool.{jsx,css} | GW-01 | **done** |
| **UI-08** | **Friends 友情链接页** | feature/friends-page | frontend/src/pages/Friends* | 无 | **done** |
| **UI-09** | **Profile 个人资料页** | feature/profile-page | frontend/src/pages/Profile* | TASK-09 | **done** |
| **UI-10** | **服务器资源监控面板** | feature/server-monitor-ui | frontend/src/pages/Admin*（监控 tab） | TASK-11 | **done** |

### DormGuard 仓库（Cursor 独立会话）

| ID | 任务 | 来源分支 | 范围 | 状态 |
|----|------|----------|------|------|
| DG-INT-01 | OXELIA_GATEWAY_MODE + CORS :5173 | feature/gateway-trust | DormGuard backend/ | **done** |
| DG-QQ-01 | QQ 机器人接入上线 | feature/qq-bot | DormGuard bot/ | **done** |

### Codex（架构审查）

| ID | 任务 | 报告 | 状态 |
|----|------|------|------|
| REV-01 | 审查规约 v1.0 与 ADR 一致性 | docs/api/* | **done** → v1.1 修订 |
| REV-04 | 确认 v1.1 修订完成 | [REV-04 报告](reviews/REV-04-v1.1-closure-brief.md) | **done（通过）** |
| REV-02 | 审查 AUTH-01 PR | [REV-02 报告](reviews/REV-02-brief.md) | **done（通过）** |
| REV-03 | 审查 GW-01 PR | [REV-03 报告](reviews/REV-03-brief.md) | **done（通过）** |
| REV-05 | 审查 Tasks 1-9 批次 | [REV-05 报告](reviews/REV-05-task-batch-report.md) | **done（有条件通过）** |

---

## 工具 manifest（独立仓库）

各工具仓库需包含 oxelia51.tool.json（由 Cursor 独立完成）：

- [x] DormGuard
- [x] SuperRead
- [x] MusicBox
- [x] CS2Lab
- [x] AIHelper
- [x] AgentCanvas

---

## 合并顺序

1. ADMIN-01（创建 oxelia51）
2. AUTH-01 + AUTH-02
3. TOOL-01
4. GW-01
5. 前端 UI-01~04 合并
6. UI-05 + 各工具业务对接
7. TASK-09 / UI-09（account_id + Profile）
8. UI-08 / UI-10（Friends + 监控）
9. ADR-006 切换（人工）
