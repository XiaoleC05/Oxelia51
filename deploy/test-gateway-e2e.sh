#!/usr/bin/env bash
# 端到端：登录 Oxelia51 → 经网关访问 DormGuard
# 用法：bash test-gateway-e2e.sh
#   或：OXELIA51_PW='密码' bash test-gateway-e2e.sh
set -euo pipefail

PW="${1:-${OXELIA51_PW:-}}"
if [ -z "$PW" ]; then
  read -rsp "oxelia51 密码: " PW
  echo ""
fi

echo "=== 0. 前置检查 ==="
timeout 5 curl -fsS --connect-timeout 3 --max-time 5 http://127.0.0.1:8080/api/health && echo " oxelia51 OK" || { echo "oxelia51 不可用"; exit 1; }
timeout 5 curl -fsS --connect-timeout 3 --max-time 5 http://127.0.0.1:8000/health && echo " dormguard OK" || { echo "dormguard 不可用"; exit 1; }

echo "=== 1. 登录（最多 20s）==="
LOGIN=$(timeout 20 curl -sS --connect-timeout 5 --max-time 15 \
  -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "$(python3 -c "import json,sys; print(json.dumps({'username':'oxelia51','password':sys.argv[1]}))" "$PW")") \
  || { echo "登录请求超时或失败"; exit 1; }

echo "$LOGIN" | head -c 200
echo ""

TOKEN=$(echo "$LOGIN" | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || true)
if [ -z "$TOKEN" ]; then
  echo "登录失败（无 token），响应见上"
  exit 1
fi
echo "token 已获取 (${#TOKEN} 字符)"

echo "=== 2. 网关 proxy（最多 20s）==="
timeout 20 curl -sS --connect-timeout 5 --max-time 15 -i \
  -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8080/api/tools/dormguard/proxy/api/admin/settings" | head -35

echo ""
echo "=== 完成：若 HTTP/1.1 200 且含 settings，浏览器退出重登后访问 /tools/dormguard ==="
