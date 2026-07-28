#!/usr/bin/env bash
# Webhook 触发的部署脚本：从 release 分支拉取 tarball，本地解压部署。
# 服务器无需 Go/Node——构建产物由 GitHub Actions 预编译。
# 自愈机制：部署完成后检查是否有更新的 release，有则继续部署直到最新。
set -euo pipefail

LOG=/var/log/oxelia51-webhook-deploy.log
REPO_DIR=/opt/Oxelia51-src
LOCK_FILE=/tmp/oxelia51-deploy.lock
RELEASE_TARBALL="$1"

exec >> "$LOG" 2>&1

# 互斥锁

WORK=/tmp/oxelia51-webhook-deploy-$$
rm -rf "$WORK"
mkdir -p "$WORK"

echo "=== $(date -Iseconds) webhook deploy start ==="

# 下载 release tarball
if [ -z "$RELEASE_TARBALL" ]; then
  echo "错误：缺少 release tarball URL" >&2
  exit 1
fi
curl -sL -o "$WORK/oxelia51-release.tar.gz" "$RELEASE_TARBALL"

if [ ! -f "$WORK/oxelia51-release.tar.gz" ]; then
  echo "错误：tarball 下载失败" >&2
  exit 1
fi

# 解压到临时目录
tar xzf "$WORK/oxelia51-release.tar.gz" -C "$WORK"

# 执行部署
bash "$WORK/deploy/apply-release.sh" "$WORK"

echo "=== $(date -Iseconds) webhook deploy done ==="
rm -rf "$WORK"
