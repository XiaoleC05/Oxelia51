# Oxelia51 部署环境速查

用途：架构智能体（Codex）在处理服务器/部署相关任务时必读。

---

## 1. 工作流

```
本地开发 -> git push GitHub -> 服务器 git pull -> 重启服务
```

> 22 端口不对外暴露，所有服务器操作通过阿里云 Workbench 执行指令。

---

## 2. 服务器

| 项目 | 值 |
|------|-----|
| IP | 47.108.202.199 |
| 系统 | Ubuntu 22.04 |
| 配置 | 2核2G 40GB |
| 密钥 | ~/.ssh/id_ed25519_aliyun |
| SSH | 22 端口不对外暴露 |

---

## 3. Oxelia51 平台

| 项目 | 值 |
|------|-----|
| 路径 | /opt/Oxelia51 |
| 后端 | Go+Gin，systemd 管理 |
| 前端 | React+Vite |
| 数据库 | PostgreSQL 17 (Docker) |
| 缓存 | Redis 7 (Docker) |

---

## 4. DormGuard 工具

| 项目 | 值 |
|------|-----|
| 仓库 | github.com/XiaoleC05/DormGuard |
| 路径 | /opt/DormGuard（已部署） |
| 后端 | Go+Gin (端口 8000)，systemd: dormguard.service（2026-07-11 从 Python 切换） |
| QQ Bot | 已停用（dormguard-nonebot，Python 旧版） |
| 数据库 | MySQL（独立） |
| Gateway | TOOL_API_BASE_DORMGUARD=http://127.0.0.1:8000 |

---

## 5. 腾讯云服务器

| 项目 | 值 |
|------|-----|
| IP | 118.25.138.177 |
| 系统 | Ubuntu 24.04 |
| 配置 | 4核4G 40GB |
| 用途 | 分流工具部署（SuperRead, MusicBox, AIHelper）+ Hermes 机器人 |
| SSH | 阿里云通过 tencent_cloud 密钥访问 |
| 工具端口 | 8002-8004（UFW 仅允许阿里云 IP） |
| 部署方式 | 本地交叉编译 → scp 二进制 → systemd |

---

## 6. 已配置的环境变量（勿重复询问）

- CRAWLER_OPENID
- CRAWLER_JSESSIONID
- CRAWLER_ROOM_ID
- QQ_BOT_ID=1270667498
- QQ_BOT_GROUP_ID=6011223303

---

## 7. 相关文档

- docs/07-项目定位摘要.md
- docs/api/tool-registration.md
- deploy/README.md — 部署架构与 Webhook 配置
- deploy/tencent-cloud/ — 腾讯云初始化套件
