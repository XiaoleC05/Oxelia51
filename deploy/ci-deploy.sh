#!/usr/bin/env bash
set -euo pipefail

TARBALL="${1:?用法: ci-deploy.sh /path/to/oxelia51-release.tar.gz}"
WORK="/tmp/oxelia51-release-$$"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK"
tar xzf "$TARBALL" -C "$WORK"

if [ ! -f "$WORK/deploy/apply-release.sh" ]; then
  echo "错误：发布包内缺少 deploy/apply-release.sh" >&2
  exit 1
fi

exec /usr/bin/bash "$WORK/deploy/apply-release.sh" "$WORK"
