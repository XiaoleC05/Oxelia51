> ⚠️ 本任务已完成。DormGuard go-backend/ 已部署，dormguard-go 已编译通过。
> 此文件保留作为历史记录。

---
from: Codex (Architecture Agent)
to: Cursor (Backend Agent)
task: REF-01
status: completed
date: 2026-07-08
depends_on: none
blocks: TOOL-02, TOOL-03, TOOL-04
---

# REF-01：DormGuard Python → Go 重构 ✅ 已完成

## 背景

DormGuard 是 Oxelia51 平台的宿舍管理系统工具，也是平台上线最早的在线工具。
当前为 Python 技术栈（FastAPI + NoneBot），独立部署在服务器 `/opt/DormGuard`，
通过 Oxelia51 API Gateway 代理访问（`/api/tools/dormguard/proxy/*path`）。

已有一次成功的 Go 重构验证（内存从 ~70MB 降至 3.5MB），需要将其固化为正式的 Go 项目。

## 当前架构

| 组件 | 技术 | 端口 | systemd |
|------|------|------|---------|
| 后端 API | Python FastAPI | 8000 | dormguard-backend |
| QQ Bot | Python NoneBot | 8089 | dormguard-nonebot |
| QQ 协议端 | NapCat | Docker | Docker |
| 数据库 | MySQL | 独立实例 | - |

## 目标架构

替换为单一 Go 二进制（或 API + Bot 两个二进制），复用现有 MySQL 数据库：

| 组件 | 技术 | 端口 |
|------|------|------|
| 后端 API | Go + Gin | 8000 |
| QQ Bot | Go（与 API 同进程或独立进程）| 8089 |
| QQ 协议端 | NapCat | 不变 |
| 数据库 | MySQL | 不变 |

## 约束

1. **API 契约不变**：所有现有端点路径、请求/响应格式必须保持不变。
   Gateway 代理 `TOOL_API_BASE_DORMGUARD=http://127.0.0.1:8000` 继续工作。
2. **OXELIA_GATEWAY_MODE** 环境变量控制：当设置时，信任网关传入的用户身份头。
3. **CORS**：允许 `:5173`（本地开发）。
4. **MySQL**：复用现有数据库，不做 schema 迁移。
5. **NapCat**：QQ Bot 必须与现有 NapCat Docker 容器兼容（WebSocket 或 HTTP 回调）。
6. **内存目标**：< 10MB（参考：上次验证达 3.5MB）。

## 关键 API（必须保留）

请注意：你应当在 DormGuard 仓库中自行阅读完整代码，以下仅为索引：

- `GET /api/health` — 健康检查
- `GET /api/rooms` — 宿舍列表
- `GET /api/rooms/:id` — 宿舍详情
- `POST /api/rooms` — 创建宿舍
- `PATCH /api/rooms/:id` — 更新宿舍
- `DELETE /api/rooms/:id` — 删除宿舍
- `GET /api/crawler/status` — 爬虫状态
- `POST /api/crawler/trigger` — 触发爬虫
- `GET /api/crawler/history` — 爬虫历史
- `GET /api/alerts` — 告警列表
- `PATCH /api/alerts/:id` — 更新告警配置
- QQ Bot 命令：`/status`、`/help` 等

## Go 项目结构建议

```
DormGuard/
├── cmd/
│   ├── server/main.go      # API 入口
│   └── bot/main.go         # QQ Bot 入口
├── internal/
│   ├── handler/            # HTTP handlers
│   ├── model/              # 数据模型
│   ├── db/                 # MySQL 访问
│   ├── crawler/            # 爬虫逻辑
│   ├── bot/                # QQ Bot 逻辑
│   └── config/             # 配置
├── go.mod
├── go.sum
├── .env.example
├── oxelia51.tool.json
└── README.md
```

## oxelia51.tool.json

确保重构后 oxelia51.tool.json 内容不变（slug、name、port 等）。

## 部署

重构完成后更新 systemd 服务文件：

```ini
# /etc/systemd/system/dormguard-backend.service
[Service]
ExecStart=/opt/DormGuard/dormguard-server
```

服务文件可通过阿里云 Workbench 操作。

## 接受标准

- [ ] `go build ./...` 通过
- [ ] 所有现有 API 端点响应格式不变
- [ ] Gateway 代理 `TOOL_API_BASE_DORMGUARD=http://127.0.0.1:8000` 正常工作
- [ ] QQ Bot `/status`、`/help` 命令可用
- [ ] NapCat Docker 容器连接正常
- [ ] OXELIA_GATEWAY_MODE 模式下身份头正确传递
- [ ] CORS `:5173` 允许
- [ ] 内存 < 10MB
- [ ] oxelia51.tool.json 不变

## 仓库

github.com/XiaoleC05/DormGuard

在 DormGuard 仓库中创建新分支 `codex/REF-01-go-refactor` 进行开发。
*** End of File
