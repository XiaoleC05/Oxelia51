<!--
============================================================
  Oxelia51 —— 在线工具平台
  版本：v2.0  |  更新：2026-07-08
============================================================
-->

# Oxelia51

> 一站式开发者工具平台。一个入口访问全部在线工具，统一账号与体验。

## 简介

Oxelia51（奥泽莉亚51）是一个面向开发者的在线工具服务平台。平台提供统一认证、工具目录、API 网关转发，各工具仅提供后端 API，前端统一由 React 应用渲染。同时展示开发者技术能力与开源作品集。

- 域名：[oxelia51.com](https://oxelia51.com)
- 仓库：[github.com/XiaoleC05/Oxelia51](https://github.com/XiaoleC05/Oxelia51)（公开只读）

## 功能

- 用户注册与 JWT 认证（`account_id` 作为不可变登录标识，`username` 为可修改显示名）
- 邮箱验证、密码重置、会话管理（access 7 天 / refresh 30 天）
- 工具目录浏览，状态徽章与分类检索
- 前端统一渲染工具界面，后端通过 API 网关转发请求至各工具服务
- 管理员后台：工具元数据 CRUD、服务器资源监控
- 各工具端口仅内网暴露，不对外公开
- 友情链接（`/friends`）与个人资料（`/profile`）
- DormGuard QQ 机器人已上线

## 架构

```
Browser
  ↓
Nginx（反向代理）
  ↓
React 前端（所有工具的统一界面）
  ↓
Go API 层（认证、工具注册、API 网关）
  ↓           ↓
PostgreSQL    Redis
（用户/工具    （会话缓存、
 元数据）      限流器）

内部 API 网关：
  Go Backend → 工具 A API（内网）
             → 工具 B API（内网）
             → 工具 C API（内网）
```

各工具仅提供后端 API，不包含独立前端。所有界面由平台 React 应用统一渲染，后端负责认证、工具注册和请求转发。

## 技术栈

| 层级 | 方案 | 说明 |
|------|------|------|
| 后端 | Go + Gin | 认证、工具注册、API 网关 |
| 前端 | React + Vite | 统一工具界面 |
| 数据库 | PostgreSQL 17 | 用户与工具元数据 |
| 缓存 | Redis 7 | 会话缓存、限流器 |
| 部署 | Docker Compose + Nginx | 2 核 2G 云服务器 |
| AI 协作 | 5-agent 模型 | Codex（架构）、Cursor（后端）、Hermes（前端）、Qoder（QA 与部署）、Trae Work（审查与知识） |

## 目录结构

```
Oxelia51/
├── .agents/          # 各 Agent 任务提示词
├── .github/          # GitHub Actions CI/CD
├── backend/          # Go + Gin
│   ├── cmd/          # 入口
│   ├── internal/     # 业务逻辑
│   └── migrations/   # PostgreSQL 迁移脚本
├── frontend/         # React（Vite）
│   ├── public/       # 静态资源
│   └── src/          # 组件、页面、工具壳
├── deploy/           # 部署脚本与配置
│   ├── docker/       # Docker Compose
│   ├── nginx/        # Nginx 配置
│   ├── systemd/      # systemd 服务文件
│   └── webhook/      # 自动部署 webhook
├── docs/             # 项目文档
│   ├── adr/          # 架构决策记录
│   ├── api/          # API 契约
│   ├── tools/        # 工具设计文档
│   ├── ui/           # UI 报告
│   ├── reviews/      # 审查报告
│   └── archive/      # 历史文档归档
├── scripts/          # 辅助脚本
├── developer/        # 开发者私人工作文档
├── AGENTS.md         # 多 Agent 协作规范
├── docker-compose.yml
└── README.md
```

## 环境要求

- Go 1.26+
- Node.js 24+
- PostgreSQL 17
- Redis 7
- Docker 与 Docker Compose

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/XiaoleC05/Oxelia51.git
cd Oxelia51

# 启动依赖服务
docker compose up -d

# 后端
cd backend
cp .env.example .env   # 编辑 .env 填入实际配置
go run ./cmd/server/main.go

# 前端
cd frontend
npm install
npm run dev
```

## 配置

通过环境变量管理。复制 `.env.example` 为 `.env` 并填入实际值：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `REDIS_URL` | Redis 连接字符串 |
| `JWT_SECRET` | JWT 签名密钥 |
| `SMTP_*` | 邮件服务配置（阿里云邮件推送） |
| `CRAWLER_*` | DormGuard 爬虫相关密钥 |

> 完整环境变量见 `backend/.env.example`。

## 页面与路由

| 路由 | 说明 |
|------|------|
| `/` | 平台落地页 |
| `/tools` | 工具目录 |
| `/tools/:slug` | 工具壳（DormGuard 等） |
| `/portfolio` | 作品集 |
| `/blog` | 博客列表 |
| `/blog/:id` | 文章详情 |
| `/about` | 关于页面 |
| `/friends` | 友情链接 |
| `/profile` | 个人资料（修改显示名） |
| `/login` `/register` `/verify-email` | 认证流程 |
| `/forgot-password` `/reset-password` | 密码重置 |
| `/admin` | 管理后台（仅 `oxelia51`） |

## 开发进度

| 模块 | 状态 |
|------|------|
| 用户系统（注册/登录/JWT/邮箱验证） | 已完成 |
| account_id 账号体系 | 已完成 |
| 工具目录（列表/详情/状态徽章） | 已完成 |
| 管理后台（工具 CRUD + 资源监控） | 已完成 |
| 平台落地页 + 博客 + 作品集 + 关于 | 已完成 |
| API 网关 | 已完成 |
| 友链 / 个人资料页 | 已完成 |
| 全站视觉系统（PageLoader / 星空背景 / 毛玻璃） | 已完成 |
| 移动端适配 | 已完成 |
| DormGuard QQ 机器人 | 已完成 |
| DormGuard Go 重构 | 已完成 |
| 服务器资源监控 | 已完成 |
| SecretStore 加密保险箱 | 开发中 |

## 部署

```bash
# 使用 Docker Compose 构建并部署
docker compose -f deploy/docker/docker-compose.yml up -d --build
```

详细部署文档见 [deploy/README.md](deploy/README.md)。

## 路线图

- [x] 平台落地页
- [x] API 网关与工具请求转发
- [x] 前端工具 UI 框架
- [x] 标准化工具注册机制
- [x] 5 个在线工具接入 API 网关（ADR-004）
- [x] `account_id` 登录标识 + 个人资料页
- [x] 友情链接页
- [x] 服务器资源监控
- [x] DormGuard QQ 机器人接入
- [x] DormGuard Go 重构（Python → Go，内存降 95%）
- [ ] SecretStore 加密保险箱工具

## AI 协作模型

本项目采用 **5-agent 多智能体协作模型**（详见 [AGENTS.md](AGENTS.md)）：

| 角色 | 智能体 | 职责 |
|------|--------|------|
| 架构 | Codex | 整体架构、任务分解、最终集成 |
| 后端 | Cursor | 业务逻辑、API、数据库 |
| 前端 | Hermes | UI、交互、响应式 |
| QA 与部署 | Qoder | 测试、构建、CI/CD |
| 审查与知识 | Trae Work | 代码审查、文档、命名一致性 |

## 参与贡献

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/xxx`）
3. 提交变更（`git commit -m 'feat: 描述'`）
4. 推送分支（`git push origin feature/xxx`）
5. 提交 Pull Request

提交格式遵循：`feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `style:` / `chore:`

## 许可证

本项目基于 MIT License 开源。
