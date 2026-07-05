#!/usr/bin/env bash
# Webhook 触发的部署脚本：从 release 分支拉取 tarball，本地解压部署。
# 服务器无需 Go/Node——构建产物由 GitHub Actions 预编译。
set -euo pipefail

LOG=/var/log/oxelia51-webhook-deploy.log
REPO_DIR=/opt/Oxelia51-src
WORK=/tmp/oxelia51-webhook-deploy-$$

exec >> "$LOG" 2>&1
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK"

echo "=== $(date -Iseconds) webhook deploy start ==="

# 拉取 release 分支（仅含 tarball）
cd "$REPO_DIR"
git fetch origin release --force
git checkout release
git reset --hard origin/release

SHA=$(git rev-parse HEAD)
echo "release commit: $SHA"

if [ ! -f oxelia51-release.tar.gz ]; then
    echo "错误：release 分支缺少 oxelia51-release.tar.gz" >&2
    exit 1
fi

# 解压到临时目录
tar xzf oxelia51-release.tar.gz -C "$WORK"

# 校验产物结构
if [ ! -f "$WORK/backend/oxelia51-server" ] || [ ! -f "$WORK/deploy/apply-release.sh" ]; then
    echo "错误：tarball 结构不完整" >&2
    exit 1
fi

# 执行部署（复用现有 apply-release.sh）
bash "$WORK/deploy/apply-release.sh" "$WORK"

echo "=== $(date -Iseconds) webhook deploy done ==="
