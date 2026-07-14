# Oxelia51 部署指南

## 服务器

| 服务器 | IP | 配置 | 角色 |
|--------|-----|------|------|
| 阿里云 | 47.108.202.199 | 2C2G 40GB Ubuntu 22.04 | 主服务器，运行全部业务 |
| 腾讯云 | 118.25.138.177 | 4C4G Ubuntu 24.04 | 健康检查，不部署业务工具 |

> 22 端口不对外暴露，所有服务器操作通过阿里云 Workbench 执行指令。

## 架构

```text
公网 Nginx (oxelia51.com, 阿里云)
  ├─ /        → /opt/Oxelia51/frontend/dist
  ├─ /api/    → 127.0.0.1:8080 (Oxelia51 Go)
  │              └─ /api/tools/:slug/proxy/* → 各工具内网端口
  └─ /webhook → 127.0.0.1:9000 (receiver.py)
```

内部工具 (均仅 loopback，通过 API 网关访问)：

| 工具 | 端口 | 技术栈 |
|------|------|--------|
| DormGuard | :8000 | Go+Gin, MySQL 独立 |
| CS2Lab | :8001 | Go+Gin |
| SuperRead | :8002 | Go+Gin |
| MusicBox | :8003 | Go+Gin |
| AIHelper | :8004 | Go+Gin |
| AgentCanvas | :8005 | Go+Gin |
| SecretStore | :8006 | Go+Gin, AES-256-GCM |
| SmartKB | :8007 | Go+Gin, pgvector |

PostgreSQL / Redis — Docker 127.0.0.1

## 部署流程

```text
git push master → GitHub Actions 构建 → push tarball 到 release 分支
                                         ↓
                                    GitHub webhook
                                         ↓
                                    receiver.py (验证签名 + 路由)
                                    ├── Oxelia51 → deploy.sh
                                    └── 工具 repo → tool-deploy.sh <name>
```

## 快速部署

### 1. 首次初始化

```bash
# 依赖（Docker + Nginx）
sudo bash /opt/Oxelia51/deploy/bootstrap-server.sh

# 部署 Oxelia51 发布包
sudo bash /opt/Oxelia51/deploy/ci-deploy.sh /path/to/oxelia51-release.tar.gz

# Nginx 配置切换
sudo bash /opt/Oxelia51/deploy/platform-cutover.sh
```

### 2. 配置环境变量

`backend/.env` 必填：

| 变量 | 说明 |
|------|------|
| `DB_PASSWORD` | PostgreSQL 密码 |
| `JWT_SECRET` | JWT 签名密钥（≥16 字符） |
| `ADMIN_INITIAL_PASSWORD` | 管理员初始密码 |
| `APP_PUBLIC_URL` | `https://oxelia51.com` |
| `LISTEN_ADDR` | `127.0.0.1:8080` |
| `TENCENT_HEALTH_URL` | `http://118.25.138.177:8090/api/health` |
| `TOOL_API_BASE_DORMGUARD` | `http://127.0.0.1:8000` |

### 3. Webhook 自动部署

```bash
cd /opt; git clone git@github.com:XiaoleC05/Oxelia51.git Oxelia51-src

# 安装 receiver.py + 脚本
cp /opt/Oxelia51-src/deploy/webhook/* /opt/Oxelia51/deploy/webhook/
chmod +x /opt/Oxelia51/deploy/webhook/*.sh /opt/Oxelia51/deploy/webhook/*.py

# 配置密钥
openssl rand -hex 32 > /opt/Oxelia51/deploy/webhook/.env
# 编辑 .env，设置 WEBHOOK_SECRET=<生成的密钥>

# 安装 systemd 服务
sudo cp /opt/Oxelia51/deploy/webhook/oxelia51-webhook.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now oxelia51-webhook

# 更新 Nginx
sudo cp /opt/Oxelia51-src/deploy/nginx/default-ip.conf /etc/nginx/sites-available/default-ip
sudo nginx -t && sudo systemctl reload nginx

# SSH deploy key（拉取 GitHub release 用）
ssh-keygen -t ed25519 -f /root/.ssh/oxelia51_deploy -N ""
# 将公钥添加到 GitHub Deploy key
```

### 4. 腾讯云 health-server

```bash
sudo bash /opt/Oxelia51/deploy/tencent-cloud/init-server.sh
```

## 各工具独立 CI/CD

8 个工具仓库各有独立的 `.github/workflows/deploy.yml`，push master 时自动：

1. `go vet` 检查
2. 交叉编译 linux/amd64 二进制
3. 打包 tarball 并 push 到本仓库 `release` 分支
4. GitHub webhook 触发服务器 `tool-deploy.sh` 拉取并部署

**Webhook 配置**（每个工具仓库）：Settings → Webhooks → Payload URL `http://47.108.202.199/webhook`，Secret 与 Oxelia51 相同，事件选 `push`。

## 健康检查

```bash
/opt/Oxelia51/deploy/monitor/oxelia51-healthcheck.sh
/opt/DormGuard/deploy/monitor/dormguard-healthcheck.sh
```

## 日志

```bash
# 主平台 + 所有工具统一部署日志
tail -f /var/log/oxelia51-webhook-deploy.log
```

## 登录

- 平台管理员：`oxelia51` + `ADMIN_INITIAL_PASSWORD`
- DormGuard 旧 `root` 独立登录已废弃

## 更新 webhook 代码

```bash
sudo systemctl restart oxelia51-webhook
```