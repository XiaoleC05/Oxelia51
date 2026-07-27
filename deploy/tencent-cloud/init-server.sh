#!/usr/bin/env bash
# =============================================
#  Oxelia51 腾讯云服务器完整初始化
#  目标：Ubuntu 24.04 4C4G (118.25.138.177)
#  内容：基础安全 + Docker + Langfuse 数据层
# =============================================
set -euo pipefail

ALIYUN_IP="47.108.202.199"

echo "=========================================="
echo " Oxelia51 v3.0 腾讯云初始化"
echo " 目标: Ubuntu 24.04 (118.25.138.177)"
echo "=========================================="

# ---- 1. 系统更新 ----
echo ""
echo "[1/7] 系统更新..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# ---- 2. 基础工具 ----
echo ""
echo "[2/7] 安装基础工具..."
apt-get install -y -qq curl wget git ufw nginx certbot python3-certbot-nginx

# ---- 3. 防火墙 ----
echo ""
echo "[3/7] 配置防火墙..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# 仅允许阿里云访问内部服务端口
ufw allow from "$ALIYUN_IP" to any port 3000 proto tcp comment 'Langfuse Web (Aliyun proxy)'
ufw allow from "$ALIYUN_IP" to any port 9000 proto tcp comment 'ClickHouse Native (Aliyun proxy)'

ufw --force enable
ufw status verbose

# ---- 4. Docker（若未安装）----
echo ""
echo "[4/7] 检查 Docker..."
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | bash
fi
docker --version

# Docker Compose 插件
if ! docker compose version &>/dev/null 2>&1; then
    echo "安装 Docker Compose 插件..."
    mkdir -p /usr/local/lib/docker/cli-plugins
    ARCH=$(uname -m)
    [ "$ARCH" = "x86_64" ] && ARCH="x86_64"
    curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${ARCH}" \
        -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi
docker compose version

# ---- 5. Nginx ----
echo ""
echo "[5/7] 配置 Nginx..."
cat > /etc/nginx/sites-available/langfuse << 'NGINX'
# Langfuse Web — 腾讯云本地反向代理
# 对外通过阿里云 Nginx 访问（见 oxelia51.com.conf）
server {
    listen 80;
    server_name _;

    # Langfuse Web
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
        client_max_body_size 50m;
    }

    # 健康检查（仅本地）
    location /health {
        proxy_pass http://127.0.0.1:3000/api/public/health;
        allow 127.0.0.1;
        allow 47.108.202.199;
        deny all;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/langfuse /etc/nginx/sites-enabled/langfuse
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable --now nginx

# ---- 6. 目录结构 ----
echo ""
echo "[6/7] 创建目录结构..."
mkdir -p /opt/langfuse
mkdir -p /opt/oxelia51/deploy/tencent-cloud
mkdir -p /opt/oxelia51/deploy/monitor
mkdir -p /opt/oxelia51/analytics

# ---- 7. Langfuse 部署文件 ----
echo ""
echo "[7/7] Langfuse 部署文件..."
# 从 Oxelia51 仓库复制 compose 文件
if [ -f /opt/Oxelia51/deploy/tencent-cloud/docker-compose.langfuse.yml ]; then
    cp /opt/Oxelia51/deploy/tencent-cloud/docker-compose.langfuse.yml /opt/langfuse/
    cp /opt/Oxelia51/deploy/tencent-cloud/langfuse-deploy.sh /opt/langfuse/
    chmod +x /opt/langfuse/langfuse-deploy.sh
    echo "  compose 文件已就位 → /opt/langfuse/"
    echo ""
    echo "  下一步: cd /opt/langfuse && bash langfuse-deploy.sh install"
else
    echo "  ⚠ 未找到 compose 文件，请先部署 Oxelia51 平台"
    echo "  或手动复制: scp deploy/tencent-cloud/docker-compose.langfuse.yml root@118.25.138.177:/opt/langfuse/"
fi

# ---- 完成 ----
echo ""
echo "=========================================="
echo " 腾讯云初始化完成"
echo "=========================================="
echo ""
echo "服务器角色: Langfuse 数据层 + SmartKB + C++ 分析引擎"
echo ""
echo "端口清单:"
echo "  80      → Nginx → Langfuse Web (:3000)"
echo "  3000    → Langfuse Web (仅阿里云 IP)"
echo "  9000    → ClickHouse Native (仅阿里云 IP)"
echo "  5433    → Langfuse PostgreSQL (loopback)"
echo "  6379    → Langfuse Redis (loopback)"
echo "  8123    → ClickHouse HTTP (loopback)"
echo "  9090    → MinIO S3 (loopback)"
echo ""
echo "下一步: 部署 Langfuse"
echo "  cd /opt/langfuse"
echo "  bash langfuse-deploy.sh install"
echo "  bash langfuse-deploy.sh start"
