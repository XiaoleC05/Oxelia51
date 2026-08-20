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
这个任务 → 属于哪个领域？
  ├─ 后端/数据库/API/Go/C++ 代码                     → 后端任务 → 我只产出提示词
  ├─ 前端/CSS/布局/动画/React                          → 前端任务 → 我只产出提示词
  ├─ 审查/测试/文档/命名/README/CHANGELOG              → 审查任务 → 我只产出提示词
  ├─ 架构决策/任务分解/部署/服务器操作/CI/CD/Git        → 架构任务 → 我做
  └─ 不确定                                             → 先问人类开发者
```

**关键规则**：发现任何 bug、缺失功能、代码问题时，如果属于其他任务领域，**唯一行动是产出提示词**，不自己动手修。详见 `AGENTS.md`。

---

## 2. 文件所有权——硬边界

### 他人领域——只看不写

| 路径模式 | 归属 | 我的行为 |
|----------|:--:|------|
| `**/desktop/ui/src/**/*.{ts,tsx,css}` | 前端任务 | 只读，产出提示词 |
| `**/backend/internal/**/*.go`（domain/gateway/middleware/infra/app） | 后端任务 | 只读，产出提示词 |
| `**/backend/config/*.go` | 后端任务 | 只读，产出提示词 |
| `**/proxy-gateway/internal/**/*.go` | 后端任务 | 只读，产出提示词 |
| `**/analytics/src/**/*.{cpp,h}` | 后端任务 | 只读，产出提示词 |
| `**/internal/handler/*.go`（工具仓库） | 后端任务 | 只读，产出提示词 |
| `**/internal/model/*.go`（工具仓库） | 后端任务 | 只读，产出提示词 |
| `**/internal/db/*.go`（工具仓库） | 后端任务 | 只读，产出提示词 |
| `**/cmd/server/main.go`（路由注册） | 后端任务 | 只读，产出提示词 |
| `**/migrations/*.sql` | 后端任务 | 只读，产出提示词 |
| `**/*.md` / CHANGELOG / README | 审查任务 | 只读，产出提示词 |
| `**/*_test.go` | 审查任务 | 只读，产出提示词 |
| `web/src/**/*` | 前端任务 | 只读，产出提示词 |

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
Oxelia51/                    ← 平台主仓库（v3.0）
  proxy-gateway/             ← Go 代理网关（自研）
  analytics/                 ← C++ 分析引擎（自研）
  backend/                   ← Go 管理后台
  desktop/                   ← Tauri 2 桌面应用（React UI 在 desktop/ui/）
  deploy/                    ← 部署配置
  docs/                      ← 全部文档
  web/                       ← web 前端（原 langfuse-token 仓库，Fork langfuse/langfuse；已并入本仓）

独立工具仓库（SSH 远端，管理后台引用）：
  DormGuard/ SecretStore/ SmartKB/
  ↑ 工具后端 → 后端任务领域
  ↑ .github/workflows/deploy.yml → 我的领域
```

---

## 4. 架构约束

- 工具仅提供后端 API，无独立前端（ADR-002）
- 前端通过 `/api/tools/:slug/proxy/*path` 网关调用工具，不直连工具端口
- 工具间不可互调 API（ADR-007）
- 不转发客户端 `Authorization` 给工具
- API 契约为 FROZEN 状态，修改需版本号 bump + 审查

---

## 5. 部署约束

- 阿里云 47.108.202.199；腾讯云 118.25.138.177
- 22 端口受安全组限制（本机 SSH 直连被拦截）：日常运维走 `/api/admin/exec`（JWT + IP 白名单），或白名单内 IP 的 SSH
- 阿里云可通过 `~/.ssh/tencent_cloud` SSH 到腾讯云（腾讯云 22 仅对阿里云 IP 放行）
- **运维操作先查 `deploy/RUNBOOK.md`**——exec API 引号陷阱、setsid 后台、五条部署管线、常见坑
- 已配环境变量不得重复询问：`CRAWLER_*` `QQ_BOT_*`
- 工具部署路径：`/opt/<tool>/<tool>-server`，systemd 管理
- 腾讯云 Langfuse：Docker Compose，部署在 `/opt/langfuse/`，管理脚本 `langfuse-deploy.sh`
- 阿里云 Go 代理：`/opt/oxelia51/proxy/proxy-server`，systemd `token-proxy.service`
- 部署流：`push master → deploy.yml 构建 → GitHub Release → webhook（release 事件）→ deploy.sh → apply-release.sh`；`receiver.py` 按 repo 路由到 `tool-deploy.sh`
- **所有编译在本地完成**，禁止在服务器上运行 `go build`/`npm run build`/`make`/`cmake` 等编译命令
- 服务器上只做：下载二进制、重启服务、执行 SQL、查看日志

### 部署铁律（踩坑教训，详见 RUNBOOK.md）

1. **exec 后台任务必须 `setsid`**：`setsid bash -c '...' </dev/null >/dev/null 2>&1 &`，直接 `nohup &` 会被 kill（exec 进程树问题）。
2. **ssh 远端命令单引号包裹**，避免 `|` `&&` `{{}}` 被两层 bash 展开。
3. **打桌面 release tag 前统一版本号**：`tauri.conf.json` / `ui/package.json` / `ui/src/version.ts` 三处一致，否则安装包显示旧版本号。
4. **macOS 编译错误 Windows 本地发现不了**（`cfg(target_os="macos")` 排除），桌面改动必须 CI 验证三平台。
5. **仓库文档不得写服务器密码**（公开仓库）。密码仅在本地记忆，操作时用占位符。

---

## 6. Git 约束

- 提交格式：`feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:`
- 仅我执行合并和 push，推送前确保构建通过

---

## 7. 提示词产出规范

产出给其他任务领域的提示词必须包含以下六个部分，缺一不可：

### 结构模板

```
## {后端/前端/审查}任务：{一句话描述}

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
5. **不替执行者做决定**——只写「要什么」，不写「怎么做」（除非实现方式有约束）

---

## 8. 工作流

```
需求分析 → 任务分解 → 产出提示词（按§7模板）→ 对应领域实现
  → 构建验证（只跑不改）
  → 提交推送 + 部署
  → 审查任务 审查         ← 闭环必须执行，不得跳过
  → 最终裁定 + 修复
```

### 闭环规则

1. **每轮实现结束后必须调审查任务**——提交推送后立即产出审查提示词
2. 审查报告中的问题必须全部裁决（修/不修/延期）
3. 修复后再次审查直到通过
4. **审查提示词必须包含**：变更基准（commit hash）、审查重点、输出格式要求

不确定时 → **先问人类开发者**。
