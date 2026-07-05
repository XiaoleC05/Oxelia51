#!/usr/bin/env bash
# 安装本机 npm run build 后的 frontend/dist（无需在服务器 npm build）
# 用法：先把 frontend-dist.zip 上传到 /tmp/ 后执行
#   sudo bash install-frontend-dist.sh
set -euo pipefail

ZIP="${1:-/tmp/frontend-dist.zip}"
DST=/opt/Oxelia51/frontend/dist
TMP=/tmp/oxelia51-frontend-dist

if [ ! -f "$ZIP" ]; then
  echo "错误：未找到 $ZIP" >&2
  echo "请用 Workbench 上传 frontend-dist.zip 到 /tmp/" >&2
  exit 1
fi

rm -rf "$TMP"
mkdir -p "$TMP"
unzip -qo "$ZIP" -d "$TMP"
rm -rf "${DST}.bak"
[ -d "$DST" ] && mv "$DST" "${DST}.bak"
mkdir -p "$DST"
cp -a "$TMP"/. "$DST"/
chown -R www-data:www-data "$DST" 2>/dev/null || true

echo "--- 当前 index.html 引用的 JS ---"
BUNDLE=$(grep -o 'assets/index-[^"]*\.js' "$DST/index.html" || true)
echo "${BUNDLE:-<未找到>}"

if echo "$BUNDLE" | grep -q 'index--vw9HPJu'; then
  echo "警告：仍是旧 bundle index--vw9HPJu.js，请确认上传的 zip 是否正确" >&2
  exit 1
fi

echo "--- nginx 静态校验（若已配置 oxelia51.com）---"
NGINX_JS=$(curl -sS --max-time 5 -H 'Host: oxelia51.com' http://127.0.0.1/index.html 2>/dev/null \
  | grep -o 'assets/index-[^"]*\.js' || true)
if [ -n "$NGINX_JS" ]; then
  echo "nginx 返回: $NGINX_JS"
  if [ "$NGINX_JS" != "$BUNDLE" ]; then
    echo "警告：磁盘与 nginx 返回的 bundle 不一致，请 reload nginx 或检查 root 路径" >&2
  fi
else
  echo "（跳过：nginx 未就绪或未监听 80）"
fi

echo "安装完成。浏览器退出 → 重新登录 → Ctrl+Shift+R 强刷 → 打开 /tools/dormguard"
