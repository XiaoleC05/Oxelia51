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

`.github/workflows/deploy.yml` 使用 **self-hosted runner**（生产服务器本身）部署，无需开放公网 22 端口，无需在 GitHub Secrets 存放 SSH 私钥。

### 架构

```
build-test (GitHub-hosted ubuntu-latest)
  ├ checkout + go vet/test + 交叉编译 linux/amd64
  ├ npm ci + npm run build
  ├ 打包 oxelia51-release.tar.gz
  └ upload-artifact
                    ↓ artifact 传递
deploy (self-hosted = 47.108.202.199)
  ├ download-artifact
  ├ 解压 + 执行 apply-release.sh（本地，无需 SSH）
  └ curl http://127.0.0.1:8080/api/health
```

### Self-hosted Runner 安装（一次性，在服务器上执行）

在 GitHub 仓库 → **Settings** → **Actions** → **Runners** → **New self-hosted runner** → 选择 Linux x64，按页面提示执行：

```bash
# 在服务器 47.108.202.199 上以 root 执行
mkdir -p /opt/actions-runner && cd /opt/actions-runner

# 下载最新 runner（URL 从 GitHub 页面复制，下面是示例）
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/download/v2.317.0/actions-runner-linux-x64-2.317.0.tar.gz
tar xzf actions-runner-linux-x64.tar.gz

# 配置（TOKEN 从 GitHub 页面复制）
./config.sh --url https://github.com/XiaoleC05/Oxelia51 --token <TOKEN> --name oxelia51-prod --labels self-hosted,linux

# 安装为 systemd 服务并启动
./svc.sh install root
./svc.sh start
```

### Runner 要求

- 以 **root** 运行（需要 systemctl / nginx / 写 /opt/Oxelia51 权限）
- 需安装：`tar`、`bash`、`curl`、`systemctl`、`nginx`（服务器已具备）
- **无需** Go/Node（构建在 GitHub-hosted runner 完成）

### 触发条件

- `push` 到 `master` → 构建 + 测试 + 部署
- `pull_request` → 仅构建 + 测试（不部署）
- `workflow_dispatch` → 手动触发构建 + 部署

### 并发控制

同一分支新 push 会取消旧的运行中 job，避免并发部署。

### 维护

- Runner 自动更新（GitHub 推送新版本时）
- 查看 runner 状态：GitHub 仓库 → Settings → Actions → Runners
- 服务管理：`systemctl status actions.runner.*`
