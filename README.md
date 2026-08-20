<p align="center"><b>中文</b> · <a href="README.en.md">English</a></p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.x-blue" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
  <img src="https://img.shields.io/badge/Go-1.22%2B-00ADD8?logo=go" alt="go">
  <img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri" alt="tauri">
</p>

<h1 align="center">Oxelia51</h1>

<p align="center">
  只需要改一行环境变量，所有 Token 消耗一目了然。
  <br>
  本地优先的个人 Token 记账本 · 开源 MIT
</p>

<p align="center">
  <a href="https://oxelia51.com/download">下载桌面版</a> ·
  <a href="https://oxelia51.com/docs">文档</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="https://github.com/XiaoleC05/Oxelia51">GitHub</a>
</p>

---

## 这是什么

你用 Claude Code、Cursor、CC Switch、Trae 写代码时，每天消耗多少 Token？花在哪个供应商、哪个 Agent 上最多？

Oxelia51 让你**零代码**统计所有 LLM 调用的 Token 消耗：把模型工具的 Base URL 指向内置本地代理，之后的每一次调用都自动落账。

```
正常：  Claude Code ────→ api.anthropic.com

加了：  Claude Code ────→ http://127.0.0.1:17800/api/proxy/anthropic ────→ api.anthropic.com
                             │
                             └── 自动记录 Token/成本 → 桌面应用实时展示
```

**改动量**：改**一行环境变量**。不装 SDK，不改代码，不碰 API Key。

## 核心特性

- 🖥️ **本地优先桌面应用**（Tauri 2，Windows/macOS/Linux）——数据全存本地 SQLite，不登录、不联网也能用
- 🔌 **一行环境变量接入**——代理零侵入；API Key 只转发、不落库
- 📊 **双维度统计**——按**供应商**（Claude / DeepSeek / OpenAI / 智谱 …）与 **Agent**（Claude Code / Cursor / CC Switch / Trae …）聚合 Token、请求与成本，可下钻到模型明细
- 🪟 **悬浮玻璃卡片**——固定在桌面的实时统计：今日 Token 与成本一目了然，无需打开主窗口
- 🗂️ **80+ 预设接入项（76 条内置路由）**——国外主流 / 国内主流 / 第三方平台三分类，搜索即复制代理地址，直达官网
- 💰 **模型价格参考**——按输入价 / 综合成本排序，辅助选型（参考价，离线可用）
- 🚨 **四维告警**——全局 / 供应商 / Agent / 模型各自独立设预算，超限弹系统通知
- 🎨 **双主题**——Cozy（暖色）/ Cosmos（深色），一键切换
- ☁️ **跨设备同步**——登录云平台账户后本地账本可上传 / 下载到云端，多设备按事件去重合并；仅主动同步时数据上行，本地优先

## 快速开始

### 1. 下载桌面应用

到[下载页](https://oxelia51.com/download)或 GitHub Releases 下载对应平台的安装包并启动。启动后内置本地代理（默认 `127.0.0.1:17800`）。

### 2. 配置你的 AI 工具

选择你使用的供应商，把模型的 Base URL 指向本地代理地址（**必须含 `/api/proxy/<供应商slug>` 前缀**）：

```bash
# Anthropic 协议（Claude Code / Anthropic SDK）：
export ANTHROPIC_BASE_URL="http://127.0.0.1:17800/api/proxy/anthropic"

# OpenAI 兼容协议（Cursor / CC Switch / Trae 等），换成对应 slug：
export OPENAI_BASE_URL="http://127.0.0.1:17800/api/proxy/deepseek"
```

不想改配置文件的工具（如 CC Switch）直接在自定义 Base URL 输入框粘贴 `http://127.0.0.1:17800/api/proxy/<slug>` 即可。

### 3. 查看

之后的每一次调用自动落账。在桌面应用里按供应商 / Agent / 模型查看用量与成本；点顶栏「悬浮统计」可把实时卡片钉在桌面上。

## 供应商

内置 76 条供应商路由（proxy-gateway/internal/adapter/registry.go），三分类：

- **国外主流**：Anthropic / OpenAI / Gemini / Mistral / Grok / Groq / Cerebras / Cohere / Perplexity / SambaNova / NVIDIA …
- **国内主流**：DeepSeek / 智谱 GLM / 通义千问 / Moonshot (Kimi) / Kimi For Coding / 豆包 / 腾讯混元 / 讯飞星火 / MiniMax / 百川 / 零一万物 / 商汤 / 阶跃星辰 / 硅基流动 / 码云 AI / 魔搭 / 百度千帆 …
- **第三方平台**：OpenRouter / Together AI / Fireworks / DeepInfra / Novita / PPIO / 各种 API 中转 …

> 供应商 = 提供大模型的平台；**Agent = 你使用的软件**，记录会自动按工具识别（UA 推断，可用 `X-Oxelia51-Agent` 头覆盖）。

## 架构

```
你的 AI 工具（Claude Code / Cursor / …）
  │  改一行 BASE_URL
  ▼
┌─────────────────────────────────────┐
│ 本地代理网关（Go，:17800）             │ 转发请求 + 记录 Token（LOCAL_MODE）
│ proxy-gateway/                       │ 76 条供应商路由
└──────────────┬──────────────────────┘
               │ INSERT
               ▼
┌─────────────────────────────────────┐
│ SQLite（本地账本）                     │ token_events 事件表
└──────────────┬──────────────────────┘
               │ 可选：登录账户后
               ▼
┌─────────────────────────────────────┐
│ 云平台（oxelia51.com）                │ 同步 / 查看 / 恢复
└─────────────────────────────────────┘
```

产品代码分布（web 前端原属 langfuse-token 仓库，已并入本仓 `web/`）：

| 位置 | 内容 | 说明 |
| --- | --- | --- |
| **Oxelia51**（本仓） | Go 代理网关 `proxy-gateway/`、Go 管理后端 `backend/`、桌面应用 `desktop/`、分析引擎 `analytics/` | 全部为自研代码，独立演进 |
| **web/**（本仓） | web 前端：落地页 / 文档站 / 仪表盘 | 原 langfuse-token 仓库（Langfuse MIT fork + 深度定制）；已脱钩并入本仓，langfuse 原生功能（追踪/提示词/评估等）已删除，独立演进 |

## 项目结构

```
Oxelia51/
├── proxy-gateway/        # Go 代理网关（云端 + 本地 sidecar），76 条供应商路由
├── backend/              # Go 后端（认证 / 管理 / 多设备同步）
├── desktop/              # 桌面应用（Tauri 2 + Vite React + sidecar）
│   ├── ui/               #   前端界面（主窗口 + 悬浮玻璃卡片 widget）
│   └── src-tauri/        #   Tauri 壳 + sidecar 托管
├── analytics/            # C++ 分析引擎
├── web/                  # web 前端（原 langfuse-token 仓库，已脱钩并入本仓）
├── packages/shared/      # @oxelia51/shared：web 的共享包（Prisma/ClickHouse/领域常量）
├── deploy/               # Docker Compose · Nginx · 发布脚本
├── docs/                 # 完整文档（设计 / 部署 / 维护）
└── scripts/              # 辅助脚本
```

## 本地开发（web）

```bash
pnpm install           # 安装依赖（pnpm 11，node 22 可跑，engines warning 可忽略）
pnpm run db:generate   # 生成 Prisma client（脚本读根目录 .env，模板见 .env.dev.example）
pnpm run build         # 经 turbo 构建 packages/shared 与 web
```

Windows 注意：web 的 `build`/`dev` 脚本依赖 dotenv 与 Unix shell，请在 Git Bash 中执行；
或直接运行（绿灯标准：路由表正常输出）：

```bash
cd web && DOCKER_BUILD=1 INLINE_RUNTIME_CHUNK=false NEXT_TELEMETRY_DISABLED=1 pnpm exec next build
```

更多约定见 [web/AGENTS.md](web/AGENTS.md) 与 [packages/shared/AGENTS.md](packages/shared/AGENTS.md)。

## 文档

- 在线文档：[oxelia51.com/docs](https://oxelia51.com/docs)
- 本地设计文档：[docs/README.md](docs/README.md)
- v4 产品设计：[2026-08-08-oxelia51-v4-design.md](https://github.com/XiaoleC05/langfuse-token/blob/main/docs/superpowers/specs/2026-08-08-oxelia51-v4-design.md)（原 langfuse-token 仓库，已归档，文档未迁入本仓）

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
