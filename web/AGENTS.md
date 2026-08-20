# Oxelia51 `web` 应用指南

本文件是 `web` 包的本地说明。monorepo 级规则见根目录 [AGENTS.md](../AGENTS.md)。

## 现状

Oxelia51 是从 langfuse fork 脱钩的 Web 应用。langfuse 原生页面、公共 REST API、
EE/cloud/billing 代码已在波 1-4 删除，只保留 Oxelia51 自有功能与最小基础面。

技术栈：

- Next.js（Pages Router）+ React 19
- tRPC（唯一的内部 API 面）
- Prisma（Postgres）+ ClickHouse（消耗统计），经 `@oxelia51/shared` 访问
- NextAuth v4 认证 + 自建 RBAC

## 目录结构

- `src/features/oxelia51/`：Oxelia51 自有功能（landing、admin 台、站点内容、
  同步、工作区等），服务端代码在其 `server/` 子目录
- `src/pages/app/`：应用主界面（overview、analytics、agents、providers、settings）
- `src/pages/admin/`：管理台页面
- `src/pages/api/sync/`：桌面端同步 REST 端点（login/upload/download）
- `src/pages/api/auth/`：NextAuth 与 signup-verify
- `src/pages/api/public/health.ts`：生产健康检查（唯一保留的 public REST）
- `src/pages/api/trpc/[trpc].ts`：tRPC 入口
- 其余 `src/features/*`：保留的基础能力（auth、rbac、organizations、projects、
  entitlements、filters、dashboard 等）

tRPC router 注册表 `src/server/api/root.ts`，当前 router 清单：

- 基础：`organizations`、`organizationApiKeys`、`projects`、`userAccount`、
  `projectApiKeys`、`members`、`credentials`、`onboarding`
- Oxelia51 定制：`oxelia51`、`workspace`、`sync`、`oxelia51Admin`、
  `proxyKey`、`siteContent`、`siteStats`

新增/修改 tRPC 端点：在对应 feature 的 `server/` 下实现，注册进 `root.ts`，
并保持本文件清单同步。

## 共享包导入约定

- 前端安全代码用 `@oxelia51/shared`（类型、zod schema、领域常量）
- 仅服务端代码（`src/server/**`、`src/pages/api/**`）用
  `@oxelia51/shared/src/server`
- 直接 Prisma 访问用 `@oxelia51/shared/src/db`，不得进入客户端 bundle

## 构建与验证

- 共享包改动后先构建：`cd packages/shared && pnpm run build`（tsc 输出到 dist，
  web 直接消费 dist）
- web 构建（Windows 下请直跑，不要走 package.json 的 `build` 脚本——它依赖
  dotenv 与 Unix shell）：

  ```bash
  cd web && DOCKER_BUILD=1 INLINE_RUNTIME_CHUNK=false NEXT_TELEMETRY_DISABLED=1 pnpm exec next build
  ```

  绿灯标准：路由表正常输出、BUILD_ID 刷新。
- 依赖变更后先在仓库根 `pnpm install` 再构建。
- node 版本 engines warning（want 24 / current 22）可忽略。

## 维护契约

本文件是活文档。以下变更必须在同一改动中同步更新本文件：

- 新增/改名路由族（`src/pages/**`）或 tRPC router
- 构建/验证命令变化
- `@oxelia51/shared` 导入约定变化
