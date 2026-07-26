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

## 快速开始

### 你自己部署（5 分钟）

```bash
git clone https://github.com/XiaoleC05/Oxelia51.git
cd Oxelia51/deploy
cp .env.example .env
# 编辑 .env，填入安全密钥
docker compose up -d
```

浏览器打开 `http://localhost:3000` → 注册 → 创建项目 → 获得代理 URL。

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

## 开发协作

本项目由 1 位开发者 + 4 个 AI Agent 协作开发，详见 [AGENTS.md](AGENTS.md)。

| Agent | 角色 |
|-------|------|
| Claude Code | 架构、部署、协调 |
| Qoder | Go 后端 |
| Trae Work | React 前端 |
| Codex | 审查、测试、文档 |

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
