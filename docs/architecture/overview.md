# Oxelia51 总体架构

**版本**：v4 现状快照 | **撰写依据**：仓库实际代码与配置（非历史设计稿）

> 本文是全系统入口。各子系统详设见文末「阅读地图」。

---

## 1. 项目定位

Oxelia51 是一个**本地优先的 LLM Token 记账平台**：桌面端在本机拦截并记录各
LLM 供应商的 token 消耗（SQLite 落盘、离线可用），可选云同步到云端做跨设备
汇总；云端同时提供公共代理网关（按项目密钥计费）、Web 站点（落地页/文档/
下载/个人工作台）与 Go 管理后台（平台运维）。

Web 应用是从 langfuse fork 脱钩而来的（见 `web/AGENTS.md`），原生页面与公共
REST API 已分波删除，只保留 Oxelia51 自有功能与最小基础面；仓库内仍可见
langfuse 命名残留（如镜像名 `langfuse-token-web`、容器名 `langfuse-*`）。

## 2. 子系统全景

| 子系统 | 目录 | 技术栈 | 部署位置 | 职责 |
|--------|------|--------|----------|------|
| 桌面端 | `desktop/` | Tauri 2 + React/Vite UI + Go sidecar | 用户本机 | 本地账本 UI；内嵌 proxy-gateway 作 sidecar |
| Web 应用 | `web/` + `packages/shared/` | Next.js 16（Pages Router）+ tRPC + Prisma + NextAuth v4 | 腾讯云 Docker | 站点（landing/docs/download）+ 云平台（工作台/同步/管理台） |
| 管理后台 | `backend/` | Go 1.26 + Gin + pgx + Redis | 阿里云 systemd | 平台运维 API：管理员用户、工具注册、IP 白名单、exec |
| 记账代理 | `proxy-gateway/` | Go（stdlib http）| 本机 sidecar / 阿里云 systemd | LLM API 反向代理 + token 计量，双模式（本地/云端） |
| 分析引擎 | `analytics/` | C++（CMake）| 腾讯云 systemd timer（5 分钟） | ClickHouse → 聚合/定价/异常检测/预算告警 → PG |
| 部署 | `deploy/` + `.github/workflows/` | shell + Nginx + GHA | 双云 | 见 §6 |

关键版本锚点：

- `desktop/src-tauri/Cargo.toml`：`tauri = "2"`，应用名 `oxelia51-desktop`（v0.1.11）
- `web/package.json`：`next: 16.2.11`，包名 `web`（v0.1.10）
- `backend/go.mod`：module `github.com/XiaoleC05/oxelia51-backend`，go 1.26
- `proxy-gateway/go.mod`：module `github.com/XiaoleC05/Oxelia51/proxy-gateway`
- `analytics/src/main.cpp`：systemd timer 每 5 分钟触发的离线批处理

## 3. 双云拓扑

两台生产服务器（见 `deploy/README.md`）：

| 服务器 | IP | 配置 | 角色 |
|--------|-----|------|------|
| 阿里云 | 47.108.202.199 | 2C2G | 主入口 Nginx + 管理后台(8080) + 云代理网关(9090) + Webhook(9000) + PG/Redis |
| 腾讯云 | 118.25.138.177 | 4C4G | Web 应用(3000) + PG(5434) + ClickHouse(8123/9000) + Redis + MinIO + C++ 引擎 |

**SSH 隧道**（`deploy/systemd/token-tunnel.service`，阿里云侧）：

- `127.0.0.1:3000` → 腾讯云 `web:3000`（阿里云 Nginx 把站点流量经隧道转给 web）
- `127.0.0.1:9001` → 腾讯云 `127.0.0.1:9000`（ClickHouse Native 协议，供阿里云上的云代理网关写入 token 事件）

阿里云 Nginx 路由（`deploy/nginx/oxelia51.com.conf`，拓扑见 `deploy/README.md`）：

```
oxelia51.com
  ├─ / 、/api/sync/、/api/auth/、/api/trpc/、/token/  → 127.0.0.1:3000（SSH 隧道 → 腾讯云 web）
  ├─ /api/                                            → 127.0.0.1:8080（Go 管理后台）
  │     └─ /api/tools/:slug/proxy/*                   → 后台内部再转发到各工具内网端口
  ├─ /api/proxy/                                      → 127.0.0.1:9090（云代理网关）
  └─ /webhook                                         → 127.0.0.1:9000（receiver.py）
```

注意 `/api/` 前缀的拆分是按**更具体前缀优先**：`/api/sync/`、`/api/auth/`（web
的 NextAuth，不是后台的 `/api/auth/login`）、`/api/trpc/` 归 web，其余 `/api/`
归 Go 后台。两套 `/api/auth/*` 分属不同系统，不要混淆。

## 4. 数据流总图

两条记账链路（本地优先 + 云端代理），一个分析回路：

```
【本地链路 — 默认】
LLM 客户端
  → 桌面 sidecar（proxy-gateway 本地模式，127.0.0.1:17800，免鉴权）
  → 转发至各 LLM 供应商，同时计量
  → SQLite 落盘（本机）
  →（可选云同步）POST /api/sync/upload（Bearer oxs_ 同步密钥）
  → web PG `oxelia51.synced_events`（event_id 去重，seq 增量游标）
  → 其他设备 GET /api/sync/download 增量拉取
  → web /app 设置页「同步账本」汇总展示（syncRouter）

【云端链路 — 公共代理】
LLM 客户端（带 ox_ 项目密钥）
  → oxelia51.com/api/proxy/（云代理网关，:9090，PG proxy_keys 鉴权）
  → 转发至供应商，计量后经 SSH 隧道 127.0.0.1:9001 写入
  → ClickHouse `oxelia51.token_events`（腾讯云）
  → analytics（C++，5 分钟 timer）：聚合 + model_pricing 定价 + 异常检测
  → PG `oxelia51.daily_stats` / `alert_logs` / `budget_configs`（web 同库）
  → web 工作台（workspaceRouter / oxelia51Router 读 PG + ClickHouse）展示
```

要点：

- **token_events.cost_usd 恒 0**——成本由 C++ 引擎事后算进 `daily_stats`；
  web 侧会话/明细级成本用 token × `model_pricing` 现算
  （见 `web/src/features/oxelia51/server/workspaceRouter.ts` 头注释）。
- web 的 PG（腾讯云，NextAuth 用户）与后台的 PG（阿里云，运维用户）是
  **两个数据库、两套用户体系**，互不相同。
- `oxelia51` schema 的业务表（synced_events、sync_tokens、site_content、
  daily_stats 等）由 `analytics/deploy/migrations/*.sql` 建管，**不在**
  Prisma schema 内，web 一律用参数化 `$queryRaw` 访问。

## 5. Monorepo 结构

pnpm workspace（`web`、`packages/*`）+ 三个独立 Go module（`backend`、
`proxy-gateway`）+ 一个 CMake 工程（`analytics`）+ Tauri 工程（`desktop`）。

```
Oxelia51/
├── desktop/          # Tauri 2 桌面端（src-tauri=Rust 壳，ui=React/Vite，scripts=工具脚本）
│   └── src-tauri/    #   内嵌 proxy-gateway 预编译二进制作 sidecar（binaries/、proxy-*.exe）
├── web/              # Next.js 站点 + 云平台（详见 web.md）
├── packages/
│   ├── shared/       # @oxelia51/shared：Prisma schema + 服务端服务 + ClickHouse client
│   ├── config-eslint/、config-typescript/、eslint-plugin/   # 共享工程配置
├── backend/          # Go 管理后台（详见 backend.md）
├── proxy-gateway/    # Go 记账代理（双模式；桌面 sidecar 与云端网关同源）
├── analytics/        # C++ 批处理引擎 + deploy/migrations（oxelia51 schema 建表）
├── deploy/           # 双云部署：nginx/systemd/webhook/docker/脚本（见 deploy/README.md）
├── scripts/          # 本地开发脚本
└── .github/workflows/# CI/CD（见 §6）
```

桌面 sidecar 与云端代理是**同一份 proxy-gateway 源码**的两种运行模式
（`proxy-gateway/cmd/proxy/main.go`）：本地模式 `LOCAL_MODE=true` 听
127.0.0.1:17800、写 SQLite、免密钥鉴权；云端模式听 :9090、写 ClickHouse、
按 PG `proxy_keys` 鉴权。

## 6. 部署管线总览

`.github/workflows/` 四条管线：

| 管线 | 触发 | 产出 |
|------|------|------|
| `push-to-acr.yml` | push master 且 `web/**`、`packages/**` 等变更 | 构建 web 镜像 → 推阿里云 ACR（`oxelia51/langfuse-token:latest`），腾讯云 compose 拉取 |
| `deploy.yml` | push master / 手动 | go vet + test → 交叉编译 backend/proxy/analytics（linux/amd64）→ 打 tarball → 建 `release-*` GitHub Release（仅留最新 2 个） |
| `desktop-build.yml` | push `v*` tag / 手动 | 三平台（win nsis / macOS dmg / linux deb,rpm,appimage）打包，产物传 GitHub Release 供 /download 页 |
| `emergency-restart.yml` | 手动 | 紧急重启 |

`deploy.yml` 的 Release 发布触发 GitHub webhook（release published）→ 阿里云
`deploy/webhook/receiver.py`（验签 + 按 repo 路由）→ 主平台走 `deploy.sh` →
`apply-release.sh` 解包安装；工具仓库（DormGuard/SecretStore）走
`tool-deploy.sh`。细节与回滚见 `deploy/README.md`、`deploy/RUNBOOK.md`。

**铁律**（`AGENTS.md` §5）：所有构建在本地/CI 完成，服务器只做部署。

## 7. 阅读地图

| 篇目 | 内容 |
|------|------|
| [web.md](web.md) | Web 应用详设（web/ + packages/shared/）：路由、tRPC、认证、数据访问、镜像构建 |
| [backend.md](backend.md) | Go 管理后台详设（backend/）：路由全表、安全设计、迁移、部署 |
| proxy-gateway.md | 记账代理详设 |
| analytics.md | C++ 分析引擎详设 |
| desktop.md | 桌面端详设 |
| data-flow.md | 端到端数据流 |

历史设计稿（v3，与现状有偏差）在 `docs/archive/`；站点级运维手册在
`deploy/RUNBOOK.md`。
