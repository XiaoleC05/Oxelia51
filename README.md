<p align="center">
  <img src="https://img.shields.io/badge/version-3.0-blue" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
  <img src="https://img.shields.io/badge/Go-1.22%2B-00ADD8?logo=go" alt="go">
  <img src="https://img.shields.io/badge/C%2B%2B-17-00599C?logo=cplusplus" alt="c++">
</p>

<h1 align="center">Oxelia51</h1>

<p align="center">
  改一行环境变量，Token 消耗一目了然。
  <br>
  基于 Langfuse 开源基座 + 自研 Go 代理网关 + 自研 C++ 分析引擎的
  <br>
  <strong>oxelia51.com</strong>
</p>

<p align="center">
  <a href="https://oxelia51.com">在线体验</a> ·
  <a href="docs/README.md">文档</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="README.en.md">English</a>
</p>

---

## 方向：v4（规划中 🚧）

产品正在转向**本地优先的个人 Token 记账本**（2026-08-08 设计定稿，P1–P4 依次推进）：

- **桌面应用**（Tauri 2，Windows/macOS/Linux）全功能本地使用，数据存本地；**登录/注册不再是使用前提**，仅用于跨设备同步、云托管、管理员管理
- **会话与项目为一等公民**（Cursor 式：自定义名称 + 引用本地文件夹），多维（纵/横/时/空）展示 Token 记录
- 落地页 + 文档站 `/docs` 重构，面向**个人**而非组织
- 产品主仓：本仓；web 前端：langfuse-token（Langfuse MIT fork）

> 设计文档：[v4 产品设计](https://github.com/XiaoleC05/langfuse-token/blob/main/docs/superpowers/specs/2026-08-08-oxelia51-v4-design.md)
> 下文 v3 描述均为**当前已实现**的云端能力；v4 新能力一律标注 🚧（规划中）。

## 这是什么

你用 Claude Code、Cursor、ChatGPT 写代码时，每天消耗多少 Token？花在哪个模型上最多？哪个项目最烧钱？

Oxelia51 让你**零代码**统计所有 LLM 调用的 Token 消耗：

```
正常：  Claude Code ────→ api.anthropic.com

加了：  Claude Code ────→ oxelia51.com/api/proxy/anthropic ────→ api.anthropic.com
                              │
                              └── 自动记录 Token → 仪表盘实时展示
```

**改动量**：改**一行环境变量**。不装 SDK，不改代码，不碰 API Key。

## 特性

- 🔌 **代理模式** — 一行环境变量，零侵入。客户端不用装任何东西
- 📊 **多维度统计** — 按时间、模型、项目、会话查看 Token 消耗
- 💰 **成本核算** — 内置 20+ 模型定价表，自动换算花费
- 🚨 **智能告警** — 预算预警 + 用量异常检测，站内/邮件/Webhook 通知
- 🌐 **国内 LLM 适配** — DeepSeek、Moonshot、智谱开箱即用
- 🏠 **5 分钟自部署** — `docker compose up -d`，数据不离开服务器
- 🎨 **双主题** — Cozy（暖色）/ Cosmos（深色），一键切换
- 🔒 **安全** — API Key 只转发不落库，代码全开源

## 架构

```
用户 AI 工具
  │  改一行 BASE_URL
  ▼
┌──────────────────────────────┐
│   Go 代理网关（自研）          │  转发请求 + 记录 Token
│   阿里云 2C2G :9090           │  适配 6 大 LLM 供应商
└────────────┬─────────────────┘
             │ INSERT
             ▼
┌──────────────────────────────┐
│   ClickHouse                  │  Token 事件存储（列式 OLAP）
│   Docker Compose              │  毫秒级聚合查询
└────────────┬─────────────────┘
             │ SELECT
             ▼
┌──────────────────────────────┐
│   C++ 分析引擎（自研）         │  离线批处理，每 5 分钟调度
│   腾讯云 4C4G，systemd timer   │  聚合 → 成本 → 异常 → 告警
└────────────┬─────────────────┘
             │ INSERT
             ▼
┌──────────────────────────────┐
│   PostgreSQL + Langfuse Web   │  仪表盘 · Trace 查看 · 成本页
│   腾讯云 Docker Compose       │  Fork Langfuse (MIT) + 定制
└──────────────────────────────┘
```

## 仓库结构（为什么是两个仓库）

Oxelia51 的产品代码**分布在两个仓库**，各自职责清晰。初次接触的人常会疑惑「为什么网关和后端在一个仓，网站又在另一个仓」，这里一次说清：

| 仓库 | 内容 | 为什么单独存在 |
| --- | --- | --- |
| **Oxelia51**（本仓） | Go 代理网关 `proxy-gateway/`、C++ 分析引擎 `analytics/`、Go 管理后端 `backend/`、桌面应用 `desktop/`（🚧 v4 P3） | **全部为自研代码**，独立演进，不掺第三方 |
| **langfuse-token** | web 前端：落地页 / 文档站 / 仪表盘 / 管理后台 UI | 它是 **Langfuse (MIT) 的 fork + 深度定制**。Langfuse 是独立开源项目，web 端代码量巨大且要持续跟踪上游；单独成仓，便于单独跟踪上游更新、单独 CI 构建镜像，也避免产品仓被 fork 代码淹没 |

**两者如何协作**：web（langfuse-token）提供界面与数据查询；Go 网关（本仓 `proxy-gateway/`）负责代理转发与 Token 落账；C++ 引擎（`analytics/`）做聚合与定价；数据存 ClickHouse + PostgreSQL。部署时两个仓库的构建产物被编排成同一套服务（见下）。

**自部署 = 同时拿到两个仓库**：

```bash
# 1) 产品仓：网关 / 引擎 / 后端 / 桌面
git clone https://github.com/XiaoleC05/Oxelia51.git
# 2) web 前端仓：Langfuse MIT fork
git clone https://github.com/XiaoleC05/langfuse-token.git
```

> 部署关系：**web 走「CI → Docker 镜像 → compose」**（langfuse-token 的 `build-docker.yml`）；**Go 网关/后端走「GitHub Release → 下载安装 → systemd」**；**C++ 引擎走 systemd timer**；**桌面（v4 P3）本地自足，无需服务器**。v4 正在收敛「桌面本地优先」，届时个人用户不需要部署任何服务器。

## 快速开始

### 你自己部署

> ⚠️ 完整的 Oxelia51（含 web 界面）需要**两个仓库**协作，见上节「仓库结构」。下文 v3 的云端形态依赖托管环境；v4 桌面端（🚧）将提供免服务器的本地形态。

```bash
# 1) 网关 / 引擎 / 后端（本仓）
git clone https://github.com/XiaoleC05/Oxelia51.git
cd Oxelia51/deploy
cp .env.example .env
# 编辑 .env，填入安全密钥
# 2) web 前端（langfuse-token 仓，Langfuse MIT fork）
git clone https://github.com/XiaoleC05/langfuse-token.git
```

web 界面打开 `http://localhost:3000` → 注册 → 创建项目 → 获得代理 URL。

### 在你的 AI 工具中配置

```bash
# Claude Code
export ANTHROPIC_BASE_URL="https://oxelia51.com/api/proxy/anthropic"

# Cursor / ChatGPT
export OPENAI_BASE_URL="https://oxelia51.com/api/proxy/openai"
```

之后所有 LLM 调用的 Token 自动显示在仪表盘上。

## 技术栈

| 组件 | 技术 | 来源 | 规模 |
|------|------|------|:--:|
| Go 代理网关 | Go + 标准库 `net/http/httputil` | 自研 | ~2000 行 |
| C++ 分析引擎 | C++17 + `clickhouse-cpp` | 自研 | ~3000 行 |
| 数据底座 + UI | Langfuse (MIT) | Fork + 定制 | — |
| Token 事件存储 | ClickHouse | Docker | — |
| 业务数据库 | PostgreSQL 17 | Docker | — |
| 管理后台 | Go + Gin + React | 现有 | — |

## 项目结构

```
Oxelia51/
├── proxy-gateway/        # Go 代理网关
├── analytics/            # C++ 分析引擎
├── backend/              # 管理后台（Go）
├── frontend/             # 管理后台 UI（React，逐步废弃）
├── deploy/               # Docker Compose · Nginx · Webhook
├── docs/                 # 全部文档（6 份 + dev 归档）
│   ├── README.md                # 文档索引
│   ├── 1-feasibility.md         # 可行性分析
│   ├── 2-requirements.md        # 需求分析
│   ├── 3-architecture.md        # 概要设计
│   ├── 4-detailed-design.md     # 详细设计
│   ├── 5-deployment.md          # 自动化部署
│   └── 6-maintenance.md         # 维护与服务器
└── scripts/              # 辅助脚本
```

## 文档

完整文档见 [docs/README.md](docs/README.md)：

| # | 文档 | 读者 |
|:--:|------|------|
| 1 | 可行性分析 | 决策者 |
| 2 | 需求分析 | 产品 / 开发者 |
| 3 | 概要设计 | 开发者 |
| 4 | 详细设计 | 实现者 |
| 5 | 自动化部署 | 运维 |
| 6 | 维护与服务器 | 运维 |

## 参与贡献

[Conventional Commits](https://www.conventionalcommits.org/) 格式：

```bash
git commit -m "feat: 支持 Gemini 代理"     # 新功能
git commit -m "fix: SSE 流式丢数据"        # 修 bug
git commit -m "docs: 更新部署文档"          # 文档
git commit -m "refactor: 重构 adapter 接口" # 重构
```

## 许可证

MIT License — 详见 [LICENSE](LICENSE)
