#!/usr/bin/env bash
# 服务器上仅更新 Oxelia51 Go 后端（不构建前端）
set -euo pipefail

APP_DIR=/opt/Oxelia51
BUILD_DIR="${OXELIA_BUILD_DIR:-/root/Oxelia51-build}"
REPO_HTTPS="https://github.com/XiaoleC05/Oxelia51.git"
export PATH=/usr/local/go/bin:${PATH:-}
export GOTOOLCHAIN=auto
export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"

log() { echo "[update-backend] $*"; }
die() { echo "[update-backend][ERROR] $*" >&2; exit 1; }

ensure_go() {
  if command -v go >/dev/null 2>&1; then
    log "Go: $(go version)"
    return
  fi
  log "安装 Go 1.23.6..."
  curl -fsSL --max-time 120 https://go.dev/dl/go1.23.6.linux-amd64.tar.gz -o /tmp/go.tgz
  rm -rf /usr/local/go
  tar -C /usr/local -xzf /tmp/go.tgz
  export PATH=/usr/local/go/bin:$PATH
  log "Go: $(go version)"
}

fetch_source() {
  if [ -d "$APP_DIR/.git" ]; then
    log "使用已有仓库 git pull ($APP_DIR)..."
    timeout 120 git -C "$APP_DIR" pull --ff-only origin master
    BUILD_DIR="$APP_DIR"
    return
  fi
  log "清理并浅克隆到 $BUILD_DIR（HTTPS）..."
  rm -rf "$BUILD_DIR"
  mkdir -p "$(dirname "$BUILD_DIR")"
  # 避免 /tmp 或 hooks 模板目录异常
  GIT_TEMPLATE_DIR= timeout 180 git -c core.hooksPath=/dev/null clone --depth 1 --single-branch -b master \
    "$REPO_HTTPS" "$BUILD_DIR" || die "git clone 失败（检查磁盘: df -h）"
}

log "=== 1/4 准备 Go ==="
ensure_go

log "=== 2/4 拉源码 ==="
fetch_source

log "=== 3/4 编译（超时 300s）..."
cd "$BUILD_DIR/backend"
timeout 300 go mod download
timeout 300 env GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o oxelia51-server ./cmd/server
test -f oxelia51-server || die "编译失败：无 oxelia51-server"

log "=== 4/4 安装并重启 ==="
install -m755 oxelia51-server "$APP_DIR/backend/oxelia51-server"
if [ "$BUILD_DIR" != "$APP_DIR" ]; then
  rsync -a "$BUILD_DIR/deploy/" "$APP_DIR/deploy/"
fi
chmod +x "$APP_DIR/deploy/"*.sh "$APP_DIR/deploy/monitor/"*.sh 2>/dev/null || true
timeout 30 systemctl restart oxelia51-backend.service || die "oxelia51-backend 重启超时"
sleep 2
curl -fsS --max-time 10 http://127.0.0.1:8080/api/health
echo ""
log "完成。请浏览器退出 → 重新登录 → 访问 /tools/dormguard"
