#!/usr/bin/env bash
# 端到端：登录 Oxelia51 → 经网关访问 DormGuard（在服务器 Workbench 执行）
# 用法：bash test-gateway-e2e.sh '你的ADMIN_INITIAL_PASSWORD'
set -euo pipefail

PW="${1:?用法: test-gateway-e2e.sh <oxelia51密码>}"

echo "=== 1. 登录 Oxelia51 ==="
LOGIN=$(curl -fsS --max-time 15 -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"oxelia51\",\"password\":\"$PW\"}")
echo "$LOGIN" | python3 -c "import json,sys; d=json.load(sys.stdin); print('user:', d.get('user', d))"

TOKEN=$(echo "$LOGIN" | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")
[ -n "$TOKEN" ] || { echo "登录失败，无 token"; exit 1; }

echo "=== 2. 经平台网关访问 DormGuard settings ==="
curl -fsS --max-time 15 -i \
  -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8080/api/tools/dormguard/proxy/api/admin/settings" | head -30

echo ""
echo "=== 若上面 200 且含 settings，浏览器仍失败 → 请退出重新登录 ==="
