# Bug 报告

## 2026-08-05：IP 白名单"一键添加本机 IP"永远禁用

**现象**：管理后台 IP 白名单页，"一键添加本机 IP"按钮始终不可点击。

**根因**：Langfuse 前端经 tRPC 服务端代理访问 Go 后端时，Go 的 `c.ClientIP()` 返回的是腾讯云服务器 IP（118.25.138.177），该 IP 已在白名单中，导致前端 `disabled` 条件 `items.some(i => i.ip === clientIP)` 永远为 true。

**修复**：
- web/（原 langfuse-token 仓库）`adminRouter.ts`：goFetch 转发浏览器真实出口 IP 到 `X-Oxelia51-Client-IP` 头
- Oxelia51 `handler.go` + `ipcheck.go`：优先读 `X-Oxelia51-Client-IP` 头，回退 `c.ClientIP()`

**验证**：`curl -H 'X-Oxelia51-Client-IP: 8.8.8.8'` 返回 `clientIP: 8.8.8.8` ✅

**状态**：已修复并部署（2026-08-05 12:36）

---

## 2026-08-05：中文镜像部署失败（依赖哈希不匹配）

**现象**：本地构建的 .next 覆盖到镜像后，容器启动报 `Cannot find module`（依次缺 dc-polyfill、@opentelemetry/api、@aws-sdk/core 等）。

**根因**：本地 Node 22 构建的 .next 依赖哈希（如 dd-trace-dfcce4c118d8b23a）与 Docker 内构建的 zh 镜像符号链接哈希（dd-trace-b61b3db8d553ae0d）不同，且 .next/node_modules 不完整（Next 只收集部分依赖）。

**结论**：本地构建无法用于生产。正确方式是 GitHub Actions 用官方 Dockerfile 构建（push-to-acr.yml）。

**状态**：改用 CI 构建中。
