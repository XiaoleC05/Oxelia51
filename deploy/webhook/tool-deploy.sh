#!/usr/bin/env bash
# tool-deploy.sh <tool-name> <repo-full-name>
# 由 webhook receiver 调用：从工具仓库的 release 分支拉取 tarball 并部署。
# 服务器无需 Go——构建产物由 GitHub Actions 预编译。
set -euo pipefail

TOOL_NAME="${1:-}"
REPO_FULL="${2:-}"
LOG=/var/log/oxelia51-webhook-deploy.log

if [ -z "$TOOL_NAME" ] || [ -z "$REPO_FULL" ]; then
    echo "用法: $0 <tool-name> <repo-full-name>" >&2
    exit 1
fi

exec >> "$LOG" 2>&1

LOCK_FILE="/tmp/oxelia51-tool-deploy-${TOOL_NAME}.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    echo "=== $(date -Iseconds) $TOOL_NAME 另一个部署正在执行，跳过 ==="
    exit 0
fi

echo "=== $(date -Iseconds) tool deploy start: $TOOL_NAME ($REPO_FULL) ==="

# ============================================
# 配置（按工具不同而不同）
# ============================================
INSTALL_DIR="/opt/${TOOL_NAME}"
BINARY_NAME="${TOOL_NAME}-server"
SRC_DIR="/opt/tool-src/${TOOL_NAME}"
REPO_URL="git@github.com:${REPO_FULL}.git"

TARBALL_NAME="${TOOL_NAME}-release.tar.gz"
WORK="/tmp/tool-deploy-${TOOL_NAME}-$$"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK" "$INSTALL_DIR"

# ============================================
# 1. 从 GitHub 拉取 release 分支
# ============================================
if [ ! -d "$SRC_DIR" ]; then
    echo "  首次克隆 $REPO_URL ..."
    git clone --single-branch --branch release "$REPO_URL" "$SRC_DIR"
fi

cd "$SRC_DIR"
git fetch origin release --force
git checkout release
git reset --hard origin/release

SHA=$(git rev-parse HEAD)
echo "  release commit: $SHA"

# ============================================
# 2. 解压 tarball
# ============================================
if [ ! -f "$TARBALL_NAME" ]; then
    echo "  错误：release 分支缺少 $TARBALL_NAME" >&2
    exit 1
fi

tar xzf "$TARBALL_NAME" -C "$WORK"

# ============================================
# 3. 安装二进制
# ============================================
if [ ! -f "$WORK/$BINARY_NAME" ]; then
    echo "  错误：tarball 中未找到 $BINARY_NAME" >&2
    ls -la "$WORK/"
    exit 1
fi

cp "$WORK/$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME"
chmod +x "$INSTALL_DIR/$BINARY_NAME"
echo "  二进制已安装: $INSTALL_DIR/$BINARY_NAME"

# ============================================
# 4. 重启服务
# ============================================
if systemctl is-active --quiet "$TOOL_NAME" 2>/dev/null; then
    systemctl restart "$TOOL_NAME"
    echo "  服务已重启: $TOOL_NAME"
else
    echo "  注意：$TOOL_NAME 服务未运行（可能首次部署，需手动 systemctl enable --now）"
fi

# ============================================
# 5. 健康检查
# ============================================
sleep 1
if systemctl is-active --quiet "$TOOL_NAME" 2>/dev/null; then
    echo "  $TOOL_NAME: active"
else
    echo "  $TOOL_NAME: WARNING - not active"
fi

echo "=== $(date -Iseconds) tool deploy done: $TOOL_NAME ==="
