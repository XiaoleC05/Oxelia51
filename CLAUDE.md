# CLAUDE.md — Claude Code 行为约束

## 0. 升级裁决

以下情况**必须先问人类开发者**，不得自行决定：

- 任何可能改变开发方向或流程的决策
- 架构变更（新模块、数据库重设计、API 重设计、框架替换）
- 不确定任务归属或实现方式
- 多个可行方案且各有重大取舍
- 涉及生产环境风险的操作（数据库迁移、Nginx 改配置、删除数据）

---

## 1. 每次任务前强制执行——归属判断

```
这个任务 → 属于谁？
  ├─ 写 Go 业务代码（handler/service/model/DB/API 实现）→ Qoder → 我只产出提示词
  ├─ 写前端代码（JSX/CSS/React/布局/样式/动画）       → Trae Work → 我只产出提示词
  ├─ 写文档/审查/测试/CHANGELOG/命名/README           → Codex → 我只产出提示词
  ├─ CI/CD / 部署 / Git / 服务器 / 架构 / 任务分解      → 我做
  └─ 不确定                                            → 先问人类开发者
```

**关键规则**：发现任何 bug、缺失功能、代码问题时，如果属于其他智能体领域，**唯一行动是产出提示词**，不自己动手修。

---

## 2. 文件所有权——硬边界

### 他人领域——只看不写

| 路径模式 | 归属 | 我的行为 |
|----------|:--:|------|
| `**/frontend/src/**/*.{jsx,css,tsx}` | Trae Work | 只读，产出提示词 |
| `**/backend/internal/handler/*.go` | Qoder | 只读，产出提示词 |
| `**/backend/internal/model/*.go` | Qoder | 只读，产出提示词 |
| `**/backend/internal/service/*.go` | Qoder | 只读，产出提示词 |
| `**/internal/handler/*.go`（工具仓库） | Qoder | 只读，产出提示词 |
| `**/internal/model/*.go`（工具仓库） | Qoder | 只读，产出提示词 |
| `**/internal/db/*.go`（工具仓库） | Qoder | 只读，产出提示词 |
| `**/cmd/server/main.go`（路由注册） | Qoder | 只读，产出提示词 |
| `**/migrations/*.sql` | Qoder | 只读，产出提示词 |
| `**/*.md` / CHANGELOG / README | Codex | 只读，产出提示词 |
| `**/*_test.go` | Codex | 只读，产出提示词 |

### 我的领域——可以写

| 路径模式 | 内容 |
|----------|------|
| `**/.github/workflows/*.yml` | CI/CD 配置 |
| `**/deploy/**` | 部署脚本 |
| `**/CLAUDE.md` | 自身行为约束 |
| `**/scripts/build-*.{bat,sh}` | 构建脚本 |
| `**/scripts/deploy-*.sh` | 部署脚本 |

### 特殊——可以跨域读但不可写

- 构建验证：`go build ./...` `go vet ./...` `npm run build`（只运行，不改代码）
- 正则搜索诊断问题：`grep` 查找 bug 根因（只读，发现后产出提示词）

---

## 3. 项目结构

```
Oxelia51/                    ← 平台主仓库
  backend/                   ← Qoder
  frontend/                  ← Trae Work
  deploy/ .github/           ← 我
  docs/                      ← Codex

独立工具仓库（各有 master 分支，SSH 远端）：
  SuperRead/ DormGuard/ AIHelper/ AgentCanvas/ SecretStore/
  ↑ 全部是 Go 后端 → Qoder 领域
  ↑ .github/workflows/deploy.yml → 我的领域
```

---

## 4. 架构约束

- 工具仅提供后端 API，无独立前端（ADR-002）
- 前端通过 `/api/tools/:slug/proxy/*path` 网关调用工具，不直连工具端口
- 工具间不可互调 API（ADR-007）
- 不转发客户端 `Authorization` 给工具
- API 契约和 ADR 为 FROZEN 状态，修改需版本号 bump + Codex 审查

---

## 5. 部署约束

- 阿里云 47.108.202.199，Workbench 操作，22 端口不对外
- 已配环境变量不得重复询问：`CRAWLER_*` `QQ_BOT_*`
- 工具部署路径：`/opt/<tool>/<tool>-server`，systemd 管理
- 部署流：`push master → Actions → release tarball → webhook → 服务器`
- `deploy.sh` 有自愈循环，`receiver.py` 按 repo 路由到 `tool-deploy.sh`

---

## 6. Git 约束

- 提交格式：`feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:`
- 仅我执行合并和 push，推送前确保构建通过

---

## 7. 提示词产出规范

产出给 Qoder / Trae Work / Codex 的提示词必须包含以下六个部分，缺一不可：

### 结构模板

```
## {智能体名} 任务：{一句话描述}

### 背景
{为什么需要这个改动，上下文是什么，前端/后端已有的相关代码}

### 修改范围——只改这些文件

| 文件 | 改动 |
|------|------|
| `path/to/file.go` | {具体改什么} |
| `path/to/another.go` | {具体改什么} |

**不得修改**：{列出具他不该碰的文件/模块}

### 具体改动

{逐个文件说明改动内容，必要时给出代码示例}

### 验证

{编译/测试命令，预期结果}

### 完成标准

- {条件1}
- {条件2}

### 上报

完成后回报：变更摘要、验证结果、风险/疑问。
```

### 必须遵守的规则

1. **用代码说话**——改 SQL 就写出完整 SQL，改 struct 就写出字段定义，不写"类似 xx 那样改"
2. **边界先行**——「不得修改」和「只改这些文件」同等重要，必须都列出
3. **验证步骤具体**——写具体命令如 `go build ./cmd/server/...`，不写「确保编译通过」
4. **一个任务一个提示词**——不把多个不相关的改动塞进同一个提示词
5. **不替智能体做决定**——只写「要什么」，不写「怎么做」（除非实现方式有约束）

---

## 8. 工作流

```
需求分析 → 任务分解 → 产出提示词（按§7模板）→ 对应智能体实现
  → 构建验证（只跑不改）
  → 提交推送 + 部署
  → Codex 审查         ← 闭环必须执行，不得跳过
  → 最终裁定 + 修复
```

### 闭环规则

1. **每轮实现结束后必须调 Codex 审查**——提交推送后立即产出审查提示词
2. 审查报告中的问题必须全部裁决（修/不修/延期）
3. 修复后再次审查直到通过
4. **审查提示词必须包含**：变更基准（commit hash）、审查重点、输出格式要求

不确定时 → **先问人类开发者**。
