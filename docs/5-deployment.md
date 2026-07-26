# 自动化部署

**项目**：oxelia51.com | **版本**：3.0.0 | **日期**：2026-07-27

---

## 1. 部署架构

```
git push master
      │
      ▼
GitHub Actions (临时 Ubuntu 虚拟机, 4C16G)
  1. go vet ./...
  2. go test ./...
  3. go build → oxelia51-server (Linux/amd64)
  4. npm ci && npm run build → dist/
  5. tar czf oxelia51-release.tar.gz
  6. git push --force → release 分支
  7. GitHub 发送 Webhook POST 到服务器
      │
      ▼
阿里云服务器 Webhook 接收器 (receiver.py, :9000)
  1. 验证 HMAC-SHA256 签名
  2. 判断仓库 → 路由到对应部署脚本
  3. 调用 deploy.sh（主平台）/ tool-deploy.sh（工具）
      │
      ▼
deploy.sh
  1. git pull origin release
  2. tar xzf oxelia51-release.tar.gz
  3. 复制二进制 → /opt/oxelia51/
  4. 复制前端 → /opt/Oxelia51/frontend/dist/
  5. 复制部署脚本 → /opt/Oxelia51/deploy/
  6. systemctl restart oxelia51-backend
  7. 健康检查 curl /api/health
```

---

## 2. GitHub Actions — CI/CD

### 2.1 配置文件

文件：`.github/workflows/deploy.yml`

```yaml
name: Build and Deploy

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
  workflow_dispatch:

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  # ===== Job 1: 构建与测试 =====
  build-test:
    name: Build & Test
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
          cache-dependency-path: backend/go.sum

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Backend vet
        working-directory: backend
        run: go vet ./...

      - name: Backend test
        working-directory: backend
        run: go test -v -count=1 ./...

      - name: Backend cross-compile (linux/amd64)
        working-directory: backend
        run: |
          mkdir -p ../release/backend
          GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build \
            -ldflags="-s -w" -o ../release/backend/oxelia51-server ./cmd/server
          cp -r migrations ../release/backend/migrations

      - name: Frontend install + build
        working-directory: frontend
        run: |
          npm ci
          npm run build
          cp -r dist ../release/frontend-dist

      - name: Stage deploy scripts
        run: cp -r deploy release/deploy

      - name: Verify release structure
        run: |
          test -f release/backend/oxelia51-server
          test -f release/backend/migrations/003_auth_v11.up.sql
          test -f release/deploy/apply-release.sh
          test -d release/frontend-dist

      - name: Package release tarball
        run: tar czf oxelia51-release.tar.gz -C release .

      - name: Upload tarball artifact
        uses: actions/upload-artifact@v4
        with:
          name: oxelia-release
          path: oxelia51-release.tar.gz
          retention-days: 7

  # ===== Job 2: 发布到 release 分支 =====
  release:
    name: Push tarball to release branch
    needs: build-test
    if: >-
      (github.event_name == 'push' && github.ref == 'refs/heads/master') ||
      github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: oxelia-release }

      - name: Push tarball to release branch
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"
          git remote set-url origin \
            "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
          git checkout --orphan release-tmp
          git rm -rf . 2>/dev/null || true
          git add oxelia51-release.tar.gz
          git commit -m "release: ${GITHUB_SHA::7}"
          git push origin "release-tmp:release" --force
```

### 2.2 触发条件

| 事件 | 行为 |
|------|------|
| `push` 到 `master` | 构建 + 测试 + 发布 tarball + 覆盖 release 分支 |
| `pull_request` 到 `master` | 仅构建 + 测试（不发布） |
| `workflow_dispatch` | 手动触发（在 GitHub 网页点按钮），与 push 行为一致 |

---

## 3. 服务器 Webhook + 部署脚本

### 3.1 receiver.py

服务器上 `/opt/Oxelia51/deploy/webhook/receiver.py`，systemd 管理：

```python
# 关键逻辑（简化）
SECRET = os.environ["WEBHOOK_SECRET"].encode()
TRIGGER_REF = "refs/heads/release"

TOOL_REPOS = {
    "XiaoleC05/DormGuard":   "dormguard",
    "XiaoleC05/SecretStore": "secretstore",
}

def do_POST(self):
    body = self.rfile.read(int(self.headers["Content-Length"]))
    sig = self.headers.get("X-Hub-Signature-256", "")

    # HMAC-SHA256 验证
    expected = "sha256=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return self._respond(403, b"invalid signature")

    payload = json.loads(body)
    if payload.get("ref") != TRIGGER_REF:
        return self._respond(200, b"ignored: not release branch")

    repo = payload["repository"]["full_name"]
    if repo == "XiaoleC05/Oxelia51":
        trigger_deploy(DEPLOY_SCRIPT)
    elif repo in TOOL_REPOS:
        trigger_deploy(TOOL_DEPLOY_SCRIPT, TOOL_REPOS[repo], repo)
```

### 3.2 deploy.sh

```bash
#!/bin/bash
set -euo pipefail

WORK="${1:-/opt/Oxelia51-src}"
APP_DIR="/opt/Oxelia51"

cd "$WORK"
git fetch origin release
git checkout release

# 解压 tarball
tar xzf oxelia51-release.tar.gz -C "$APP_DIR"

# 复制二进制
cp "$APP_DIR/backend/oxelia51-server" "$APP_DIR/oxelia51-server"
chmod +x "$APP_DIR/oxelia51-server"

# 复制前端
rm -rf /opt/Oxelia51/frontend/dist
cp -r "$APP_DIR/frontend-dist" /opt/Oxelia51/frontend/dist

# 迁移
cp -r "$APP_DIR/backend/migrations" "$APP_DIR/migrations"

# Nginx
cp "$APP_DIR/deploy/nginx/default-ip.conf" /etc/nginx/sites-available/default-ip
ln -sf /etc/nginx/sites-available/default-ip /etc/nginx/sites-enabled/default-ip

# systemd
cp "$APP_DIR/deploy/systemd/oxelia51-backend.service" /etc/systemd/system/
cp "$APP_DIR/deploy/systemd/oxelia51-data.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable oxelia51-backend oxelia51-data
systemctl restart oxelia51-backend
nginx -s reload

# 健康检查
bash "$APP_DIR/deploy/monitor/oxelia51-healthcheck.sh"
```

### 3.3 首次安装（服务器）

```bash
# 1. 创建源码目录并初始化 Git
mkdir -p /opt/Oxelia51-src
cd /opt/Oxelia51-src
git init
git remote add origin git@github.com:XiaoleC05/Oxelia51.git

# 2. 配置 Git 强制使用 SSH
git config --global url."git@github.com:".insteadOf "https://github.com/"

# 3. 生成 SSH Key 并添加到 GitHub Deploy Keys
ssh-keygen -t ed25519 -f ~/.ssh/oxelia51_deploy -N ""
cat ~/.ssh/oxelia51_deploy.pub
# → 添加到 https://github.com/XiaoleC05/Oxelia51/settings/keys

# 4. 安装 receiver.py 及 systemd 服务
cp /opt/Oxelia51-src/deploy/webhook/receiver.py /opt/Oxelia51/deploy/webhook/
cp /opt/Oxelia51-src/deploy/webhook/*.service /etc/systemd/system/
cp /opt/Oxelia51-src/deploy/webhook/*.logrotate /etc/logrotate.d/
systemctl daemon-reload
systemctl enable --now oxelia51-webhook

# 5. 配置 Webhook 密钥
openssl rand -hex 32
# → 填入 /opt/Oxelia51/deploy/webhook/.env 的 WEBHOOK_SECRET
# → 同时填入 GitHub Webhook Settings

# 6. Nginx
cp /opt/Oxelia51-src/deploy/nginx/oxelia51.com.conf /etc/nginx/sites-available/
ln -sf /etc/nginx/sites-available/oxelia51.com.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 4. 自部署版（给用户）

### 4.1 Docker Compose 一键部署

```bash
git clone https://github.com/XiaoleC05/Oxelia51.git
cd Oxelia51/deploy

# 生成密钥
SALT=$(openssl rand -hex 16)
ENCRYPTION_KEY=$(openssl rand -hex 32)
NEXTAUTH_SECRET=$(openssl rand -hex 32)

# 创建 .env
cat > .env << EOF
POSTGRES_PASSWORD=$(openssl rand -hex 16)
CLICKHOUSE_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=$(openssl rand -hex 16)
MINIO_PASSWORD=$(openssl rand -hex 16)
SALT=$SALT
ENCRYPTION_KEY=$ENCRYPTION_KEY
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
NEXTAUTH_URL=http://localhost:3000
EOF

docker compose up -d
# 浏览器打开 http://localhost:3000
```

### 4.2 Binary + systemd 自部署（仅 Go 代理）

```bash
cd Oxelia51/proxy-gateway
go build -o proxy-server ./cmd/proxy/

sudo cp proxy-server /opt/oxelia51/proxy-server
sudo cp deploy/token-proxy.service /etc/systemd/system/

# 配置环境变量
cat > /opt/oxelia51/.env << EOF
PROXY_PORT=9090
CLICKHOUSE_ADDR=<your-clickhouse-host>:9000
CLICKHOUSE_USER=clickhouse
CLICKHOUSE_PASSWORD=<your-password>
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now token-proxy
```

---

## 5. 回滚

```bash
# 回滚到上一个 release tarball
cd /opt/Oxelia51-src
git fetch origin release
LAST_COMMIT=$(git log -1 --format="%H")
git checkout "${LAST_COMMIT}~1" -- oxelia51-release.tar.gz
tar xzf oxelia51-release.tar.gz -C /opt/Oxelia51/
systemctl restart oxelia51-backend
nginx -s reload

# 回滚 Docker Compose（Langfuse）
cd /opt/oxelia51/deploy
docker compose down
# 恢复旧镜像标签
docker compose up -d
```

---

## 6. 密钥管理

| 密钥 | 位置 | 生成方式 | 轮换周期 |
|------|------|------|:--:|
| WEBHOOK_SECRET | 服务器 `/opt/Oxelia51/deploy/webhook/.env` + GitHub Webhook Settings | `openssl rand -hex 32` | 每季度 |
| JWT_SECRET | 服务器 `/opt/oxelia51/.env` | `openssl rand -hex 32` | 每季度 |
| SALT / ENCRYPTION_KEY | Docker Compose `.env` | `openssl rand -hex 32` | 每半年 |
| PostgreSQL / ClickHouse 密码 | Docker Compose `.env` | `openssl rand -hex 16` | 每半年 |
| SSH Deploy Key | 服务器 `~/.ssh/oxelia51_deploy` | `ssh-keygen -t ed25519` | 每年 |
| SSL 证书 | `/etc/letsencrypt/` | certbot-auto-renew | 90 天自动续期 |
