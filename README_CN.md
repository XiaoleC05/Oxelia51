# Oxelia51

一站式开发者工具平台。一个入口访问全部在线工具，统一账号与体验。

**版本**：v2.0

## 功能特性

- 用户注册与 JWT 认证（`account_id` 作为不可变登录标识）
- 工具目录浏览、状态徽章与分类检索
- 前端统一渲染工具界面，后端通过 API 网关转发请求至各工具服务
- 管理员后台：工具元数据增删改查
- 各工具端口不暴露公网，仅内网转发
- 友情链接页（`/friends`）与个人资料页（`/profile`）
- 服务器资源监控面板
- DormGuard QQ 机器人已上线

## 架构

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

## 技术栈

| 层级 | 方案 | 备注 |
| --- | --- | --- |
| 后端 | Go + Gin | 认证、工具注册、API 网关 |
| 前端 | React + Vite | 统一工具界面 |
| 数据库 | PostgreSQL | 用户/工具元数据 |
| 缓存 / 队列 | Redis | 会话缓存、限流器 |
| 部署 | Docker Compose + Nginx | 2核2G 云服务器 |
| AI 协作 | 5-agent 模型 | Codex（架构）、Cursor（后端）、Qoder Wake（前端）、Qoder（QA 与部署）、Trae Work（审查与知识） |

## 目录结构

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

## 页面与路由

| 路由 | 说明 |
|------|------|
| `/` | 平台落地页（头图轮播 + 推荐区块） |
| `/tools` | 工具目录 |
| `/tools/:slug` | 工具壳（DormGuard 等） |
| `/portfolio` | 作品集 |
| `/blog` | 博客列表 |
| `/blog/:id` | 文章详情 |
| `/about` | 关于页面 |
| `/friends` | 友情链接 |
| `/profile` | 个人资料（修改显示名） |
| `/login` `/register` `/verify-email` `/forgot-password` `/reset-password` | 认证流程 |
| `/admin` | 管理后台 |

## 开发进度

| 模块 | 状态 |
|------|------|
| 用户系统（注册/登录/JWT） | 已完成 |
| 工具目录（列表/详情） | 已完成 |
| 管理后台（工具 CRUD） | 已完成 |
| 平台落地页 | 已完成 |
| API 网关 | 已完成 |
| 友链 / 资料页 | 已完成 |
| 服务器资源监控 | 已完成 |
| DormGuard QQ 机器人 | 已完成 |

## 部署

```bash
# 使用 Docker Compose 构建并部署
docker compose -f docker/docker-compose.yml up -d --build
```

## 路线图

- [x] 平台落地页
- [x] API 网关与工具请求转发
- [x] 前端工具 UI 框架
- [x] 工具集成的标准化注册机制
- [x] 按 ADR-004 将 5 个在线工具接入 API 网关
- [x] 个人资料页与 `account_id` 登录标识
- [x] 友情链接页
- [x] 服务器资源监控
- [x] DormGuard QQ 机器人接入

## Contributing

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/xxx`)
3. 提交变更 (`git commit -m 'Add xxx'`)
4. 推送分支 (`git push origin feature/xxx`)
5. 提交 Pull Request

## License

This project is licensed under the MIT License.
