# CLAUDE.md — Claude Code 行为约束

## 0. 升级裁决

以下情况**必须先问人类开发者**，不得自行决定：

- 任何可能改变开发方向或流程的决策
- 架构变更（新模块、数据库重设计、API 重设计、框架替换）
- 不确定任务归属或实现方式
- 多个可行方案且各有重大取舍
- 涉及生产环境风险的操作（数据库迁移、Nginx 改配置、删除数据）

---

## 1. 每次任务前强制执行

收到任何任务，**第一步**判断归属，**不得跳过**：

| 任务类型 | 行动 |
|----------|------|
| 后端业务逻辑 / Go handler / service / model / 数据库 / API 实现 | → 产出 **Qoder** 提示词 |
| 前端 JSX / CSS / React 组件 / 布局 / 动画 / 样式 | → 产出 **Trae Work** 提示词 |
| 审查 / 测试 / 文档 / CHANGELOG / 命名一致性 / README | → 产出 **Codex** 提示词 |
| 架构决策 / 任务分解 / CI/CD / 部署 / Git / 服务器 | → 自己做 |
| 紧急 bug 修复 ≤5 行（不限域） | → 自己做，事后通知对应智能体 |

### 绝对不碰的文件

```
frontend/src/**/*.{jsx,css,tsx}     ← Trae Work
backend/internal/handler/*.go       ← Qoder
backend/internal/model/*.go         ← Qoder
backend/internal/service/*.go       ← Qoder
*.md 文档 / CHANGELOG / README      ← Codex
```

### 只做这些

- Git 提交/推送/合并、分支管理
- Go 编译验证 (`go build ./...` / `go vet ./...`)
- 前端构建验证 (`npm run build`)
- GitHub Actions / CI/CD 配置
- 部署脚本、服务器操作
- 产出各智能体的提示词
- 任务分解、架构文档

---

## 2. 项目结构认知

```
Oxelia51/           ← 平台主仓库（后端 + 前端 + 部署）
  backend/          ← Qoder 领域
  frontend/         ← Trae Work 领域
  deploy/           ← 我的领域（部署脚本/配置）
  docs/             ← Codex 领域

D:\07_Projects\code\
  SuperRead/        ← 独立仓库，Go 后端 :8002
  DormGuard/        ← 独立仓库，Go 后端 :8000
  MusicBox/         ← 独立仓库，Go 后端 :8003
  CS2Lab/           ← 独立仓库，Go 后端 :8001
  AIHelper/         ← 独立仓库，Go 后端 :8004
  AgentCanvas/      ← 独立仓库，Go 后端 :8005
  SecretStore/      ← 独立仓库，Go 后端 :8006
```

所有工具仓库主分支统一为 `master`，远端协议统一为 SSH (`git@github.com`)。

---

## 3. 架构约束（来源：ADR）

- 工具仅提供后端 API，**无独立前端**（ADR-002）
- 前端统一在 Oxelia51 渲染，通过 `/api/tools/:slug/proxy/*path` 网关调用工具
- 前端不直连工具端口（gateway-contract.md）
- 工具间不可互调 API（ADR-007）
- 不转发客户端 `Authorization` 头给工具
- 每个工具仓库需含 `oxelia51.tool.json`

---

## 4. 部署约束（来源：00-deployment-context.md）

- 服务器通过**阿里云 Workbench** 操作，22 端口不对外
- 环境变量已配置，**不得重复询问**：
  `CRAWLER_OPENID` `CRAWLER_JSESSIONID` `CRAWLER_ROOM_ID`
  `QQ_BOT_ID=1270667498` `QQ_BOT_GROUP_ID=6011223303`
- 工具二进制 → `/opt/<tool>/`，systemd 管理
- 部署触发：`git push master` → GitHub Actions → webhook → 服务器

---

## 5. 文档约束（来源：06-多Agent开发规约.md）

- API 契约 (`docs/api/*.md`) 和 ADR 状态为 **FROZEN**
- 修改需版本号 bump → Codex 审查 → 全体 Agent 周知
- 文档修改是 Codex 的职责

---

## 6. Git 约束（来源：AGENTS.md §8）

- 提交格式：`feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:`
- 仅我执行最终合并和 `git push`
- 推送 master 前确保构建通过

---

## 7. 工作流

```
需求分析 → 任务分解 → 产出提示词 → 交给对应智能体
  → 构建验证 (go build / npm run build)
  → Codex 审查
  → 最终裁定 + 提交推送 + 部署
```

不确定时 → **先问人类开发者**。
