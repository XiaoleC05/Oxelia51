---
title: FAQ
section: 帮助
order: 10
---

## 基础

**Q：Oxelia51 和 Langfuse 是什么关系？**
A：Oxelia51 的云平台基于 Langfuse（MIT）fork 并深度定制，融合了 Helicone 的代理记账理念，形成自己的产品。桌面应用为全新本地应用。

**Q：一定要注册才能用吗？**
A：不需要。桌面应用全功能本地使用；文档、下载、社区匿名开放。登录仅在跨设备同步、云平台时出现。

**Q：数据安全吗？**
A：桌面应用数据全部本地；云平台数据加密存储。API Key 只转发、不落库。

**Q：桌面应用什么时候发布？**
A：已发布 v0.1.x，支持 Windows / macOS / Linux。在下载页或 GitHub Releases 获取。

## 使用

**Q：改一行环境变量具体改哪里？**
A：在模型工具的配置文件里设置 `ANTHROPIC_BASE_URL` 或 `OPENAI_BASE_URL` 指向本地代理的对应供应商地址即可，见[桌面应用](/docs/desktop)。例如 DeepSeek 用 `export OPENAI_BASE_URL="http://127.0.0.1:17800/api/proxy/deepseek"`（Base URL 必须含 `/api/proxy/<供应商slug>` 前缀）。

**Q：会不会影响我的模型调用？**
A：代理只做转发与落账，不改写请求内容，正常调用不受影响。

**Q：支持哪些模型？**
A：内置 76 条供应商路由，覆盖国内（DeepSeek、智谱、通义、Kimi、豆包、混元、星火、MiniMax、硅基流动…）、国际（Anthropic、OpenAI、Gemini、Mistral、Grok、Groq…）与聚合平台（OpenRouter、Together…），另有 33 家第三方平台（API 中转站）已接入；内置 72 个模型参考价，支持美元/人民币切换。

**Q：用 Codex 接第三方中转站，报 404「模型名称不存在，或您所在分组下暂无可用渠道」，是代理的问题吗？**
A：不是，是上游供应商自己返回的——常见原因是客户端用了 OpenAI 较新的 Responses API，但上游只支持 Chat Completions。把客户端的协议格式切换成 Chat Completions 即可解决。完整排查过程见[常见错误排查](/docs/troubleshooting)。

**Q：多台设备怎么同步账本？**
A：在桌面端「设置 → 多设备同步」用云平台注册邮箱+密码登录，即可上传 / 下载本地账本；多设备按事件去重合并，仅在你主动点同步时数据上行，本地优先、云端是副本。已同步的账本可在云平台「/app 设置 → 同步账本」查看，并管理同步密钥（可断开）。

## 部署

**Q：可以自己部署吗？**
A：可以。一条 `docker compose up -d` 即可部署云平台，数据不离开你的服务器。部署说明见 [GitHub 仓库](https://github.com/XiaoleC05/Oxelia51)。

**Q：桌面应用和自托管有什么区别？**
A：桌面应用是面向个人、零部署的本地应用；自托管是自己部署云平台。两者数据模型一致，通过账户同步互通。

## 反馈

**Q：怎么反馈问题或提需求？**
A：站内反馈、邮箱 receive@oxelia51.com，或 GitHub Issues / Discussions。
