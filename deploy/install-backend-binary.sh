#!/usr/bin/env bash
# 安装本机交叉编译的 oxelia51-server（无需在服务器 go build）
# 用法：先把 oxelia51-server-linux 上传到 /tmp/ 后执行
#   sudo bash install-backend-binary.sh
set -euo pipefail

SRC="${1:-/tmp/oxelia51-server-linux}"
DST=/opt/Oxelia51/backend/oxelia51-server

if [ ! -f "$SRC" ]; then
  echo "错误：未找到 $SRC" >&2
  echo "请用 Workbench 上传 oxelia51-server-linux 到 /tmp/" >&2
  exit 1
fi

install -m755 "$SRC" "$DST"
timeout 30 systemctl restart oxelia51-backend.service
sleep 2
curl -fsS --max-time 10 http://127.0.0.1:8080/api/health
echo ""
echo "安装完成。浏览器退出 → 重新登录 → /tools/dormguard"
