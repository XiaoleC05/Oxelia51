# Oxelia51 生产部署

## 架构

```text
公网 Nginx (oxelia51.com, 阿里云 47.108.202.199)
  ├─ /        → /opt/Oxelia51/frontend/dist
  ├─ /api/    → 127.0.0.1:8080 (Oxelia51 Go)
  │              └─ /api/tools/:slug/proxy/* → 各工具内网端口
  └─ /webhook → 127.0.0.1:9000 (receiver.py)


内部工具 (均仅 loopback，通过 API 网关访问)：
  DormGuard   :8000  — Go+Gin，MySQL 独立
  SuperRead   :8002  — Go+Gin
  MusicBox    :8003  — Go+Gin
  CS2Lab      :8001  — Go+Gin
  AIHelper    :8004  — Go+Gin
  SecretStore :8006  — Go+Gin，AES-256-GCM
  AgentCanvas :8005  — Go+Gin


PostgreSQL / Redis — Docker 127.0.0.1


腾讯云 118.25.138.177 (4C4G, Ubuntu 24.04)：
  health-server :8090  — 系统健康数据采集 (CPU/内存/磁盘)
  ↑ 仅允许阿里云 IP 访问 (UFW)
  ↑ 阿里云管理后台通过 TENCENT_HEALTH_URL 定时拉取
```

## 服务器清单

| 服务器 | IP | 配置 | 角色 |
|--------|-----|------|------|
| 阿里云 | 47.108.202.199 | 2C2G | 主服务器，运行全部业务 |
| 腾讯云 | 118.25.138.177 | 4C4G | 健康检查，不部署业务工具 |

## 首次切换（在阿里云服务器上）

```bash
# 1. 依赖（若未装 Docker/Nginx）
sudo bash /opt/Oxelia51/deploy/bootstrap-server.sh

# 2. 部署 Oxelia51 发布包（GitHub Actions self-hosted 或手动 tar）
sudo bash /opt/Oxelia51/deploy/ci-deploy.sh /path/to/oxelia51-release.tar.gz
# 若 exit 2：编辑 /opt/Oxelia51/backend/.env 后重跑

# 3. 合并 DormGuard（网关模式 + Nginx 切换）
sudo bash /opt/Oxelia51/deploy/platform-cutover.sh
```

## backend/.env 必填

- `DB_PASSWORD` / `JWT_SECRET` / `ADMIN_INITIAL_PASSWORD`
- `APP_PUBLIC_URL=https://oxelia51.com`
- `LISTEN_ADDR=127.0.0.1:8080`
- `TENCENT_HEALTH_URL=http://118.25.138.177:8090/api/health`
- `TOOL_API_BASE_DORMGUARD=http://127.0.0.1:8000`

## 登录

- 平台管理者：`oxelia51` + `ADMIN_INITIAL_PASSWORD`
- DormGuard 旧 `root` 独立登录已废弃；业务经 `/tools/dormguard` + 平台 JWT

## 健康检查

```bash
/opt/Oxelia51/deploy/monitor/oxelia51-healthcheck.sh
/opt/DormGuard/deploy/monitor/dormguard-healthcheck.sh
```

## 腾讯云 health-server 部署

```bash
# 在腾讯云服务器上执行一次
sudo bash /opt/Oxelia51/deploy/tencent-cloud/init-server.sh
```

health-server 仅暴露系统资源指标（CPU/内存/磁盘），不包含业务数据。UFW 防火墙仅允许阿里云 IP 访问 8090 端口。

## GitHub Webhook 自动化部署

采用 **GitHub Actions 构建 + Webhook 触发服务器拉取** 架构，适配服务器无法访问 GitHub HTTPS(443) 但可 SSH(22) 的网络环境。

### 架构

```
git push master
    ↓ GitHub Actions 构建测试
build-test (GitHub-hosted)
    ↓ 交叉编译 + npm build + 打包 tarball
release (GitHub-hosted)
    ↓ 把 tarball force-push 到 release 分支
    ↓ 触发 GitHub webhook
GitHub ──HTTP POST──→ http://47.108.202.199/webhook (80端口，已开放)
                        ↓ nginx 转发到 127.0.0.1:9000
                    receiver.py 验证 HMAC-SHA256 签名
                        ↓
                    deploy.sh: git fetch release → 解压 → apply-release.sh
```

**服务器无需 Go/Node**——构建在 GitHub Actions 完成，服务器只拉取预编译 tarball。

### 服务器一次性安装

通过阿里云 Workbench 在服务器上执行：

```bash
# 1. 克隆仓库（用于 git fetch release 分支）
cd /opt
git clone git@github.com:XiaoleC05/Oxelia51.git Oxelia51-src

# 2. 部署 webhook 文件（若从 release 分支已有则跳过）
mkdir -p /opt/Oxelia51/deploy/webhook
cp /opt/Oxelia51-src/deploy/webhook/receiver.py /opt/Oxelia51/deploy/webhook/
cp /opt/Oxelia51-src/deploy/webhook/deploy.sh /opt/Oxelia51/deploy/webhook/
cp /opt/Oxelia51-src/deploy/webhook/oxelia51-webhook.service /opt/Oxelia51/deploy/webhook/
chmod +x /opt/Oxelia51/deploy/webhook/*.sh /opt/Oxelia51/deploy/webhook/*.py

# 3. 配置 webhook 密钥
cp /opt/Oxelia51/deploy/webhook/.env.example /opt/Oxelia51/deploy/webhook/.env
# 编辑 .env，把 CHANGE_ME_TO_RANDOM_SECRET 换成随机字符串（与 GitHub webhook Secret 一致）
openssl rand -hex 32  # 生成随机密钥
nano /opt/Oxelia51/deploy/webhook/.env

# 4. 安装 systemd 服务
cp /opt/Oxelia51/deploy/webhook/oxelia51-webhook.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable oxelia51-webhook
systemctl start oxelia51-webhook
systemctl status oxelia51-webhook

# 5. 更新 nginx 配置（添加 /webhook location）
cp /opt/Oxelia51-src/deploy/nginx/default-ip.conf /etc/nginx/sites-available/default-ip
nginx -t && systemctl reload nginx

# 6. 配置 SSH deploy key（让服务器能 git fetch 私有仓库）
ssh-keygen -t ed25519 -f /root/.ssh/oxelia51_deploy -N ""
cat /root/.ssh/oxelia51_deploy.pub
# 把公钥添加到 GitHub 仓库 Settings → Deploy keys（勾选 Allow write access 不需要）
```

### GitHub 仓库配置

1. **Webhook**：Settings → Webhooks → Add webhook
   - Payload URL: `http://47.108.202.199/webhook`
   - Content type: `application/json`
   - Secret: 与服务器 `.env` 中 `WEBHOOK_SECRET` 一致
   - Events: Just the `push` event
   - Active: ✓

2. **Deploy key**（若仓库私有）：Settings → Deploy keys → Add deploy key
   - Title: `oxelia51-prod`
   - Key: 服务器上 `cat /root/.ssh/oxelia51_deploy.pub` 的输出
   - Allow write access: ✗（只需读）

### 部署日志

```bash
tail -f /var/log/oxelia51-webhook-deploy.log
```

### 触发条件

- `push` 到 `master` → GitHub Actions 构建 → push tarball 到 `release` 分支 → webhook 触发服务器部署
- `pull_request` → 仅构建测试（不部署）
- `workflow_dispatch` → 手动触发构建 + 发布

### 并发控制

新 push 排队等待，不会取消正在运行的构建（cancel-in-progress: false）。服务器侧 deploy.sh 串行执行。
