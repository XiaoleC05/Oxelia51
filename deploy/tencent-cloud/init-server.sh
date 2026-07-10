#!/usr/bin/env bash
# =============================================
#  Oxelia51 腾讯云服务器初始化脚本
#  目标：Ubuntu 24.04 4C4G (118.25.138.177)
#  用途：分流工具部署 + Hermes 机器人
#  执行方式：通过腾讯云 OrcaTerm 粘贴执行
# =============================================
set -euo pipefail

ALIYUN_IP="47.108.202.199"
TENCENT_IP="118.25.138.177"
TOOLS_DIR="/opt/tools"
APP_DIR="/opt/Oxelia51"

echo "=========================================="
echo " Oxelia51 腾讯云服务器初始化"
echo " 目标: $TENCENT_IP (Ubuntu 24.04)"
echo "=========================================="

# ---- 1. 系统基础 ----
echo ""
echo "[1/8] 系统更新 + 基础依赖..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git unzip nginx \
  ca-certificates gnupg lsb-release \
  software-properties-common \
  ufw fail2ban

# ---- 2. Go 1.23 ----
echo ""
echo "[2/8] 安装 Go 1.23..."
if ! command -v go &>/dev/null; then
  GO_TAR="go1.23.4.linux-amd64.tar.gz"
  wget -q "https://go.dev/dl/$GO_TAR" -O "/tmp/$GO_TAR"
  rm -rf /usr/local/go
  tar -C /usr/local -xzf "/tmp/$GO_TAR"
  rm "/tmp/$GO_TAR"
  echo 'export PATH=$PATH:/usr/local/go/bin' > /etc/profile.d/go.sh
  export PATH=$PATH:/usr/local/go/bin
fi
go version

# ---- 3. Docker (PostgreSQL + Redis) ----
echo ""
echo "[3/8] 安装 Docker + Compose..."
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

# 等待 dockerd 就绪（systemctl enable --now 是异步的）
echo "    等待 Docker 就绪..."
for i in $(seq 1 30); do
  docker info >/dev/null 2>&1 && break
  sleep 1
done

# Docker Compose: PostgreSQL 17 + Redis 7
echo "    启动 PostgreSQL + Redis..."
mkdir -p /opt/docker
cat > /opt/docker/compose.yml <<'DOCKER_EOF'
services:
  postgres:
    image: postgres:17-alpine
    container_name: oxelia51-postgres
    restart: always
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: ${DB_PASSWORD:-Changeme_Oxelia51_2024}
      POSTGRES_DB: oxelia51
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U root -d oxelia51"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: oxelia51-redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD:-Changeme_Oxelia51_Redis}
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
DOCKER_EOF

cd /opt/docker && docker compose up -d

# ---- 4. 目录结构 ----
echo ""
echo "[4/8] 创建目录结构..."
mkdir -p "$TOOLS_DIR"/{superread,musicbox,aihelper,agentcanvas,secretstore,cs2lab}
mkdir -p "$TOOLS_DIR/releases"
mkdir -p "$APP_DIR"/{backend,frontend/dist,deploy/tencent-cloud}
mkdir -p /opt/hermes

# ---- 5. 防火墙 ----
echo ""
echo "[5/8] 配置防火墙 (仅允许阿里云 IP)..."

# UFW 基础规则
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# 仅允许阿里云 IP 访问工具端口 (8000-8099)
ufw allow from "$ALIYUN_IP" to any port 8000:8099 proto tcp comment 'Aliyun gateway'

ufw --force enable
ufw status verbose

# ---- 6. Nginx ----
echo ""
echo "[6/8] 配置 Nginx..."

cat > /etc/nginx/sites-available/tencent-tools <<'NGINX_EOF'
# 腾讯云 Nginx — 工具反向代理 + 健康检查
server {
    listen 80;
    server_name _;

    # 健康检查端点（供阿里云管理面板拉取）
    location /api/health {
        proxy_pass http://127.0.0.1:8090/api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        allow 47.108.202.199;   # 阿里云
        allow 127.0.0.1;
        deny all;
    }

    # 工具代理（仅阿里云可访问）
    location /tools/ {
        allow 47.108.202.199;
        deny all;
        # 各工具端口由阿里云 gateway 直连，此 location 为占位
        return 404;
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/tencent-tools /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ---- 7. fail2ban ----
echo ""
echo "[7/8] 配置 fail2ban..."

cat > /etc/fail2ban/jail.local <<'FAIL2BAN_EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
ignoreip = 127.0.0.1/8 47.108.202.199

[sshd]
enabled = true
port = 22

[nginx-http-auth]
enabled = true
FAIL2BAN_EOF

systemctl enable --now fail2ban

# ---- 8. Health Server 部署 ----
echo ""
echo "[8/8] 编译部署 Health Server..."

# 编译 health-server (在本地交叉编译后上传，或在此编译)
# 如果 Go 已装好，可以直接编译
HEALTH_DIR="$APP_DIR/deploy/tencent-cloud"
if [ -f "$HEALTH_DIR/health-server.go" ]; then
  cd "$HEALTH_DIR"
  go build -ldflags="-s -w" -o /opt/tools/health-server health-server.go
  chmod +x /opt/tools/health-server
fi

# systemd 服务
if [ -f "$HEALTH_DIR/systemd/health-server.service" ]; then
  cp "$HEALTH_DIR/systemd/health-server.service" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now health-server
fi

# ---- 完成 ----
echo ""
echo "=========================================="
echo " 腾讯云初始化完成！"
echo "=========================================="
echo ""
echo "后续步骤："
echo "  1. 上传工具二进制到 /opt/tools/"
echo "  2. 编辑 /opt/Oxelia51/backend/.env 配置数据库密码"
echo "  3. 部署 health-server: systemctl start health-server"
echo "  4. 从阿里云测试连通: curl http://$TENCENT_IP/api/health"
echo "  5. 修改 Docker 密码：编辑 /opt/docker/compose.yml"
echo "     更新 POSTGRES_PASSWORD 和 REDIS_PASSWORD"
echo "     然后执行 cd /opt/docker && docker compose up -d"
echo ""
echo "防火墙规则："
ufw status numbered
