<!--
============================================================
  Oxelia51 — AI 开发者导航 + 个人网站搭建
  版本：v3.0  |  更新：2026-07-22
============================================================
-->

# Oxelia51

大模型能力榜单，有趣网站推荐，个人网站搭建。

## 简介

Oxelia51 做两件事：

1. 大模型能力榜单 — 聚合 LMSYS、SWE-bench、Artificial Analysis 等平台的模型数据，按编程、前端、后端、审查、性价比、速度、中文等维度对比。每周更新。

2. 有趣网站推荐 — 每周一期，推荐开发工具、设计灵感、独立博客、AI 应用等值得看的网站。

3. 个人网站搭建 — 选模板，填信息，获得 `oxelia51.com/@名字` 的个人主页。可自定义博客、项目列表、社交链接。

- 域名：[oxelia51.com](https://oxelia51.com)
- 仓库：[github.com/XiaoleC05/Oxelia51](https://github.com/XiaoleC05/Oxelia51)

## 功能

- 大模型能力榜单（编程、前端、后端、审查、性价比、速度、中文）
- 有趣网站推荐（每周更新）
- 个人主页搭建（`/@username`，选模板、填信息即发布）
- 博客系统
- 管理员后台（用户管理、内容管理、服务器监控、SecretStore、DormGuard）

## 架构

```
Browser → Nginx → React 前端 → Go API → PostgreSQL + Redis
```

- 阿里云 47.108.202.199（主服务器）+ 腾讯云 118.25.138.177（health-server）
- 部署：`git push master` → GitHub Actions → webhook → 服务器

## 技术栈

| 层级 | 方案 | 说明 |
|------|------|------|
| 后端 | Go + Gin | 认证、工具注册、API 网关 |
| 前端 | React + Vite | 统一工具界面 |
| 数据库 | PostgreSQL 17 | 用户与工具元数据 |
| 缓存 | Redis 7 | 会话缓存、限流器 |
| 部署 | Docker Compose + Nginx | 阿里云 2C2G + 腾讯云 4C4G |
| AI 协作 | 4-agent 模型 | Claude Code（架构与部署）、Qoder（后端）、Trae Work（前端）、Codex（审查与测试） |
## 目录结构

```
Oxelia51/
├── backend/          # Go + Gin
├── frontend/         # React + Vite
├── deploy/           # 部署脚本、Nginx、systemd、webhook
├── docs/dev/         # 开发文档
└── scripts/          # 辅助脚本
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
| `TENCENT_HEALTH_URL` | 腾讯云 health-server 地址（用于双服监控） |

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
| `/about` | 关于开发者 |
| `/friends` | 友情链接 |
| `/profile` | 个人资料（修改显示名） |
| `/login` `/register` `/verify-email` | 认证流程 |
| `/forgot-password` `/reset-password` | 密码重置 |
| `/admin` | 管理后台（仅 `oxelia51`） |

## 部署

```bash
docker compose -f deploy/docker/docker-compose.yml up -d --build
```

部署流程：`git push master` → GitHub Actions 构建 → webhook → 服务器自动部署。

## 4-Agent 协作

本项目由一位开发者 + 四个 AI Agent 协作开发（详见 [AGENTS.md](AGENTS.md)）：Claude Code（架构/部署）、Qoder（Go 后端）、Trae Work（React 前端）、Codex（审查/测试/文档）。

## 参与贡献

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/xxx`）
3. 提交变更（`git commit -m 'feat: 描述'`）
4. 推送分支（`git push origin feature/xxx`）
5. 提交 Pull Request

提交格式遵循：`feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `style:` / `chore:`

## 许可证

本项目基于 MIT License 开源。
