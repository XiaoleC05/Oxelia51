#!/usr/bin/env bash
# 服务器上仅更新 Oxelia51 Go 后端（不构建前端）
set -euo pipefail

APP_DIR=/opt/Oxelia51
BUILD_DIR=/tmp/Oxelia51-build
export PATH=/usr/local/go/bin:${PATH:-}
export GOTOOLCHAIN=auto

if ! command -v go >/dev/null 2>&1; then
  echo "错误：未找到 go，请先安装 /usr/local/go" >&2
  exit 1
fi

rm -rf "$BUILD_DIR"
git clone --depth 1 git@github.com:XiaoleC05/Oxelia51.git "$BUILD_DIR"
cd "$BUILD_DIR/backend"
go mod tidy
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o oxelia51-server ./cmd/server
install -m755 oxelia51-server "$APP_DIR/backend/oxelia51-server"
rsync -a "$BUILD_DIR/deploy/" "$APP_DIR/deploy/"
chmod +x "$APP_DIR/deploy/"*.sh "$APP_DIR/deploy/monitor/"*.sh 2>/dev/null || true
systemctl restart oxelia51-backend.service
sleep 2
curl -fsS --max-time 10 http://127.0.0.1:8080/api/health
echo ""
echo "Oxelia51 后端已更新。请浏览器退出后重新登录，再访问 /tools/dormguard"
