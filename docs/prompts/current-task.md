# Oxelia51 v3.0 — 项目状态 & 待办任务汇总

> ⚠️ 已过期：v3.0 时代待办快照（2026-07），保留存档；现状以 docs/README.md 与 CHANGELOG.md 为准。

## 已完成

### Phase 1: Langfuse 部署
- 腾讯云 Docker Compose 部署 Langfuse 全家桶（web/worker/pg/ch/redis/minio）7 容器
- 阿里云 Nginx 反向代理 `/token/` → SSH 隧道 → 腾讯云 langfuse-web:3000
- SSH 隧道 systemd 持久化（`token-tunnel.service`）

### Phase 2: Go 代理网关
- 6 个 LLM 协议适配器（OpenAI, Anthropic, DeepSeek, etc）
- SSE 流式解析，Token Bucket 限流
- 异步 ClickHouse 记录（goroutine + channel）
- 部署阿里云 systemd `token-proxy.service`

### Phase 3: C++ 分析引擎
- ClickHouse 聚合（libcurl） + PostgreSQL 告警（libpq）
- 异常检测（3x 基线）、预算检查、成本计算
- systemd timer 每 5 分钟执行
- 修复：注释 `\\` 行续符 bug

### Phase 4: 前端定制 + 部署
- CI/CD 链路：GitHub Actions → ACR 镜像仓库 → 腾讯云 docker pull
- Nginx 路由：`/` 根路径直通 Langfuse，`/api/` 保留 Go 后端
- NextAuth `/api/auth/`、tRPC `/api/trpc/` 正确代理
- 旧 SPA 前端已删除（`frontend/`、`article/`、`developer/`、`weather/` 等模块）

### 代码清理
- 删除 19,380 行旧代码
- Go 后端精简为 17 条核心 API 路由
- CI 流水线精简（不再构建旧前端）

## 部署架构（当前）

```
oxelia51.com (阿里云 Nginx)
  ├─ /              → SSH 隧道 → 腾讯云 langfuse-web:3000
  ├─ /api/auth/     → 腾讯云 langfuse-web:3000 (NextAuth)
  ├─ /api/trpc/     → 腾讯云 langfuse-web:3000 (tRPC)
  ├─ /api/auth/login→ 阿里云 Go 后端 :8080
  ├─ /api/          → 阿里云 Go 后端 :8080
  ├─ /_next/        → 腾讯云 langfuse-web:3000
  └─ /webhook       → 阿里云 receiver :9000
```

## 当前核心 API 路由

```
POST /api/auth/login              — 管理员 JWT 登录
POST /api/auth/refresh            — JWT 刷新
POST /api/auth/logout             — 登出
GET  /api/health                  — 健康检查
GET  /api/uptime                  — 运行时长
ANY  /api/tools/:slug/proxy/*     — 工具代理网关
POST /api/admin/exec              — 服务器命令执行（核心运维）
GET  /api/admin/users             — 用户管理
GET  /api/admin/server-stats      — 服务器统计
CRUD /api/admin/ip-whitelist      — IP 白名单
POST /api/admin/hero-images/upload— 文件上传
```

## 前端待办（需要单独完成）

### 🔴 紧急：恢复英文支持

`web/next.config.mjs` 第 130 行 `locales: ["zh-CN"]` 限制了只有中文，但 Langfuse **源码内只有英文硬编码文本**，没有中文翻译文件。结果界面功能正常但所有文本仍显示英文。

**立即修复**：
```js
// web/next.config.mjs
i18n: {
    locales: ["en", "zh-CN"],
    defaultLocale: "zh-CN",
}
```

### 🟡 Logo 图标修复

`web/src/components/design-system/LangfuseIcon/LangfuseIcon.tsx`：
- `icon.svg` → `icon.png` （已修，待重新构建部署）
- `alt="Langfuse Icon"` → `alt="Oxelia51"` （已修）
- 部分页面 `<img src="/icon.svg">` 的引用可能还有残留

素材位置：`web/public/icon.png`（黄）、`web/public/logo.png`（蓝）、`web/public/gongan.png`

### 🟡 ICP 备案号 & 开源声明

`web/src/components/FilingInfo.tsx` 需要正确挂载到所有登录后页面的底部（目前只挂了侧边栏和登录页）。

备案 HTML：
```html
<a href="https://beian.miit.gov.cn/">鲁ICP备2026038838号-1</a>
<a href="https://beian.mps.gov.cn/#/query/webSearch?code=37028202001309">
  <img src="/gongan.png" width="16" /> 鲁公网安备37028202001309号
</a>
<div>基于 Langfuse (MIT) 二次开发 · Powered by Langfuse</div>
```

### 🟡 主题切换

`web/src/features/theming/oxelia51-theme.css` + `oxelia51-theme.ts` 的 Cozy/Cosmos 主题，检查与 shadcn light/dark 的兼容性。

### 🟢 后续：中文翻译

Langfuse 没有中文翻译文件，要做的话需要：
1. 创建 `web/messages/zh-CN.json`
2. 翻译所有 UI 字符串（工作量较大）
3. 配置 `next-intl` 加载

### 🟢 后续：品牌名称全局替换

标题、Logo、登录页、页脚已替换为 Oxelia51。代码库中开发者文档链接、API 错误信息中的 "Langfuse" 未动（避免污染上游同步面）。

---

## 运维信息

| 项目 | 信息 |
|------|------|
| 阿里云 IP | 47.108.202.199 |
| 腾讯云 IP | 118.25.138.177 |
| 管理入口 | `https://oxelia51.com` (Langfuse 登录) |
| 运维 API | `POST /api/admin/exec` (JWT admin) |
| ACR 仓库 | `crpi-6hx0lh969xz92v2y.cn-chengdu.personal.cr.aliyuncs.com/oxelia51/langfuse-token:latest` |
| 腾讯云部署 | `cd /opt/langfuse && docker compose -f docker-compose.langfuse.yml up -d langfuse-web` |
| SSH 隧道 | `systemctl status token-tunnel` (阿里云) |

## 仓库

| 仓库 | 说明 |
|------|------|
| `XiaoleC05/Oxelia51` | 主仓库（Go 后端 + CI/CD + 部署） |
| `XiaoleC05/langfuse-token` | Langfuse Fork（前端定制 + Docker 构建） |
