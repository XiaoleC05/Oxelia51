#!/usr/bin/env bash
# 一键诊断 Oxelia51 ↔ DormGuard 全链路
set -uo pipefail

PW="${1:-${OXELIA51_PW:-}}"
echo "========== Oxelia51 / DormGuard 诊断 =========="

check() { printf "%-28s" "$1"; shift; if "$@" >/dev/null 2>&1; then echo OK; else echo FAIL; fi; }

check "oxelia51 :8080 health" curl -fsS --max-time 5 http://127.0.0.1:8080/api/health
check "dormguard :8000 health" curl -fsS --max-time 5 http://127.0.0.1:8000/health
check "nginx config" nginx -t
check "dormguard-backend active" systemctl is-active dormguard-backend.service
check "oxelia51-backend active" systemctl is-active oxelia51-backend.service

echo "--- 端口 ---"
ss -lntp | grep -E ':8080|:8000|:443' || true

echo "--- DormGuard 网关 .env ---"
grep -E '^OXELIA_GATEWAY_MODE=|^OXELIA_GATEWAY_SECRET=' /opt/DormGuard/backend/.env 2>/dev/null || true

echo "--- Nginx Authorization 转发 ---"
grep -n Authorization /etc/nginx/sites-enabled/oxelia51.com 2>/dev/null || echo "未找到 Authorization 配置"

if [ -z "$PW" ]; then
  echo "--- 跳过登录测试（用法: bash diagnose-all.sh 'oxelia51密码'）---"
  exit 0
fi

echo "--- 登录 + 直连网关 :8080 ---"
LOGIN=$(curl -sS --max-time 15 -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "$(python3 -c "import json,sys; print(json.dumps({'username':'oxelia51','password':sys.argv[1]}))" "$PW")") || LOGIN=""
TOKEN=$(echo "$LOGIN" | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || true)
if [ -z "$TOKEN" ]; then
  echo "登录失败: $(echo "$LOGIN" | head -c 200)"
  exit 1
fi
echo "token 长度: ${#TOKEN}"

echo "--- proxy via :8080 ---"
R1=$(curl -sS --max-time 15 -o /tmp/dg1.json -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8080/api/tools/dormguard/proxy/api/admin/settings)
echo "HTTP $R1  body: $(head -c 120 /tmp/dg1.json)"

echo "--- proxy via nginx 127.0.0.1 (Host: oxelia51.com, Authorization) ---"
R2=$(curl -sS --max-time 15 -o /tmp/dg2.json -w "%{http_code}" \
  -H "Host: oxelia51.com" -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1/api/tools/dormguard/proxy/api/admin/settings)
echo "HTTP $R2  body: $(head -c 120 /tmp/dg2.json)"

echo "--- proxy via nginx (X-Oxelia51-Access-Token 备用头) ---"
R3=$(curl -sS --max-time 15 -o /tmp/dg3.json -w "%{http_code}" \
  -H "Host: oxelia51.com" -H "X-Oxelia51-Access-Token: $TOKEN" \
  http://127.0.0.1/api/tools/dormguard/proxy/api/admin/settings)
echo "HTTP $R3  body: $(head -c 120 /tmp/dg3.json)"

echo "--- 前端 bundle（nginx 静态）---"
grep -o 'assets/index-[^"]*\.js' /opt/Oxelia51/frontend/dist/index.html 2>/dev/null \
  | sed 's/^/磁盘: /' || echo "磁盘: <未找到 dist>"
curl -sS --max-time 5 -H 'Host: oxelia51.com' http://127.0.0.1/index.html 2>/dev/null \
  | grep -o 'assets/index-[^"]*\.js' | sed 's/^/nginx: /' || echo "nginx: <未返回>"

if [ "$R1" = "200" ] && [ "$R2" != "200" ] && [ "$R3" = "200" ]; then
  echo ">>> 结论: 后端正常；Nginx 丢弃 Authorization，但 X-Oxelia51-Access-Token 可用"
elif [ "$R1" = "200" ] && [ "$R2" != "200" ] && [ "$R3" != "200" ]; then
  echo ">>> 结论: 后端正常，Nginx 未转发认证头 — 更新 oxelia51.com.conf 并 reload"
elif [ "$R1" = "200" ] && [ "$R2" = "200" ]; then
  echo ">>> 结论: 服务端全通。若浏览器仍 401：强刷缓存，F12 确认 bundle 非 index--vw9HPJu.js"
else
  echo ">>> 结论: 后端 proxy 异常，查 journalctl -u oxelia51-backend / dormguard-backend"
fi

echo "--- 浏览器 Console 自测（登录后粘贴）---"
cat <<'EOF'
const t=localStorage.getItem('token');
fetch('/api/tools/dormguard/proxy/api/admin/settings',{headers:{Authorization:'Bearer '+t,'X-Oxelia51-Access-Token':t},cache:'no-store'})
  .then(r=>r.json().then(j=>({status:r.status,body:j}))).then(console.log);
EOF
