#!/usr/bin/env bash
set -euo pipefail

LOG_TAG="oxelia51-healthcheck"
FAIL=0
MSG=""

check() {
  local name="$1"
  shift
  if "$@"; then
    MSG+="[OK] $name "
  else
    MSG+="[FAIL] $name "
    FAIL=1
  fi
}

check "api" curl -fsS --max-time 10 http://127.0.0.1:8080/api/health
check "nginx" systemctl is-active --quiet nginx
check "postgres" PGPASSWORD="$(grep -E '^DB_PASSWORD=' /opt/Oxelia51/backend/.env 2>/dev/null | cut -d= -f2- | tr -d '\r')" pg_isready -h 127.0.0.1 -U root -d oxelia51

if [ "$FAIL" -ne 0 ]; then
  logger -t "$LOG_TAG" "$MSG"
  echo "UNHEALTHY: $MSG" >&2
  exit 1
fi

echo "HEALTHY: $MSG"
