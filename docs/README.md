# oxelia51.com 文档索引

**版本**：v4.0（已发布，2026-08-09） | **更新**：2026-08-21

---

## 产品方向

v4 转向**本地优先的个人 Token 记账本**（桌面应用 + 弱认证 + 个人会话/项目 + 多维展示），P1–P4 已完成。

设计定稿：[v4 产品设计](https://github.com/XiaoleC05/langfuse-token/blob/main/docs/superpowers/specs/2026-08-08-oxelia51-v4-design.md)（覆盖 P1–P4，含未实现项标注；链接指向已归档的原 langfuse-token 仓库，该文档未迁入本仓）

## 核心文档

| # | 文档 | 读者 | 内容 |
|:--:|------|------|------|
| 1 | [可行性分析](archive/1-feasibility.md) | 决策者 | 服务器、开源基座、数据采集、技术栈、差异化、风险 |
| 2 | [需求分析](archive/2-requirements.md) | 产品/开发者 | 用户系统、代理网关、Token 统计、告警、部署形态、前端策略 |
| 3 | [概要设计](archive/3-architecture.md) | 开发者 | 服务拓扑、组件、数据流、Nginx、仓库结构、前端架构 |
| 4 | [详细设计](archive/4-detailed-design.md) | 实现者 | Go 代理、C++ 引擎、Web 定制、DB、API、UI 主题 |
| 5 | [自动化部署](archive/5-deployment.md) | 运维 | CI/CD、Webhook、Docker Compose、systemd |
| 6 | [维护与服务器](archive/6-maintenance.md) | 运维 | 服务器信息、日常命令、故障排查、备份、安全 |
| — | [桌面端界面优化方案](archive/ui-optimization-desktop.md) | 设计/前端 | 桌面端 UI Polish v1（主界面、空态、字体、图标、标题栏） |

> 注：以上 1–6 号为 v3 历史快照，已归档至 `archive/`，与 v4 现状有出入。

## 设计规范

| 文档 | 说明 |
|------|------|
| [design-system.md](design-system.md) | 设计系统：色彩、字体、组件规范 |
| [7-i18n-glossary.md](7-i18n-glossary.md) | 汉化术语标准（i18n 路由已移除，现为文案口径规范） |

## 运维文档（随变更维护）

| 文档 | 说明 |
|------|------|
| [待办队列](ops/NEXT_STEPS.md) | 按优先级的下一步工作清单 |
| [单云整合评估](ops/SINGLE_CLOUD_MIGRATION.md) | 双云 → 单云迁移方案对比 |
| [当前服务状态](ops/archive/CURRENT_STATUS.md) | 历史流水账，已归档（服务健康、事故记录、近期变更） |
| [Bug 报告存档](ops/archive/BUG_REPORT.md) | 已修复的历史 bug 记录，已归档 |

## 参考

| 文档 | 说明 |
|------|------|
| [部署运维手册](../deploy/README.md) | Webhook 安装 + 首次部署步骤 |
| [CHANGELOG.md](../CHANGELOG.md) | 完整开发日志 + 版本发布 + Bug 索引 |
| [AGENTS.md](../AGENTS.md) | 任务分工规则（后端/前端/审查/架构） |
| [CLAUDE.md](../CLAUDE.md) | 文件所有权 + 行为边界 + 提示词模板 |
