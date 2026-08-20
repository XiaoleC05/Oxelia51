# Oxelia51 生产部署

> **运维操作手册见 [RUNBOOK.md](RUNBOOK.md)**（exec API 操作技巧、五条部署管线实操、常见坑速查）。
> 服务器访问方式见下方 §服务器清单 与本地记忆 `server-access-topology`。

## 架构

```
用户
  │
  ▼
阿里云 Nginx (oxelia51.com, 47.108.202.199)
  ├─ /              → 127.0.0.1:3000 (Langfuse Web，SSH 隧道→腾讯云)
  ├─ /api/          → 127.0.0.1:8080 (管理后台 Go)
  │                    └─ /api/tools/:slug/proxy/* → 各工具内网端口
  ├─ /api/proxy/    → 127.0.0.1:9090 (Go 代理网关)  ← v3.0 新增
  ├─ /token/        → 127.0.0.1:3000 (Langfuse Web legacy 路径，同上隧道)  ← v3.0 新增
  └─ /webhook       → 127.0.0.1:9000 (receiver.py)
                         │
               ┌─────────┼──────────┐
               │                    │
          主平台 push         工具 repo push
          deploy.sh          tool-deploy.sh <tool>

腾讯云 (118.25.138.177, 4C4G, Ubuntu 24.04)
  ├─ Nginx :80         → Langfuse Web :3000
  ├─ Langfuse (Docker Compose, 6 容器)
  │   ├─ langfuse-web      :3000
  │   ├─ langfuse-worker   :3030
  │   ├─ langfuse-postgres :5434 (SmartKB 占 5433)
  │   ├─ langfuse-clickhouse :8123/9000
  │   ├─ langfuse-redis    :6379
  │   └─ langfuse-minio    :9090/9091
  └─ C++ 分析引擎 (systemd timer, 待部署)
```

## 服务器清单

| 服务器 | IP | 配置 | 角色 |
|--------|-----|------|------|
| 阿里云 | 47.108.202.199 | 2C2G | 主入口 + Nginx + 管理后台 + Go 代理 + Webhook |
| 腾讯云 | 118.25.138.177 | 4C4G | Langfuse 数据层 + ClickHouse + SmartKB + C++ 引擎 |

## 部署文件一览

```
deploy/
├── README.md                    ← 本文件
├── RUNBOOK.md                   ← 运维操作手册（exec API 技巧、五条部署管线）
├── apply-release.sh             ← 从 tarball 安装全新发布包
├── deploy-proxy.sh              ← Go 代理网关部署（阿里云）    v3.0
├── diagnose-all.sh              ← Oxelia51 ↔ DormGuard 全链路诊断
├── env.production.example       ← 后端生产环境变量模板
├── seed-tools.sql               ← 工具注册种子数据
├── docker/
│   └── compose.prod.yml         ← 阿里云 PostgreSQL + Redis
├── nginx/
│   ├── oxelia51.com.conf        ← 主站 Nginx（含 /api/ 与 /api/proxy/ 路由）
│   ├── default-ip.conf          ← IP 直连（/webhook、/uploads/、/api/ 反代）
│   └── snippets/
│       └── security-headers.conf ← 统一安全响应头片段
├── systemd/
│   ├── oxelia51-backend.service ← 管理后台
│   ├── oxelia51-data.service    ← 数据处理
│   ├── token-proxy.service      ← Go 代理网关                   v3.0
│   └── token-tunnel.service     ← SSH 隧道（阿里云 127.0.0.1:3000 → 腾讯云 web:3000）
├── tencent-cloud/
│   ├── init-server.sh           ← 腾讯云完整初始化
│   ├── docker-compose.langfuse.yml ← Langfuse 6 容器编排        v3.0
│   ├── .env.langfuse.example    ← Langfuse 环境变量模板          v3.0
│   ├── langfuse-deploy.sh       ← Langfuse 部署管理脚本          v3.0
│   ├── health-server.go         ← 健康检查服务源码（Go）
│   ├── health-server            ← 健康检查服务预编译二进制
│   └── systemd/
│       └── health-server.service ← 健康检查 systemd 单元
├── umami/
│   ├── README.md                ← Umami 自托管部署步骤（stats.oxelia51.com）
│   ├── docker-compose.umami.yml ← Umami + 独立 PostgreSQL
│   └── nginx-stats.conf         ← stats.oxelia51.com Nginx
├── webhook/
│   ├── receiver.py              ← Webhook HTTP 接收器（127.0.0.1:9000）
│   ├── deploy.sh                ← 主平台部署
│   ├── tool-deploy.sh           ← 工具自动部署
│   ├── oxelia51-webhook.service ← Webhook systemd 服务
│   ├── oxelia51-webhook.logrotate ← 部署日志轮转
│   └── .env.example             ← receiver 环境变量模板
└── monitor/
    └── oxelia51-healthcheck.sh  ← 定时健康检查
```

## v3.0 新增部署流程

### 1. 腾讯云 — Langfuse 数据层

```bash
# 首次：在腾讯云服务器上执行
cd /opt/Oxelia51/deploy/tencent-cloud
bash init-server.sh

# 安装 Langfuse
cd /opt/langfuse
bash langfuse-deploy.sh install
bash langfuse-deploy.sh start

# 验证
bash langfuse-deploy.sh status
# 预期：6 个容器全部 healthy，健康检查 ✅
```

### 2. 阿里云 — Go 代理网关

```bash
# 首次安装
bash /opt/Oxelia51/deploy/deploy-proxy.sh install

# 编译并部署（需 Go 二进制）
# 编辑 /opt/oxelia51/proxy/.env 填入 ClickHouse 密码
# 放置 proxy-server 到 /opt/oxelia51/proxy/
bash /opt/Oxelia51/deploy/deploy-proxy.sh deploy
```

### 3. 阿里云 — Nginx 更新

`/api/proxy/` 与 `/token/` 路由已内联在主 conf `deploy/nginx/oxelia51.com.conf` 中，
由 `apply-release.sh` 一并安装（不再有独立的 proxy-gateway.conf 片段）：

```bash
cp /opt/Oxelia51/deploy/nginx/oxelia51.com.conf /etc/nginx/sites-available/oxelia51.com
nginx -t && systemctl reload nginx
```

## 部署流程（自动）

```
git push master → deploy.yml 构建 release tarball → 创建 GitHub Release
                                                      ↓
                                      GitHub webhook（release published 事件）
                                                      ↓
                                      receiver.py（验证签名 + 按 repo 路由）
                                      ├── Oxelia51  → deploy.sh <tarball_url>
                                      │                 └─ 解压后调 apply-release.sh
                                      └── 工具 repo → tool-deploy.sh <name>
```

## 工具自动部署（各仓库独立 CI/CD）

3 个工具仓库各有自己的 `.github/workflows/deploy.yml`，push master 时自动：
1. `go vet` 检查
2. 交叉编译 linux/amd64 二进制
3. 打包 tarball 并 push 到本仓库的 `release` 分支
4. GitHub webhook 触发服务器 `tool-deploy.sh` 拉取并部署

各仓库: [DormGuard](https://github.com/XiaoleC05/DormGuard) · [SecretStore](https://github.com/XiaoleC05/SecretStore) · [SmartKB](https://github.com/XiaoleC05/SmartKB)

### GitHub Webhook 配置（每个工具仓库需配置一次）

每个工具仓库 → Settings → Webhooks → Add webhook：
- Payload URL: `http://47.108.202.199/webhook`
- Content type: `application/json`
- Secret: 与 Oxelia51 仓库的 webhook secret **相同**
- Events: Just the `push` event
- Active: ✓

## 健康检查

```bash
# 阿里云
/opt/Oxelia51/deploy/monitor/oxelia51-healthcheck.sh
curl http://127.0.0.1:9090/api/proxy/status    # Go 代理

# 腾讯云
cd /opt/langfuse && bash langfuse-deploy.sh status
```

## 回滚

```bash
# Langfuse（腾讯云）
cd /opt/langfuse
docker compose -f docker-compose.langfuse.yml --env-file .env -p langfuse down
# 恢复旧镜像标签后重启
docker compose -f docker-compose.langfuse.yml --env-file .env -p langfuse up -d

# Go 代理（阿里云）
# 替换为旧版二进制
systemctl restart token-proxy

# 主平台（阿里云）
cd /opt/Oxelia51-src
git checkout HEAD~1 -- oxelia51-release.tar.gz
tar xzf oxelia51-release.tar.gz -C /opt/Oxelia51/
systemctl restart oxelia51-backend
nginx -s reload
```

## 部署日志

```bash
# 主平台 + 所有工具的统一日志
tail -f /var/log/oxelia51-webhook-deploy.log

# Go 代理日志
journalctl -u token-proxy -n 100 -f

# Langfuse 日志
cd /opt/langfuse && bash langfuse-deploy.sh logs
```
