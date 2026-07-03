# Oxelia51 — 开发者工具综合平台

> 一个入口，访问全部开发者工具。统一账号，统一体验。

## 项目定位

Oxelia51 是一站式开发者工具平台。不同于零散的工具集合——用户在平台内注册一个账号，即可使用所有集成的在线工具。工具由平台前端统一渲染，后端通过 API 网关调用各工具服务，用户感受不到任何分离感。

## 平台架构

```
用户浏览器 → oxelia51.com
                ├── React 前端（统一渲染所有页面）
                ├── Go 后端（用户认证、工具注册、API 网关）
                ├── PostgreSQL（用户数据、工具元数据）
                └── Redis（会话缓存、任务队列）
                       │
                       ▼ 内网 API 转发
                ┌──────┼──────┬──────┐
             工具A   工具B   工具C   工具D
            (内网)   (内网)   (内网)   (内网)
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Go + Gin |
| 前端 | React (Vite) |
| 数据库 | PostgreSQL 17 |
| 缓存 | Redis 7 |
| 部署 | Docker Compose + Nginx |
| API 风格 | REST |

## 核心功能

| 模块 | 状态 | 说明 |
|------|------|------|
| 用户系统 | ✅ | 注册、登录、JWT 认证 |
| 工具目录 | ✅ | 工具列表、详情 |
| 管理后台 | 🔧 | 工具元数据管理 |
| 公共落地页 | ❌ | 平台介绍门户 |

## 集成的工具

| 工具 | 说明 | 在线 | 本地 |
|------|------|------|------|
| DormGuard | 宿舍电费监控 | 个人 | exe |
| MusicBox | 跨平台音乐聚合 | 个人 | exe |
| CS2Lab | CS2 道具教学 | 全部用户 | exe |
| SuperRead | RSS AI 简报 | 全部用户 | exe |
| AgentCanvas | Agent 可视化 | 全部用户 | exe |
| AIHelper | 提示词优化 | 全部用户 | exe |

## 使用方式

- **在线使用**：访问 [oxelia51.com](https://oxelia51.com) 注册登录
- **工具下载**：各工具 GitHub Releases 提供 exe 安装包

## 仓库可见性

平台仓库公开（只读）。如需贡献，请联系作者。

## 开发状态

阶段1（平台骨架）已完成。后续阶段待开发。

## 作者

**Xiaole Cheng（程）** — Go 全栈开发者。

- GitHub: [@XiaoleC05](https://github.com/XiaoleC05)
- 博客: [xiaolec05.github.io](https://xiaolec05.github.io)
