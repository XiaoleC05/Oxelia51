#!/usr/bin/env bash
# Oxelia51 首次服务器依赖（Ubuntu/Debian）
set -euo pipefail

APP_DIR=/opt/Oxelia51

echo "[1/5] 安装 Docker、Nginx、PostgreSQL 客户端..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2 nginx postgresql-client curl

systemctl enable --now docker
systemctl enable nginx

echo "[2/5] 创建目录 $APP_DIR ..."
mkdir -p "$APP_DIR"

echo "[3/5] 若尚未配置 backend/.env，请部署发布包后编辑："
echo "  $APP_DIR/backend/.env"
echo "  参考 $APP_DIR/deploy/env.production.example"

echo "[4/5] 完成。下一步："
echo "  sudo bash /opt/Oxelia51/deploy/apply-release.sh /path/to/release"
echo "  sudo bash /opt/Oxelia51/deploy/platform-cutover.sh   # 合并 DormGuard"

echo "[5/5] bootstrap 完成"
