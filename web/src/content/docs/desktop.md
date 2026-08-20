---
title: 桌面应用
section: 入门
order: 2
---

> 桌面应用已发布（v0.1.x），支持 Windows / macOS / Linux。下载请前往[下载页](/download)或 GitHub Releases。

## 安装与系统要求

按平台提供以下下载方式（以实际发布为准，下载页只显示已构建验证的安装包）。下载页显示来自 GitHub Releases 的真实累计下载量；拉取失败时可点「重试」重新获取：

| 平台 | 下载方式 | 适用场景 |
| --- | --- | --- |
| Windows | 安装包 (.exe) | 日常使用，开始菜单/桌面快捷方式 |
| Windows | 便携版 (.zip) | 免安装，U 盘 / 绿色使用 |
| macOS | .dmg | Apple Silicon 与 Intel 分别提供 |
| Linux | .deb / .rpm / .AppImage | Debian / Ubuntu、Fedora / RHEL、通用发行版 |

## 安装时遇到系统提示怎么办

桌面应用目前**未购买代码签名证书**，Windows SmartScreen 会提示「未知发布者」；macOS 也会提示「无法验证开发者」。这是操作系统对未签名程序的**默认保护**，不是病毒。按平台处理：

### Windows

1. **「Windows 已保护你的电脑」**（SmartScreen）：
   点 **「更多信息」→「仍要运行」**，即可继续安装。
2. **「打开文件 - 安全警告（未知发布者）」**（浏览器下载后双击出现）：
   点 **「运行」**。
3. **便携版 (.zip)** 解压前如有拦截：右键文件 → **属性** → 勾选 **「解除锁定」** → 确定，再解压。

> 为什么会有这个提示：程序未签名、下载量少，Windows 暂时无法识别。属正常现象。Oxelia51 代码全开源、数据全本地，安装后可放心使用。

### macOS

双击 .dmg 提示「无法打开，因为无法验证开发者」时：
- 到 **系统设置 → 隐私与安全性** → 点 **「仍要打开」**；
- 或右键图标 → **「打开」** → 再点「打开」。

### Linux

- **.AppImage**：先给执行权限再运行：
  ```bash
  chmod +x oxelia51.AppImage && ./oxelia51.AppImage
  ```
- **.deb**：`sudo dpkg -i oxelia51.deb`，或双击用软件中心安装。
- **.rpm**：`sudo rpm -i oxelia51.rpm`。

## 配置本地代理

应用启动后会内置一个**本地代理**（默认端口 `17800`，监听 `127.0.0.1`）。**选择你使用的 LLM 供应商**，把模型工具的 Base URL 指向对应的代理地址：

```bash
# 注意：BASE_URL 必须含 /api/proxy 前缀，否则请求 404、不落账
# 使用 Anthropic（Claude Code / Anthropic SDK）：
export ANTHROPIC_BASE_URL="http://localhost:17800/api/proxy/anthropic"

# 使用 OpenAI 兼容供应商（Cursor / CC Switch / Trae 等），换成对应 slug：
export OPENAI_BASE_URL="http://localhost:17800/api/proxy/deepseek"
export OPENAI_BASE_URL="http://localhost:17800/api/proxy/openai"
export OPENAI_BASE_URL="http://localhost:17800/api/proxy/zhipu"
```

> **供应商 = 提供大模型的平台**，路径里的 slug 决定请求转发给谁。内置 **76 条供应商路由**：
>
> - **国内**：DeepSeek、智谱 GLM、通义千问、Moonshot (Kimi)、Kimi For Coding、豆包、腾讯混元、讯飞星火、MiniMax、百川、零一万物、商汤日日新、阶跃星辰、硅基流动、码云 AI、魔搭、百度千帆
> - **国际**：Claude (Anthropic)、OpenAI、Google Gemini、Mistral、xAI (Grok)、Groq、Cerebras、Cohere、Perplexity、SambaNova、Nebius、AI21、Hyperbolic、FriendliAI、NVIDIA、GitHub Models、MiniMax.io、Z.ai、StepFun AI
> - **第三方 / 聚合**：OpenRouter、Together AI、Fireworks AI、DeepInfra、Novita、Featherless、PPIO；另有第三方平台（API 中转站）33 家已按各官方文档核实接入，目录中标注「未接入」的暂未核实
>
> **Agent = 你使用的软件**（Claude Code / Cursor / CC Switch / Trae …），记录会自动按工具识别，并在「Agent 消耗」中统计。

之后每一次模型调用都会自动落账，无需其他操作。

## 悬浮统计卡片

顶栏的「悬浮统计」按钮可打开一块**钉在桌面上的透明玻璃卡片**，实时显示今日 Token、今日成本、请求数与今日模型 Top5 排名（前三名红色渐变，可在设置页勾选显示字段）。每 2.5 秒自动刷新，始终置顶、不进任务栏；拖动后位置自动记忆，设置页「重置位置」可恢复默认。点右上角 ✕ 隐藏，再次点顶栏按钮重新呼出。详见[使用说明](/docs/usage)。

## 数据与隐私

- 全部数据保存在本地，不经过任何云端
- API Key 只转发、不落库
- **多设备同步**：在「设置 → 多设备同步」登录云平台账户后，可把本地账本上传 / 下载到云端，多设备按事件去重合并；仅在你主动同步时数据上行，本地优先、云端是副本。
