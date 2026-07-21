# Oxelia51 Multi-Agent 协作开发协议

> 一份用于技术面试展示的实践总结：单人开发者如何借助多 AI Agent 协作，在 6 周内从零构建一个含 AI 模型导航和个人网站搭建功能的开发者平台。

---

## 1. 问题背景

### 1.1 单人全栈开发的现实瓶颈

独立开发者面对一个全栈平台项目时，技术栈天然分散：Go 后端（Gin + PostgreSQL + Redis + JWT）、React 前端（Vite + CSS 变量 + 暗色模式）、DevOps（Nginx + Docker + GitHub Actions + 双服务器运维）。任何单一的 AI 编程助手都无法同时在这些领域保持深度——GPT 写 React 组件熟练但对 Gin 中间件的惯用模式生疏，Claude 擅长 Go 并发但 CSS 响应式布局产出不一致。

### 1.2 为什么需要多 Agent 协作

一个模型无法同时在多个语境中保持上下文精准度。做法是模拟软件团队的分工模式：将项目拆分为独立领域，每个领域配一个 Agent，通过结构化提示词和硬边界约束保证协作质量。

这个思路在 Oxelia51 项目中得到了完整验证——一位人类开发者 + 4 个 AI Agent，6 周内完成 7 个版本迭代，建成了完整的开发者平台。

---

## 2. 架构设计

### 2.1 四层 Agent 模型

```text
Human Developer（决策 + 审查）
        |
Claude Code（架构 + 部署 + 协调）
        |
  -------------------------
  |         |             |
Qoder    Trae Work     Codex
(后端)    (前端)      (审查+测试)
```

**层级关系**：人类开发者对所有决策有最终否决权。Claude Code 是架构控制者——负责需求分析、任务分解、提示词产出、最终集成和部署。Qoder / Trae Work / Codex 是执行层，各自在自己的领域内独立工作，互不越界。

### 2.2 角色定义

每个 Agent 有明确的使命、职责范围、文件边界和上报规则。以下为核心定义的摘要，完整版见 [AGENTS.md §4](../../AGENTS.md)。

| Agent | 角色 | 核心职责 | 可修改 | 不得修改 |
|-------|------|---------|--------|---------|
| Claude Code | 架构+部署 | 任务分解、提示词产出、Git 提交、SSH 部署 | CI/CD、部署脚本、构建脚本 | 业务模块实现、UI |
| Qoder | Go 后端 | handler/service/model/DB/API 实现 | backend/**/*.go | 前端、架构、数据库设计 |
| Trae Work | React 前端 | UI/UX/组件/页面/动画/响应式 | frontend/src/**/*.{jsx,css} | 后端、API 定义 |
| Codex | 审查+测试+文档 | 代码审查、测试、文档、CHANGELOG | *.md、*_test.go | 业务源代码、架构 |

**上报规则**：Qoder 发现数据库模式需要变更时，不能自行修改迁移脚本——必须上报 Claude Code 裁决。Trae Work 发现 API 缺少字段时同理。这种「发现问题→上报→架构裁决→分配任务」的闭环避免了 Agent 间的隐性冲突。

### 2.3 文件所有权边界

[CLAUDE.md §2](../../CLAUDE.md) 定义了精确到文件模式的所有权矩阵。关键设计原则：

```text
backend/internal/handler/*.go  → Qoder   （读+写）
frontend/src/**/*.jsx          → Trae Work（读+写）
docs/**/*.md                   → Codex    （读+写）
deploy/**                      → Claude   （读+写）
```

**为什么需要硬边界**：

1. **防越界修改**——没有所有权约束时，Agent 倾向于「顺手改一下」，导致一个文件被多个 Agent 以不同风格修改，最终成为无人能维护的补丁集合
2. **风格一致性**——每个 Agent 在自己的领域内保持命名、缩进、错误处理模式的统一
3. **最小化冲突**——硬边界意味着 Agent 的工作集天然不重叠，不存在 merge conflict

边界也有例外：Claude Code 可以跨域执行紧急 bug 修复（≤5 行），但事后必须通知对应 Agent。构建验证（`go build`、`npm run build`）是 Claude Code 的「只读」操作——跑了不通过就产出提示词，不自作主张修代码。

### 2.4 提示词协议

[CLAUDE.md §7](../../CLAUDE.md) 定义了六段式提示词模板，每个给 Agent 的任务必须包含：

```text
1. 背景       → 上下文传递：「为什么需要这个改动，相关代码在哪」
2. 修改范围   → 硬边界：「只改这些文件」+「不得修改这些」
3. 具体改动   → 用代码说话：改 SQL 就写完整 SQL，改 struct 就写字段定义
4. 验证       → 可执行命令：go build ./cmd/server/...、npm run build
5. 完成标准   → 可度量：编译通过、逻辑正确、无未完成代码
6. 上报       → 闭环反馈：变更摘要、验证结果、风险/疑问
```

**设计意图**：

- 「背景」段解决 Agent 的语境缺失——不给上下文，Agent 只能在代码库里盲搜
- 「修改范围」是双保险——「只改这些」和「不得修改」同等重要
- 「具体改动」的规则是「用代码说话」——不写「类似 xx 那样改」，因为 Agent 对「类似」的理解有随机性
- 「验证」要求可执行命令而非模糊描述——「确保编译通过」对 Agent 来说是可选的，「go build ./...」是必须执行的

---

## 3. 开发工作流

完整的开发链路（详见 [AGENTS.md §6](../../AGENTS.md)）：

```text
需求分析（Claude Code）
  → 任务分解（拆为独立子任务，每个有明确输入/输出/验证标准）
  → 提示词产出（按 §2.4 六段式模板）
  → Agent 实现（Qoder / Trae Work 独立完成）
  → 构建验证（Claude Code: go build + npm run build，只跑不改）
  → Codex 审查（分级报告：[致命/严重/建议]，标注需架构裁决项）
  → 架构裁定（Claude Code：逐项裁决，分配修复任务）
  → Git 提交 + 部署（Claude Code）
  → 任务完成
```

关键环节的实操细节：

**任务分解**不是简单的「你写前端，你写后端」。每个子任务必须有独立的可测试性——比如 SecretStore 工具的开发被拆为 3 个独立任务：后端 API（Qoder）→ 前端工具壳（Trae Work）→ 网关注册（Claude Code），每个都可以独立编译、独立审查。

**审查闭环**不可跳过。Codex 的审查报告不搞「LGTM」——每篇都是分级报告，包含文件级引用和修复建议。架构智能体必须逐项裁决每个发现的处理方式（修/不修/延期），不能「先合了再改」。

---

## 4. 实战案例

### 4.1 天气系统（Weather System）

**背景**：首页需要展示实时天气信息，增强平台的生活气息。

**任务分解**：
- Qoder：实现后端代理 API（避免前端直接调用第三方，统一错误处理）
- Trae Work：实现 WeatherBar 组件（卡片式布局、城市选择器）

**迭代过程**：

| 轮次 | 方案 | 结果 | 教训 |
|------|------|------|------|
| 1 | 浏览器 `navigator.geolocation` | 需要用户授权，体验差 | 隐私敏感的 API 不应强依赖 |
| 2 | ipapi.co IP 定位 | 国内访问超时（被墙） | 第三方服务在国内的可用性需实测 |
| 3 | Promise.race 多源竞速 | 部分网络仍不可达 | 兜底方案不够健壮 |
| 4 | pconline IP 定位 + 多城市方案 | ✅ 成功 | 中文 API 的 GBK 编码需特殊处理 |

**审查发现**（Codex）：pconline 接口返回的是 GBK 编码，Go 后端未做转码导致前端收到乱码。修复方案是添加 `transform.NewReader(resp.Body, simplifiedchinese.GBK.NewDecoder())`。

**关键教训**：技术选型要适配部署环境。阿里云服务器访问境外 API 不稳定，国产 API 的编码问题（GBK vs UTF-8）容易被忽视。3 次失败的迭代不是浪费时间——每次失败都缩小了可行方案的范围。

**涉及文件**：`backend/internal/handler/weather.go`、`frontend/src/components/WeatherBar.jsx`、相关提交 `c8280d3` `951e11a` `b991a42` `197c5ad`

### 4.2 SecretStore 加密保险箱

**从零到上线的完整流程**：

**Phase 1 — 架构决策**：独立仓库还是 Monorepo？选独立仓库——AES-256-GCM 加密逻辑与平台解耦，便于独立测试和安全审计。加密方案选 AES-256-GCM（带认证标签，防篡改）。

**Phase 2 — 3 个子任务的依赖编排**：
```
TOOL-02-1 后端 API（Qoder）        → 独立仓库，Go+Gin，AES-256-GCM
  ↓ 后端编译通过后
TOOL-03-2 前端壳（Trae Work）      → 7 种凭证模板 UI，一键复制
  ↓ 前端联调通过后
TOOL-04-3 网关注册（Claude Code）  → internal_api_base 配置 + seed 同步
```

**Phase 3 — 审查与收敛**：Codex 审查发现敏感字段在前端状态中暴露、用户间凭证隔离缺少验证。修复后上线。

**关键教训**：依赖编排比技术实现更难。TOOL-02 的 API 接口设计必须在前端开发前冻结——否则 Trae Work 基于旧接口写的组件需要返工。这验证了「架构先于实现」的原则。

**涉及文件**：`.agents/cursor-TOOL-02-secretstore-backend.md`、`.agents/hermes-TOOL-03-secretstore-frontend.md`、`frontend/src/tools/secretstore/SecretStoreTool.jsx`

### 4.3 SmartKB 知识库检索

**技术方案**：pgvector 向量化 + RAG（检索增强生成）。用户在平台知识库中提问，系统检索相关文档片段，拼接上下文后调用 LLM 生成回答。

**前后端分离实现**：
- Qoder：独立仓库 `XiaoleC05/SmartKB`，Go+Gin + pgvector + ILIKE 中文回退
- Trae Work：SmartKBWidget 浮动问答组件（`frontend/src/components/SmartKBWidget.jsx`）
- Claude Code：腾讯云独立部署（Ollama qwen2.5:1.5b 本地推理，零 Token 费）

**审查发现**（Codex）：pgvector 安装时遇到 PG16/PG18 库版本冲突——Docker 容器运行 PG16 但 `apk add` 安装到了 PG18 目录。修复方案：主机下载 tarball → `docker cp` 传入容器 → 编译 PG16 版本（Bug 案例 009，提交 `22a6a65`）。另一次审查发现 SSRF 风险：用户可以自定义 API Base，若未同时提供 API Key，服务器密钥可能被滥用。修复：添加 `if req.APIBase != "" && req.APIKey == ""` 拦截。

**涉及文件**：`frontend/src/components/SmartKBWidget.jsx`、`docs/superpowers/bugs/009-pgvector-pg16-pg18-library-conflict.md`、提交 `ef6769e` `b99cd4b`

---

## 5. 效果度量

| 指标 | 数据 |
|------|------|
| 版本迭代 | v1.0 → v2.3.1，7 个版本，跨越 6 周（2026-06-07 至 2026-07-20） |
| 在线工具 | 6 个（DormGuard、SuperRead、AIHelper、SecretStore、AgentCanvas、SmartKB），全部从零构建 |
| 代码规模 | 平台主仓库 + 6 个工具独立仓库，Go 后端 + React 前端 |
| Agent 提示词 | `.agents/` 目录 8 个结构化任务文件 |
| Codex 审查报告 | `docs/dev/reviews/` 下 15 篇分级审查报告（不含历史 UI 报告） |
| Bug 案例库 | `docs/superpowers/bugs/` 下 9 个结构化 Bug 案例 |
| 架构决策 | `docs/dev/adr/` 下 7 个 ADR（ADR-001 至 ADR-007） |
| API 契约 | `docs/dev/api/` 下 4 个合约文档 |
| 开发时间 | 单人 + 4 Agent，总耗时约 6 周（对比纯手工预估 12-16 周） |

**效率对比**：传统单人全栈开发预估 12-16 周的项目，通过 Agent 协作在 6 周内完成。关键在于 Agent 可以并行工作——Qoder 写后端的同时 Trae Work 已经在实现前端壳，两者互不阻塞。

---

## 6. 经验教训

### 6.1 成功实践

**硬边界比软约束更有效**：「Agent 应该只改后端代码」是软约束——Agent 仍可能顺手改前端。`CLAUDE.md` 的文件所有权矩阵（§2）是硬边界——违背它意味着违反系统指令，Agent 的遵从度显著更高。

**提示词用代码说话**：「请优化登录接口的错误处理」太模糊。有效的提示词是：「在 `handler/auth.go` 的 `Login` 函数中，为每个 `apiError()` 调用添加 `log.Printf()` 记录 client IP 和错误类型」。Agent 对具体指令的执行精度远超对抽象描述的解读。

**审查闭环不可跳过**：每轮实现后必须调 Codex 审查——不是可选的代码质量检查，而是架构控制者获取独立质量信号的关键机制。Claude Code 作为任务分配者缺少对实现质量的独立判断，Codex 的报告提供了这个视角。

### 6.2 失败案例

**pconline GBK 编码问题**：天气系统选用 pconline IP 定位接口后，未预料到其返回 GBK 编码（而非标准 UTF-8）。Go 后端的 `io.ReadAll` + `json.Unmarshal` 直接失败。根本原因是技术选型时未验证 API 的编码格式。修复耗时 1 个额外迭代。

**IP 地理位置方案 3 次推翻**：浏览器定位（隐私权限）→ ipapi.co（被墙）→ Promise.race 多源竞速（不可靠）→ pconline + 多城市（最终方案）。每次推翻都源于对国内网络环境的误判。教训：部署环境（阿里云国内服务器）应该在方案设计阶段就作为约束条件，而非在实现后才发现。

**工具浮球设计未全部落地**：原计划为每个工具实现独立的浮动快捷入口（ToolFAB），但在开发后期发现与 SmartKB 浮球有 z-index 和交互冲突。最终搁置了通用 ToolFAB，仅保留了 SmartKB 浮球。教训：全局 UI 组件（如浮球、导航栏）的设计需要在工具开发启动前冻结，否则后期集成成本过高。

### 6.3 改进方向

| 方向 | 现状 | 目标 |
|------|------|------|
| Agent 产出量化评分 | 仅有人工 Codex 审查 | 引入 lint 分数、测试覆盖率、构建通过率作为自动评分因子 |
| 回归测试集成 | 手动验证 | 在 CI 中加入 `go test ./...` + Playwright E2E 测试 |
| 提示词模板库 | 8 个手写提示词 | 建立常见任务类型（CRUD/认证/网关/前端组件）的提示词模板库 |
| 知识库（SmartKB） | 已部署，6 个工具文档已索引 | 自动抓取每次审查报告和 Bug 案例，供后续 Agent 参考历史决策 |

---

## 7. 参考资料

项目中可直接查看的原始文档：

| 文档 | 路径 | 说明 |
|------|------|------|
| Agent 协作规则 | [AGENTS.md](../../AGENTS.md) v2.3 | 4 Agent 的完整职责定义、工作流、编码规范 |
| 架构智能体约束 | [CLAUDE.md](../../CLAUDE.md) | Claude Code 的行为边界、文件所有权矩阵、提示词模板 |
| 任务提示词样例 | [.agents/](../../.agents/) | 8 个结构化提示词文件（后端/前端/注册） |
| 审查报告合集 | [docs/dev/reviews/](../../docs/dev/reviews/) | 15 篇分级审查报告（REV-02 至 REV-P11） |
| Bug 案例库 | [docs/superpowers/bugs/](../../docs/superpowers/bugs/) | 9 个结构化 Bug（从发现到修复的完整记录） |
| 架构决策记录 | [docs/dev/adr/](../../docs/dev/adr/) | 7 个 ADR（开放注册、网关模式、仓库策略等） |
| API 契约 | [docs/dev/api/](../../docs/dev/api/) | 4 个合约文档（网关、邮件、平台 API、工具注册） |
| 部署指南 | [docs/dev/deployment.md](../deployment.md) | 双服务器部署架构与 CI/CD 流程 |
| 前端样式标准 | [docs/dev/style-guide.md](../style-guide.md) | 设计 Token、组件模式、响应式策略 |