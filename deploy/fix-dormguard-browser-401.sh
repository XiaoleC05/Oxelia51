#!/usr/bin/env bash
# 修复浏览器 /tools/dormguard 401（旧前端 bundle + Nginx 未转发认证头）
# Workbench 用法：
#   1. 上传 frontend-dist.zip → /tmp/
#   2. sudo bash /opt/Oxelia51/deploy/fix-dormguard-browser-401.sh 'oxelia51密码'
set -euo pipefail

PW="${1:-${OXELIA51_PW:-}}"
OX=/opt/Oxelia51
ZIP="${FRONTEND_ZIP:-/tmp/frontend-dist.zip}"

echo "========== fix-dormguard-browser-401 =========="

if [ ! -f "$ZIP" ]; then
  echo "错误：未找到 $ZIP" >&2
  echo "请先用 Workbench 上传 release/frontend-dist.zip 到 /tmp/" >&2
  exit 1
fi

echo "--- 1/4 安装前端 dist ---"
bash "$OX/deploy/install-frontend-dist.sh" "$ZIP"

echo "--- 2/4 同步 Nginx（Authorization + 备用头 + index.html no-cache）---"
cp "$OX/deploy/nginx/oxelia51.com.conf" /etc/nginx/sites-enabled/oxelia51.com
nginx -t
systemctl reload nginx

echo "--- 3/4 确认后端含 X-Oxelia51-Access-Token 支持 ---"
if strings "$OX/backend/oxelia51-server" 2>/dev/null | grep -q 'X-Oxelia51-Access-Token'; then
  echo "OK  后端二进制已含备用认证头"
else
  echo "WARN 后端可能未更新。若诊断 :8080 仍 401，请上传 oxelia51-server-linux 并执行 install-backend-binary.sh"
fi

echo "--- 4/4 全链路诊断 ---"
if [ -n "$PW" ]; then
  bash "$OX/deploy/diagnose-all.sh" "$PW"
else
  bash "$OX/deploy/diagnose-all.sh"
  echo ""
  echo "提示：传入 oxelia51 密码可测登录 + proxy："
  echo "  sudo bash $0 '你的密码'"
fi

echo ""
echo "浏览器：退出登录 → 重新登录 → Ctrl+Shift+R → 打开 https://oxelia51.com/tools/dormguard"
echo "Network 应加载 index-BbuqgG6Y.js（非 index--vw9HPJu.js）"
