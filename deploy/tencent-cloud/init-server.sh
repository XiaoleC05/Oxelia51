#!/usr/bin/env bash
# =============================================
#  Oxelia51 腾讯云服务器初始化脚本
#  目标：Ubuntu 24.04 4C4G (118.25.138.177)
#  用途：分流工具部署 + Hermes 机器人
#  前提：工具二进制已通过 scp 上传到 /opt/tools/
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
echo "[1/5] 系统更新 + 基础依赖..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git unzip nginx \
  ca-certificates gnupg lsb-release \
  ufw fail2ban

# ---- 2. 目录结构 ----
echo ""
echo "[2/5] 创建目录结构..."
mkdir -p "$TOOLS_DIR"/{superread,musicbox,aihelper}
mkdir -p "$TOOLS_DIR/releases"
mkdir -p "$APP_DIR"/{backend,frontend/dist,deploy/tencent-cloud}
mkdir -p /opt/hermes

# ---- 3. 防火墙 ----
echo ""
echo "[3/5] 配置防火墙 (仅允许阿里云 IP)..."

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# 仅允许阿里云 IP 访问工具端口 (8000-8099)
ufw allow from "$ALIYUN_IP" to any port 8000:8099 proto tcp comment 'Aliyun gateway'

ufw --force enable
ufw status verbose

# ---- 4. Nginx ----
echo ""
echo "[4/5] 配置 Nginx..."

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
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/tencent-tools /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ---- 5. Health Server + 工具部署 ----
echo ""
echo "[5/5] 部署服务..."

# Health server（预编译二进制，已通过 scp 上传）
if [ -f "$TOOLS_DIR/health-server" ]; then
  cp "$TOOLS_DIR/health-server" /opt/tools/health-server
  chmod +x /opt/tools/health-server

  # systemd
  if [ -f /opt/tencent-cloud/systemd/health-server.service ]; then
    cp /opt/tencent-cloud/systemd/health-server.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable --now health-server
    echo "health-server deployed"
  fi
fi

# 工具 systemd 注册（二进制已上传到 /opt/tools/）
for name in superread musicbox aihelper; do
  if [ -f "$TOOLS_DIR/$name-server" ]; then
    mkdir -p "/opt/$name"
    cp "$TOOLS_DIR/$name-server" "/opt/$name/$name-server"
    chmod +x "/opt/$name/$name-server"

    cat > "/etc/systemd/system/$name.service" << UNIT
[Unit]
Description=$name Service
After=network.target

[Service]
Type=simple
ExecStart=/opt/$name/$name-server
Environment=DATABASE_URL=postgres://root:Changeme_Oxelia51_2024@localhost:5432/oxelia51?sslmode=disable
Environment=OXELIA_GATEWAY_MODE=true
Restart=always
RestartSec=5
MemoryMax=256M

[Install]
WantedBy=multi-user.target
UNIT
    systemctl daemon-reload
    systemctl enable --now "$name"
    echo "$name deployed: $(systemctl is-active $name)"
  else
    echo "WARNING: $name-server not found in $TOOLS_DIR, skipping"
  fi
done

# ---- 完成 ----
echo ""
echo "=========================================="
echo " 腾讯云初始化完成！"
echo "=========================================="
echo ""
echo "验证："
echo "  curl http://127.0.0.1:8090/api/health"
echo "  curl http://127.0.0.1:8002/api/health   # SuperRead"
echo "  curl http://127.0.0.1:8003/api/health   # MusicBox"
echo "  curl http://127.0.0.1:8004/api/health   # AIHelper"
echo ""
echo "防火墙规则："
ufw status numbered
