# Oxelia51 生产部署

## 架构

```text
公网 Nginx (oxelia51.com, 阿里云 47.108.202.199)
  ├─ /        → /opt/Oxelia51/frontend/dist
  ├─ /api/    → 127.0.0.1:8080 (Oxelia51 Go)
  │              └─ /api/tools/:slug/proxy/* → 各工具内网端口
  └─ /webhook → 127.0.0.1:9000 (receiver.py)
                   │
         ┌─────────┼──────────┐
         │                    │
    主平台 push         工具 repo push
    deploy.sh          tool-deploy.sh <tool>
```

内部工具 (均仅 loopback，通过 API 网关访问)：
  DormGuard   :8000  — Go+Gin，MySQL 独立
  SuperRead   :8002  — Go+Gin
  AIHelper    :8004  — Go+Gin
  AgentCanvas :8005  — Go+Gin
  SecretStore :8006  — Go+Gin，AES-256-GCM

SmartKB :8007  — Go+Gin，腾讯云 118.25.138.177
  ↑ Ollama qwen2.5:1.5b 本地推理，零 Token 费

PostgreSQL / Redis — Docker 127.0.0.1

腾讯云 118.25.138.177 (4C4G, Ubuntu 24.04)：
  health-server :8090  — 系统健康数据采集 (CPU/内存/磁盘)
  ↑ 仅允许阿里云 IP 访问 (UFW)

## 服务器清单

| 服务器 | IP | 配置 | 角色 |
|--------|-----|------|------|
| 阿里云 | 47.108.202.199 | 2C2G | 主服务器，运行全部业务 |
| 腾讯云 | 118.25.138.177 | 4C4G | 健康检查，不部署业务工具 |

## 部署流程

```
git push master → GitHub Actions 构建 → push tarball 到 release 分支
                                         ↓
                                    GitHub webhook
                                         ↓
                                    receiver.py (验证签名 + 路由)
                                    ├── Oxelia51 → deploy.sh
                                    └── 工具 repo → tool-deploy.sh <name>
```

## 工具自动部署（各仓库独立 CI/CD）

7 个工具仓库各有自己的 `.github/workflows/deploy.yml`，push master 时自动：
1. `go vet` 检查
2. 交叉编译 linux/amd64 二进制
3. 打包 tarball 并 push 到本仓库的 `release` 分支
4. GitHub webhook 触发服务器 `tool-deploy.sh` 拉取并部署

各仓库: [DormGuard](https://github.com/XiaoleC05/DormGuard) · [SuperRead](https://github.com/XiaoleC05/SuperRead) · [AIHelper](https://github.com/XiaoleC05/AIHelper) · [AgentCanvas](https://github.com/XiaoleC05/AgentCanvas) · [SecretStore](https://github.com/XiaoleC05/SecretStore) · [SmartKB](https://github.com/XiaoleC05/SmartKB)

### GitHub Webhook 配置（每个工具仓库需配置一次）

每个工具仓库 → Settings → Webhooks → Add webhook：
- Payload URL: `http://47.108.202.199/webhook`
- Content type: `application/json`
- Secret: 与 Oxelia51 仓库的 webhook secret **相同**
- Events: Just the `push` event
- Active: ✓

## 首次切换（在阿里云服务器上）

```bash
# 1. 依赖（若未装 Docker/Nginx）
sudo bash /opt/Oxelia51/deploy/bootstrap-server.sh

# 2. 部署 Oxelia51 发布包
sudo bash /opt/Oxelia51/deploy/ci-deploy.sh /path/to/oxelia51-release.tar.gz

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
- DormGuard 旧 `root` 独立登录已废弃

## 健康检查

```bash
/opt/Oxelia51/deploy/monitor/oxelia51-healthcheck.sh
/opt/DormGuard/deploy/monitor/dormguard-healthcheck.sh
```

## 腾讯云 health-server 部署

```bash
sudo bash /opt/Oxelia51/deploy/tencent-cloud/init-server.sh
```

## Webhook 接收器部署

### 首次安装

```bash
cd /opt
git clone git@github.com:XiaoleC05/Oxelia51.git Oxelia51-src

mkdir -p /opt/Oxelia51/deploy/webhook
cp /opt/Oxelia51-src/deploy/webhook/receiver.py /opt/Oxelia51/deploy/webhook/
cp /opt/Oxelia51-src/deploy/webhook/deploy.sh /opt/Oxelia51/deploy/webhook/
cp /opt/Oxelia51-src/deploy/webhook/tool-deploy.sh /opt/Oxelia51/deploy/webhook/
cp /opt/Oxelia51-src/deploy/webhook/oxelia51-webhook.service /opt/Oxelia51/deploy/webhook/
chmod +x /opt/Oxelia51/deploy/webhook/*.sh /opt/Oxelia51/deploy/webhook/*.py

# 配置 webhook 密钥
cp /opt/Oxelia51/deploy/webhook/.env.example /opt/Oxelia51/deploy/webhook/.env
openssl rand -hex 32  # 生成随机密钥，填入 .env
nano /opt/Oxelia51/deploy/webhook/.env

# 安装 systemd 服务
sudo cp /opt/Oxelia51/deploy/webhook/oxelia51-webhook.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now oxelia51-webhook

# 更新 nginx 配置
sudo cp /opt/Oxelia51-src/deploy/nginx/default-ip.conf /etc/nginx/sites-available/default-ip
sudo nginx -t && sudo systemctl reload nginx

# 配置 SSH deploy key（服务器拉取 GitHub release 分支用）
ssh-keygen -t ed25519 -f /root/.ssh/oxelia51_deploy -N ""
cat /root/.ssh/oxelia51_deploy.pub
# 把公钥添加为 GitHub Deploy key
```

### 更新（平台自动部署会更新 receiver.py 和脚本）

```bash
# 平台部署后需要手动重启 webhook 服务以加载新代码：
sudo systemctl restart oxelia51-webhook
```

## 部署日志

```bash
# 主平台 + 所有工具的统一日志
tail -f /var/log/oxelia51-webhook-deploy.log
```

## 触发条件

- `push` 到各仓库的 `master` → GitHub Actions 构建 → push tarball 到 `release` 分支 → webhook 触发
- `pull_request` → 仅构建测试
- `workflow_dispatch` → 手动触发
