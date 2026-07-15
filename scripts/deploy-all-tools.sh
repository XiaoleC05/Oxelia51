#!/bin/bash
# ========================================
#  deploy-all-tools.sh
#  在服务器上一次性部署所有工具
#  前提：已通过 Workbench 上传所有 *-server 到 /opt/tools/
#  在 Workbench 终端中执行：bash /opt/tools/deploy-all-tools.sh
# ========================================
set -e

# If tools.zip was uploaded, extract it
if [ -f /opt/tools/tools.zip ]; then
  echo "Extracting tools.zip..."
  cd /opt/tools
  unzip -o tools.zip
  rm tools.zip
  echo "  Extracted."
fi

BIN_DIR=/opt/tools
DB_URL=postgres://root:YOUR_PASSWORD@localhost:5432/oxelia51?sslmode=disable

deploy_tool() {
  local name=$1 port=$2
  echo "=== Deploying $name (port $port) ==="
  sudo cp "$BIN_DIR/$name-server" "/opt/$name/$name-server" 2>/dev/null || sudo mkdir -p "/opt/$name" && sudo cp "$BIN_DIR/$name-server" "/opt/$name/$name-server"
  sudo chmod +x "/opt/$name/$name-server"

  sudo tee /etc/systemd/system/$name.service > /dev/null << UNIT
[Unit]
Description=$name Service
After=network.target postgresql.service

[Service]
Type=simple
ExecStart=/opt/$name/$name-server
Environment=DATABASE_URL=$DB_URL
Environment=OXELIA_GATEWAY_MODE=true
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

  sudo systemctl daemon-reload
  sudo systemctl enable --now $name
  echo "  $name deployed"
}

# --- 按依赖顺序部署 ---
echo "Updating database seed..."
sudo -u postgres psql -d oxelia51 -f /opt/Oxelia51/deploy/seed-tools.sql

deploy_tool superread    8002
deploy_tool aihelper     8004
deploy_tool agentcanvas  8005
deploy_tool secretstore  8006

echo ""
echo "=== All tools deployed ==="
echo "Verifying..."
sleep 2
for s in superread aihelper agentcanvas secretstore; do
  echo -n "$s: "
  curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/tools/$s/proxy/api/health || echo "FAIL"
  echo ""
done
