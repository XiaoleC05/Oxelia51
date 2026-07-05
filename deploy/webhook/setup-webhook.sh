#!/usr/bin/env bash
# Oxelia51 webhook 一键安装脚本（无需 git clone）
# 在服务器上以 root 执行：bash setup-webhook.sh
set -euo pipefail

INSTALL_DIR=/opt/Oxelia51/deploy/webhook
SRC_DIR=/opt/Oxelia51-src

echo "=== 1. 创建目录 ==="
mkdir -p "$INSTALL_DIR"

echo "=== 2. 写入 receiver.py ==="
cat > "$INSTALL_DIR/receiver.py" <<'PYEOF'
#!/usr/bin/env python3
"""Oxelia51 GitHub webhook receiver."""
import hashlib, hmac, json, os, subprocess, sys
from http.server import HTTPServer, BaseHTTPRequestHandler

SECRET = os.environ.get("WEBHOOK_SECRET", "").encode()
DEPLOY_SCRIPT = os.environ.get("DEPLOY_SCRIPT", "/opt/Oxelia51/deploy/webhook/deploy.sh")
LISTEN_ADDR = ("127.0.0.1", 9000)
TRIGGER_REF = "refs/heads/release"

def verify_signature(body, sig_header):
    if not SECRET or not sig_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig_header, expected)

class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else b""
        sig = self.headers.get("X-Hub-Signature-256", "")
        if not verify_signature(body, sig):
            self._respond(403, b"invalid signature\n"); return
        event = self.headers.get("X-GitHub-Event", "")
        if event != "push":
            self._respond(200, b"ignored: not push\n"); return
        try: payload = json.loads(body)
        except json.JSONDecodeError:
            self._respond(400, b"invalid json\n"); return
        ref = payload.get("ref", "")
        if ref != TRIGGER_REF:
            self._respond(200, f"ignored: {ref}\n".encode()); return
        subprocess.Popen(["bash", DEPLOY_SCRIPT],
            stdout=open("/var/log/oxelia51-webhook-deploy.log", "a"),
            stderr=subprocess.STDOUT)
        self._respond(200, b"deploy triggered\n")

    def do_GET(self):
        self._respond(200, b"ok\n")

    def _respond(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

if __name__ == "__main__":
    if not SECRET:
        print("错误：WEBHOOK_SECRET 环境变量未设置", file=sys.stderr); sys.exit(1)
    server = HTTPServer(LISTEN_ADDR, WebhookHandler)
    print(f"webhook receiver listening on {LISTEN_ADDR[0]}:{LISTEN_ADDR[1]}")
    server.serve_forever()
PYEOF
chmod +x "$INSTALL_DIR/receiver.py"

echo "=== 3. 写入 deploy.sh ==="
cat > "$INSTALL_DIR/deploy.sh" <<'SHEOF'
#!/usr/bin/env bash
set -euo pipefail
LOG=/var/log/oxelia51-webhook-deploy.log
REPO_DIR=/opt/Oxelia51-src
WORK=/tmp/oxelia51-webhook-deploy-$$
exec >> "$LOG" 2>&1
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK"
echo "=== $(date -Iseconds) webhook deploy start ==="
cd "$REPO_DIR"
git fetch origin release --force
git checkout release
git reset --hard origin/release
SHA=$(git rev-parse HEAD)
echo "release commit: $SHA"
if [ ! -f oxelia51-release.tar.gz ]; then
    echo "错误：release 分支缺少 oxelia51-release.tar.gz" >&2; exit 1
fi
tar xzf oxelia51-release.tar.gz -C "$WORK"
if [ ! -f "$WORK/backend/oxelia51-server" ] || [ ! -f "$WORK/deploy/apply-release.sh" ]; then
    echo "错误：tarball 结构不完整" >&2; exit 1
fi
bash "$WORK/deploy/apply-release.sh" "$WORK"
echo "=== $(date -Iseconds) webhook deploy done ==="
SHEOF
chmod +x "$INSTALL_DIR/deploy.sh"

echo "=== 4. 写入 systemd 服务 ==="
cat > "$INSTALL_DIR/oxelia51-webhook.service" <<'SVCEOF'
[Unit]
Description=Oxelia51 GitHub Webhook Receiver
After=network.target

[Service]
Type=simple
User=root
EnvironmentFile=/opt/Oxelia51/deploy/webhook/.env
ExecStart=/usr/bin/python3 /opt/Oxelia51/deploy/webhook/receiver.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

echo "=== 5. 生成 webhook 密钥 ==="
SECRET=$(openssl rand -hex 32)
cat > "$INSTALL_DIR/.env" <<EOF
WEBHOOK_SECRET=$SECRET
DEPLOY_SCRIPT=/opt/Oxelia51/deploy/webhook/deploy.sh
EOF
echo "****************************************"
echo "* Webhook Secret（复制保存，GitHub 配置时需要）:"
echo "* $SECRET"
echo "****************************************"

echo "=== 6. 安装 systemd 服务 ==="
cp "$INSTALL_DIR/oxelia51-webhook.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable oxelia51-webhook
systemctl start oxelia51-webhook
sleep 1
systemctl status oxelia51-webhook --no-pager || true

echo "=== 7. 验证 receiver 监听 ==="
curl -sS http://127.0.0.1:9000/ || echo "(receiver 可能还在启动中)"

echo ""
echo "=== 安装完成 ==="
echo "下一步："
echo "1. 把上面的 Webhook Secret 填到 GitHub 仓库 Settings → Webhooks"
echo "2. 生成 deploy key: ssh-keygen -t ed25519 -f /root/.ssh/oxelia51_deploy -N ''"
echo "3. 把公钥添加到 GitHub 仓库 Settings → Deploy keys"
echo "4. 克隆仓库: git clone git@github.com:XiaoleC05/Oxelia51.git /opt/Oxelia51-src"
echo "5. 更新 nginx: 见 deploy/nginx/default-ip.conf 添加 /webhook location"
