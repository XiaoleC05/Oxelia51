#!/usr/bin/env bash
# 在服务器上应用 Oxelia51 发布包
set -euo pipefail

APP_DIR=/opt/Oxelia51
RELEASE_DIR="${1:-/tmp/oxelia51-release}"

if [ ! -f "$RELEASE_DIR/backend/oxelia51-server" ]; then
  echo "错误：未找到 $RELEASE_DIR/backend/oxelia51-server" >&2
  exit 1
fi

mkdir -p "$APP_DIR/backend" "$APP_DIR/frontend/dist" "$APP_DIR/deploy/docker"
install -m 755 "$RELEASE_DIR/backend/oxelia51-server" "$APP_DIR/backend/oxelia51-server"
rsync -a "$RELEASE_DIR/backend/migrations/" "$APP_DIR/backend/migrations/"
rsync -a "$RELEASE_DIR/deploy/" "$APP_DIR/deploy/"
rsync -a --delete "$RELEASE_DIR/frontend-dist/" "$APP_DIR/frontend/dist/"
chmod +x "$APP_DIR/deploy/"*.sh "$APP_DIR/deploy/monitor/"*.sh 2>/dev/null || true

if [ ! -f "$APP_DIR/backend/.env" ]; then
  cp "$APP_DIR/deploy/env.production.example" "$APP_DIR/backend/.env"
  echo "已生成 $APP_DIR/backend/.env — 请编辑 DB_PASSWORD / JWT_SECRET / ADMIN_INITIAL_PASSWORD 后重新运行" >&2
  exit 2
fi

DB_PASSWORD="$(grep -E '^DB_PASSWORD=' "$APP_DIR/backend/.env" | cut -d= -f2- | tr -d '\r' || true)"
mkdir -p "$APP_DIR/deploy/docker"
cat > "$APP_DIR/deploy/docker/.env" <<EOF
POSTGRES_USER=root
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=oxelia51
EOF

cp "$APP_DIR/deploy/systemd/oxelia51-data.service" /etc/systemd/system/
cp "$APP_DIR/deploy/systemd/oxelia51-backend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable oxelia51-data.service oxelia51-backend.service
systemctl start oxelia51-data.service

echo "等待 PostgreSQL 就绪..."
for _ in $(seq 1 30); do
  if PGPASSWORD="$DB_PASSWORD" pg_isready -h 127.0.0.1 -U root -d oxelia51 >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

systemctl restart oxelia51-backend.service
sleep 3

if [ -f "$APP_DIR/deploy/seed-tools.sql" ]; then
  PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U root -d oxelia51 -f "$APP_DIR/deploy/seed-tools.sql" || true
fi

cp "$APP_DIR/deploy/nginx/oxelia51.com.conf" /etc/nginx/sites-available/oxelia51.com
ln -sf /etc/nginx/sites-available/oxelia51.com /etc/nginx/sites-enabled/oxelia51.com
cp "$APP_DIR/deploy/nginx/default-ip.conf" /etc/nginx/sites-available/default-ip
ln -sf /etc/nginx/sites-available/default-ip /etc/nginx/sites-enabled/default-ip

nginx -t
systemctl reload nginx

"$APP_DIR/deploy/monitor/oxelia51-healthcheck.sh"
