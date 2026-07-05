#!/usr/bin/env bash
# ADR-006 阶段 2：DormGuard 内网化 + 平台公网（与 apply-release 联用）
set -euo pipefail

DG_DIR=/opt/DormGuard
OX_DIR=/opt/Oxelia51
NONEBOT_PORT=8089
ENV_FILE="$DG_DIR/backend/.env"

if [ ! -d "$OX_DIR/backend" ]; then
  echo "错误：请先部署 Oxelia51 到 $OX_DIR" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "错误：未找到 DormGuard $ENV_FILE" >&2
  exit 1
fi

echo "[1/6] DormGuard 启用网关模式（loopback 信任平台 JWT 头）..."
if grep -q '^OXELIA_GATEWAY_MODE=' "$ENV_FILE"; then
  sed -i 's/^OXELIA_GATEWAY_MODE=.*/OXELIA_GATEWAY_MODE=true/' "$ENV_FILE"
else
  echo 'OXELIA_GATEWAY_MODE=true' >> "$ENV_FILE"
fi
# 平台网关未转发 X-Oxelia51-Gateway-Secret，留空 secret 避免 401
if grep -q '^OXELIA_GATEWAY_SECRET=' "$ENV_FILE"; then
  sed -i 's/^OXELIA_GATEWAY_SECRET=.*/OXELIA_GATEWAY_SECRET=/' "$ENV_FILE"
else
  echo 'OXELIA_GATEWAY_SECRET=' >> "$ENV_FILE"
fi

OX_ENV="$OX_DIR/backend/.env"
if [ -f "$OX_ENV" ]; then
  if grep -q '^TOOL_API_BASE_DORMGUARD=' "$OX_ENV"; then
    sed -i 's|^TOOL_API_BASE_DORMGUARD=.*|TOOL_API_BASE_DORMGUARD=http://127.0.0.1:8000|' "$OX_ENV"
  else
    echo 'TOOL_API_BASE_DORMGUARD=http://127.0.0.1:8000' >> "$OX_ENV"
  fi
  DB_PASSWORD="$(grep -E '^DB_PASSWORD=' "$OX_ENV" | cut -d= -f2- | tr -d '\r' || true)"
  if [ -n "$DB_PASSWORD" ] && [ -f "$OX_DIR/deploy/seed-tools.sql" ]; then
    PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U root -d oxelia51 -f "$OX_DIR/deploy/seed-tools.sql" || true
  fi
fi

echo "[2/6] NoneBot 端口 $NONEBOT_PORT（释放 8080 给 Oxelia51）..."
if grep -q '^QQ_BOT_API_URL=' "$ENV_FILE"; then
  sed -i "s|^QQ_BOT_API_URL=.*|QQ_BOT_API_URL=http://127.0.0.1:${NONEBOT_PORT}|" "$ENV_FILE"
else
  echo "QQ_BOT_API_URL=http://127.0.0.1:${NONEBOT_PORT}" >> "$ENV_FILE"
fi

if [ -f "$DG_DIR/backend/nonebot_bot/napcat-config.json" ]; then
  python3 - <<'PY' "$DG_DIR/backend/nonebot_bot/napcat-config.json" "$NONEBOT_PORT"
import json, sys
path, port = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
for item in data.get("network", {}).get("wsServers", []) or []:
    item["url"] = f"ws://127.0.0.1:{port}/onebot/v11/ws"
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
PY
fi

if [ -f "$DG_DIR/deploy/systemd/dormguard-nonebot.service" ]; then
  cp "$DG_DIR/deploy/systemd/dormguard-nonebot.service" /etc/systemd/system/
fi

echo "[3/6] 重启 DormGuard 后端与 NoneBot..."
systemctl daemon-reload
systemctl restart dormguard-backend.service
systemctl restart dormguard-nonebot.service || true
bash "$DG_DIR/deploy/fix-napcat.sh" || true

echo "[4/6] 切换 Nginx 至 Oxelia51 平台..."
cp "$OX_DIR/deploy/nginx/oxelia51.com.conf" /etc/nginx/sites-available/oxelia51.com
ln -sf /etc/nginx/sites-available/oxelia51.com /etc/nginx/sites-enabled/oxelia51.com
cp "$OX_DIR/deploy/nginx/default-ip.conf" /etc/nginx/sites-available/default-ip
ln -sf /etc/nginx/sites-available/default-ip /etc/nginx/sites-enabled/default-ip
nginx -t
systemctl reload nginx

echo "[5/6] 重启 Oxelia51 API..."
systemctl restart oxelia51-backend.service

echo "[6/6] 健康检查..."
"$OX_DIR/deploy/monitor/oxelia51-healthcheck.sh"
"$DG_DIR/deploy/monitor/dormguard-healthcheck.sh" || echo "DormGuard healthcheck 有警告，请检查 NoneBot/NapCat"

echo "平台切换完成：https://oxelia51.com"
echo "DormGuard 业务入口：/tools/dormguard（平台登录）"
echo "DormGuard API 仅 loopback :8000 + 网关模式"
