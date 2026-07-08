---
from: Codex (Architecture Agent)
to: Cursor (Backend Agent)
task: TOOL-05-3
status: ready
date: 2026-07-09
depends_on: TOOL-05-1 (已完成, commit 04dcf23)
blocks: none
---

> **Cursor 职责边界（AGENTS.md §4.2）**
> - ✅ 可修改：后端源代码、后端配置、后端测试、后端文档
> - ❌ 不得修改：前端、UI、CSS、项目架构、数据库设计、API 规范、CI/CD 工作流
> - ⚠️ 上报：数据库模式变更、API 变更、框架变更、项目结构变更、第三方依赖变更

# TOOL-05-3：SuperRead Oxelia51 注册 + Gateway 接入

## 背景

SuperRead 后端已完成（TOOL-05-1，commit 04dcf23，仓库 XiaoleC05/SuperRead）。
后端端口：8002，API 根路径：`/api`。

## 任务

### 1. 环境变量

在 Oxelia51 后端 `.env` 中新增：

```
TOOL_API_BASE_SUPERREAD=http://127.0.0.1:8002
```

更新 `backend/.env.example` 同步。

### 2. 更新 tools 表

```sql
UPDATE tools SET internal_api_base = 'http://127.0.0.1:8002'
WHERE slug = 'superread';
```

### 3. 同步 seed-tools.sql

在 `deploy/seed-tools.sql` 中更新 superread 行的 `internal_api_base` 字段：

```sql
('superread', ..., 'http://127.0.0.1:8002', ...)
```

### 4. Gateway 验证

Gateway 应已支持动态路由（通过 tools 表的 internal_api_base 字段）。
验证 `GET /api/tools/superread/proxy/api/health` → 200。

如 Gateway 不支持动态路由，需修改 `backend/internal/gateway/` 以支持。

### 5. 部署脚本（可选）

如需服务器部署，通过阿里云 Workbench 将 SuperRead 二进制放至
`/opt/SuperRead/`，创建 systemd 服务：

```ini
[Service]
ExecStart=/opt/SuperRead/superread-server
Environment=DATABASE_URL=...
Environment=SUPERREAD_PORT=8002
Environment=OXELIA_GATEWAY_MODE=true
```

## 操作范围

- `backend/.env` + `backend/.env.example`
- `deploy/seed-tools.sql`
- （可选）`backend/internal/gateway/`

## 接受标准

- [ ] `TOOL_API_BASE_SUPERREAD` 环境变量已配置
- [ ] tools 表 `internal_api_base` 已更新
- [ ] seed-tools.sql 已同步
- [ ] Gateway 代理 `/api/tools/superread/proxy/api/health` → 200
- [ ] `.env.example` 已同步
*** End of File
