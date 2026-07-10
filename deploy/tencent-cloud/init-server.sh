#!/usr/bin/env bash
# =============================================
#  Oxelia51 腾讯云服务器连通与基础安全
#  目标：Ubuntu 24.04 4C4G (118.25.138.177)
#  用途：SSH 连通 + UFW 防火墙 — 仅权限与连通
#  工具分流部署另见 deploy-all-tools.sh（未来）
# =============================================
set -euo pipefail

ALIYUN_IP="47.108.202.199"
TENCENT_IP="118.25.138.177"

echo "=========================================="
echo " Oxelia51 腾讯云连通与安全初始化"
echo " 目标: $TENCENT_IP (Ubuntu 24.04)"
echo "=========================================="

# ---- 1. 系统更新 ----
echo ""
echo "[1/3] 系统更新..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# ---- 2. 防火墙 ----
echo ""
echo "[2/3] 配置防火墙..."

apt-get install -y -qq ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# 未来工具分流时开放：
# ufw allow from "$ALIYUN_IP" to any port 8000:8099 proto tcp comment 'Aliyun gateway'

ufw --force enable
ufw status verbose

# ---- 3. SSH 公钥 ----
echo ""
echo "[3/3] SSH 公钥就绪..."
echo "  阿里云已通过 ~/.ssh/tencent_cloud 连接此服务器"
echo "  如需新增密钥：echo 'ssh-ed25519 AAAA...' >> ~/.ssh/authorized_keys"

# ---- 完成 ----
echo ""
echo "=========================================="
echo " 腾讯云连通初始化完成"
echo "=========================================="
echo ""
echo "当前用途: SSH 连通 + 基础安全"
echo "后续工具分流: build-all-tools.bat → scp → systemd"
