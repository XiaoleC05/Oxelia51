# Oxelia51

一站式开发者工具平台。一个入口访问全部在线工具，统一账号与体验。

## Features

- 用户注册与 JWT 认证
- 工具目录浏览与分类检索
- 前端统一渲染工具界面，后端通过 API 网关转发请求至各工具服务
- 管理员后台：工具元数据增删改查
- 各工具端口不暴露公网，仅内网转发

## Architecture

```text
Browser
  ↓
Nginx (reverse proxy)
  ↓
React Frontend (unified UI for all tools)
  ↓
Go API Layer (auth, tool registry, API gateway)
  ↓           ↓
PostgreSQL    Redis
(user/tool     (session cache,
 metadata)     task queue)

Internal API gateway:
  Go Backend → Tool A API (internal)
             → Tool B API (internal)
             → Tool C API (internal)
```

各工具仅提供后端 API，不包含独立前端。前端统一由 Oxelia51 的 React 应用渲染，后端负责认证、工具注册和请求转发。

## Directory Structure

```text
Oxelia51/
├── backend/          # Go + Gin
│   ├── cmd/          # entry point
│   ├── internal/     # business logic
│   └── migrations/   # PostgreSQL migrations
├── frontend/         # React (Vite)
├── docker/           # Docker Compose
├── docs/             # development documents
├── README.md
└── README_CN.md
```

## Requirements

- Go 1.26+
- Node.js 24+
- PostgreSQL 17
- Redis 7
- Docker & Docker Compose

## Quick Start

```bash
# clone repository
git clone https://github.com/XiaoleC05/Oxelia51.git
cd Oxelia51

# start dependencies
docker compose up -d

# backend
cd backend
go run ./cmd/main.go

# frontend
cd frontend
npm install
npm run dev
```

## Configuration

配置通过环境变量管理。复制 `.env.example` 为 `.env` 并填入实际值：

- `DATABASE_URL`: PostgreSQL 连接字符串
- `REDIS_URL`: Redis 连接字符串
- `JWT_SECRET`: JWT 签名密钥

## Usage

访问 [oxelia51.com](https://oxelia51.com) 注册账号后进入工具目录，选择工具开始使用。

## Development

| 模块 | 状态 |
|------|------|
| 用户系统（注册/登录/JWT） | 已完成 |
| 工具目录（列表/详情） | 已完成 |
| 管理后台（工具 CRUD） | 进行中 |
| 平台落地页 | 未开始 |
| API 网关 | 未开始 |

## Deployment

```bash
# build and deploy with Docker Compose
docker compose -f docker/docker-compose.yml up -d --build
```

## Roadmap

- [ ] 平台落地页
- [ ] API 网关与工具请求转发
- [ ] 前端工具 UI 框架
- [ ] 工具集成的标准化注册机制
- [ ] 按 ADR-004 将 5 个在线工具接入 API 网关

## Contributing

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/xxx`)
3. 提交变更 (`git commit -m 'Add xxx'`)
4. 推送分支 (`git push origin feature/xxx`)
5. 提交 Pull Request

## License

This project is licensed under the MIT License.
