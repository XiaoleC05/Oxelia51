# Oxelia51 多 Agent 开发规约

**版本**：v2.0 | **日期**：2026-07-07
**规约状态**：v2.0 已冻结（依据 AGENTS.md v2.0 重构）

---

## 规约状态

| 文档 | 版本 | 状态 |
|------|------|------|
| 07-项目定位摘要.md | v1.1 | FROZEN |
| api/*.md | v1.1 | FROZEN |
| ADR-001~007 | v1.1 | 已采纳 |
| 08-规约修订记录.md | - | 持续更新 |

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
| AUTH-01 | 邮箱认证注册 + 登录 + 未认证提醒 | eature/email-verification | ackend/ auth、mailer、migrations | **done** |
| AUTH-02 | 找回密码 / 重置 | eature/password-reset | 同上 | **done** |
| ADMIN-01 | 管理员用户 oxelia51 + 初始化配置 | eature/admin-seed | migrations、config、cmd | **done** |
| TOOL-01 | tools 表扩展 + manifest 扫描 API | eature/tool-registry-v2 | migrations、handler/tool、registry | **done** |
| GW-01 | API 网关 internal/gateway/ | eature/api-gateway | gateway、main.go | **done** |
| INT-01 | 路由注册与集成合并 | main 或集成 PR | main.go、App.jsx | **done** |

### Hermes（前端页面）

| ID | 任务 | 来源分支 | 范围 | 依赖 | 状态 |
|----|------|----------|------|------|------|
| UI-01 | 首页 / | eature/landing-page | rontend/src/pages/Landing* | 无 | **done** |
| UI-02 | 工具目录 /tools | eature/tools-catalog | rontend/src/pages/Tools* | platform-api | **done** |
| UI-03 | 作品集 /portfolio | eature/portfolio | rontend/src/pages/Portfolio* | GET /api/portfolio | **done** |
| UI-04 | 认证/密码页 | eature/auth-pages | VerifyEmail、ResetPassword、Auth.css | AUTH-01/02 | **done** |
| UI-05 | 工具壳 /tools/:slug | eature/tool-shell | rontend/src/tools/ | GW-01 | **done** |
| **UI-06** | **全站视觉打磨 + 去 AI 味** | eature/ui-06-visual-polish | rontend/src/**/*.{css,jsx} | 无 | **done**（commit 2e436c） |
| **UI-07** | **DormGuard 配置面板** | eature/dormguard-config | rontend/src/tools/dormguard/DormGuardTool.{jsx,css} | GW-01 | **done**（commit 2e436c） |

### DormGuard 仓库（Cursor 独立会话）

| ID | 任务 | 来源分支 | 范围 | 状态 |
|----|------|----------|------|------|
| DG-INT-01 | OXELIA_GATEWAY_MODE + CORS :5173 | eature/gateway-trust | DormGuard ackend/ | **done** |

### Codex（架构审查）

| ID | 任务 | 报告 | 状态 |
|----|------|------|------|
| REV-01 | 审查规约 v1.0 与 ADR 一致性 | docs/api/* | **done** → v1.1 修订 |
| REV-04 | 确认 v1.1 修订完成 | [REV-04 报告](reviews/REV-04-v1.1-closure-brief.md) | **done（通过）** |
| REV-02 | 审查 AUTH-01 PR | [REV-02 报告](reviews/REV-02-brief.md) | **done（通过）** |
| REV-03 | 审查 GW-01 PR | [REV-03 报告](reviews/REV-03-brief.md) | **done（通过）** |
| REV-05 | 审查 Tasks 1-9 批次 | [REV-05 报告](reviews/REV-05-task-batch-report.md) | **done（通过，P1 已全部闭环）** |

---

## 工具 manifest（独立仓库）

各工具仓库需包含 oxelia51.tool.json（由 Cursor 独立完成）：

- [x] DormGuard
- [x] SuperRead
- [x] AIHelper
- [x] AgentCanvas

---

## 合并顺序

1. ADMIN-01（创建 oxelia51）
2. AUTH-01 + AUTH-02
3. TOOL-01
4. GW-01
5. 前端 UI 全部合并（UI-01~04）
6. UI-05 + 各工具业务对接
7. ADR-006 切换（人工）


---

## 待办任务（v2.1）

### 在线工具开发（依序推进）

每个工具拆为 3 个子任务：后端（Cursor）→ 前端壳（Hermes）→ 注册接入（Cursor）。

| ID | 工具 | Slug | 仓库 | 端口 | 负责 |
|----|------|------|------|------|------|
| ~~DormGuard~~ | ✅ 已完成 | dormguard | XiaoleC05/DormGuard | 8000 | — |
| ✅ **TOOL-05** | SuperRead | superread | XiaoleC05/SuperRead | 8002 | 已完成 |
| ✅ **TOOL-08** | AIHelper | aihelper | XiaoleC05/AIHelper | 8004 | 已完成 |
| ✅ **TOOL-09** | AgentCanvas | agentcanvas | XiaoleC05/AgentCanvas | 8005 | 已完成 |

### 新工具

| ID | 工具 | Slug | 仓库 | 端口 | 负责 |
|----|------|------|------|------|------|
| **TOOL-02** | SecretStore 后端 | secretstore | XiaoleC05/SecretStore | 8006 | ✅ |
| ✅ **TOOL-03** | SecretStore 前端壳 | secretstore | — | — | 已完成 |
| **TOOL-04** | SecretStore 注册+Gateway | secretstore | — | — | ✅ |

### 依赖关系

```
TOOL-05 → TOOL-06 → TOOL-07 → TOOL-08 → TOOL-09  （在线工具依序）
TOOL-02 → TOOL-03 → TOOL-04                          （SecretStore 独立链）
```

**状态**：P0 完成 ✅ | P0 部署完成 ✅ | v2.2：A-E ✅ | 当前：D1+D2（Qoder+Trae Work）+ C2+E3（Trae Work）+ F1-F3（Claude）。

### 子任务模板

每个 TOOL-0X 拆为：

| 子任务 | 负责 | 产出 |
|--------|------|------|
| TOOL-0X-1 后端 | Cursor | Go+Gin API，独立仓库，oxelia51.tool.json |
| TOOL-0X-2 前端 | Hermes | React 工具壳，frontend/src/tools/:slug/ |
| TOOL-0X-3 注册 | Cursor | internal_api_base 更新 + seed 同步 |

### 当前执行

**TOOL-05 SuperRead** 排在最前。前端占位壳已存在（frontend/src/tools/superread/），种子数据已就绪。

---

## 附录：v2.1 历史规划（2026-07-07）

以下内容来自已废弃的 `06-多Agent开发规约.md`，记录 v2.1 时期的新工具引入规划，保留作为历史参考。

### 在线工具开发（已完成）

| ID | 工具 | Slug | 仓库 | 端口 | 状态 |
|----|------|------|------|------|:--:|
| TOOL-05 | SuperRead | superread | XiaoleC05/SuperRead | 8002 | ✅ |
| TOOL-06 | MusicBox | musicbox | XiaoleC05/MusicBox | 8003 | ✅（已移除） |
| TOOL-07 | CS2Lab | cs2lab | XiaoleC05/CS2Lab | 8001 | ✅（已移除） |
| TOOL-08 | AIHelper | aihelper | XiaoleC05/AIHelper | 8004 | ✅ |
| TOOL-09 | AgentCanvas | agentcanvas | XiaoleC05/AgentCanvas | 8005 | ✅ |
| TOOL-02~04 | SecretStore | secretstore | XiaoleC05/SecretStore | 8006 | ✅ |

### 依赖关系（TOOL-05 → TOOL-06 → … → TOOL-09 依序推进，TOOL-02~04 独立链）

### 子任务模板（历史参考）

每个 TOOL-0X 拆为 3 个子任务：后端（Qoder）→ 前端壳（Trae Work）→ 注册接入（Qoder）。
