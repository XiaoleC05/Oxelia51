# Oxelia51 生产部署（ADR-006 阶段 2）

## 架构

```text
公网 Nginx (oxelia51.com)
  ├─ /        → /opt/Oxelia51/frontend/dist
  └─ /api/    → 127.0.0.1:8080 (Oxelia51 Go)
                    └─ /api/tools/dormguard/proxy/* → 127.0.0.1:8000 (DormGuard, 网关模式)

DormGuard :8000  — 仅 loopback（MySQL 独立）
NoneBot  :8089  — 释放 8080 给平台
PostgreSQL/Redis — Docker 127.0.0.1
```

## 首次切换（在服务器上）

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
- `TOOL_API_BASE_DORMGUARD=http://127.0.0.1:8000`

## 登录

- 平台管理者：`oxelia51` + `ADMIN_INITIAL_PASSWORD`
- DormGuard 旧 `root` 独立登录已废弃；业务经 `/tools/dormguard` + 平台 JWT

## 健康检查

```bash
/opt/Oxelia51/deploy/monitor/oxelia51-healthcheck.sh
/opt/DormGuard/deploy/monitor/dormguard-healthcheck.sh
```

## GitHub Actions 自动化部署

`.github/workflows/deploy.yml` 在 push 到 `master` 时自动构建并部署到生产服务器。

### 需配置的 Repository Secrets

在 GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Secret 名 | 值 | 说明 |
|-----------|-----|------|
| `SSH_HOST` | `47.108.202.199` | 服务器公网 IP |
| `SSH_USER` | `root` | SSH 登录用户（需有 systemctl/nginx 权限） |
| `SSH_PRIVATE_KEY` | （私钥 PEM 全文） | SSH 私钥，公钥需在服务器 `~/.ssh/authorized_keys` |
| `SSH_PORT` | `22` | SSH 端口（可选，默认 22） |

### 流程

1. **Build & Test**：`go vet` + `go test` + 交叉编译 linux/amd64 二进制 + `npm ci` + `npm run build`
2. **Package**：按 `apply-release.sh` 期望结构打包 `oxelia51-release.tar.gz`
3. **Upload**：SCP 上传 tarball 到服务器 `/tmp/`
4. **Apply**：SSH 解压 + 执行 `apply-release.sh`（安装二进制/迁移/前端/systemd/nginx，重启服务）
5. **Health check**：`curl http://127.0.0.1:8080/api/health`

### 触发条件

- `push` 到 `master` → 构建 + 测试 + 部署
- `pull_request` → 仅构建 + 测试（不部署）
- `workflow_dispatch` → 手动触发构建 + 部署

### 并发控制

同一分支新 push 会取消旧的运行中 job，避免并发部署。

### 服务器 SSH 公钥配置

```bash
# 本地生成密钥对（若未生成）
ssh-keygen -t ed25519 -f ~/.ssh/oxelia51_ci -C "oxelia51-ci"

# 上传公钥到服务器
ssh-copy-id -i ~/.ssh/oxelia51_ci.pub root@47.108.202.199

# 将 ~/.ssh/oxelia51_ci 私钥全文粘贴到 GitHub Secret SSH_PRIVATE_KEY
```
