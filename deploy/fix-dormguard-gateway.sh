#!/usr/bin/env bash
# DormGuard ↔ Oxelia51 网关联调：诊断 + 修复（ADR-006/007，契约 v1.1）
# 用法：sudo bash /opt/Oxelia51/deploy/fix-dormguard-gateway.sh
set -euo pipefail

OX_DIR=/opt/Oxelia51
DG_DIR=/opt/DormGuard
OX_ENV="$OX_DIR/backend/.env"
DG_ENV="$DG_DIR/backend/.env"
NONEBOT_PORT=8089
FAIL=0

log() { echo "[gateway-fix] $*"; }
warn() { echo "[gateway-fix][WARN] $*" >&2; }
die() { echo "[gateway-fix][ERROR] $*" >&2; exit 1; }

set_env_kv() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

check() {
  local name="$1"
  shift
  if "$@"; then
    log "OK  $name"
  else
    warn "FAIL $name"
    FAIL=1
  fi
}

[ -d "$OX_DIR/backend" ] || die "未找到 $OX_DIR/backend，请先部署 Oxelia51"
[ -f "$OX_ENV" ] || die "未找到 $OX_ENV"
[ -d "$DG_DIR/backend" ] || die "未找到 $DG_DIR/backend"
[ -f "$DG_ENV" ] || die "未找到 $DG_ENV"

log "=== 1/5 诊断 ==="
check "oxelia51-api" curl -fsS --max-time 10 http://127.0.0.1:8080/api/health
check "dormguard-api" curl -fsS --max-time 10 http://127.0.0.1:8000/health

GW_MODE="$(grep -E '^OXELIA_GATEWAY_MODE=' "$DG_ENV" | cut -d= -f2- | tr -d '\r' || true)"
TOOL_BASE="$(grep -E '^TOOL_API_BASE_DORMGUARD=' "$OX_ENV" | cut -d= -f2- | tr -d '\r' || true)"
GW_SECRET="$(grep -E '^OXELIA_GATEWAY_SECRET=' "$DG_ENV" | cut -d= -f2- | tr -d '\r' || true)"
log "DormGuard OXELIA_GATEWAY_MODE=${GW_MODE:-<unset>}"
log "Oxelia51 TOOL_API_BASE_DORMGUARD=${TOOL_BASE:-<unset>}"
log "DormGuard OXELIA_GATEWAY_SECRET=${GW_SECRET:+<set>}${GW_SECRET:-<empty>}"

if [ "$GW_MODE" != "true" ]; then
  warn "根因：DormGuard 未启用网关模式（platform-cutover 可能未执行）"
fi
if [ -z "$TOOL_BASE" ]; then
  warn "根因：Oxelia51 缺少 TOOL_API_BASE_DORMGUARD"
fi
if [ -n "$GW_SECRET" ]; then
  warn "DormGuard 配置了 OXELIA_GATEWAY_SECRET，但平台网关未转发该头 — 将清空以避免 401"
fi

log "=== 2/5 修复 DormGuard .env ==="
set_env_kv "$DG_ENV" "OXELIA_GATEWAY_MODE" "true"
set_env_kv "$DG_ENV" "OXELIA_GATEWAY_SECRET" ""
if grep -q '^QQ_BOT_API_URL=' "$DG_ENV"; then
  sed -i "s|^QQ_BOT_API_URL=.*|QQ_BOT_API_URL=http://127.0.0.1:${NONEBOT_PORT}|" "$DG_ENV"
else
  echo "QQ_BOT_API_URL=http://127.0.0.1:${NONEBOT_PORT}" >> "$DG_ENV"
fi

log "=== 3/5 修复 Oxelia51 .env + 工具注册 ==="
set_env_kv "$OX_ENV" "TOOL_API_BASE_DORMGUARD" "http://127.0.0.1:8000"
set_env_kv "$OX_ENV" "LISTEN_ADDR" "127.0.0.1:8080"

DB_PASSWORD="$(grep -E '^DB_PASSWORD=' "$OX_ENV" | cut -d= -f2- | tr -d '\r' || true)"
if [ -n "$DB_PASSWORD" ] && [ -f "$OX_DIR/deploy/seed-tools.sql" ]; then
  PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U root -d oxelia51 -f "$OX_DIR/deploy/seed-tools.sql" || warn "seed-tools.sql 执行失败（可忽略若已存在）"
fi

log "=== 4/5 重启服务 ==="
if [ -f "$DG_DIR/deploy/systemd/dormguard-nonebot.service" ]; then
  cp "$DG_DIR/deploy/systemd/dormguard-nonebot.service" /etc/systemd/system/
fi
systemctl daemon-reload
systemctl restart dormguard-backend.service
systemctl restart dormguard-nonebot.service 2>/dev/null || true
systemctl restart oxelia51-backend.service
sleep 3

log "=== 5/5 验证 loopback 网关信任 ==="
DG_SETTINGS="$(curl -fsS --max-time 10 \
  -H 'X-Oxelia51-User-Id: 1' \
  -H 'X-Oxelia51-Username: oxelia51' \
  -H 'X-Oxelia51-Role: admin' \
  -H 'X-Oxelia51-Request-Id: gateway-fix-test' \
  http://127.0.0.1:8000/api/admin/settings)" || DG_SETTINGS=""

if echo "$DG_SETTINGS" | grep -q '"settings"'; then
  log "OK  DormGuard 网关头信任（/api/admin/settings）"
else
  warn "FAIL DormGuard 网关头信任 — 响应: ${DG_SETTINGS:-<empty>}"
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  die "仍有检查失败，请查看上方日志"
fi

log "网关联调修复完成。请在浏览器登录 oxelia51 后访问 /tools/dormguard"
