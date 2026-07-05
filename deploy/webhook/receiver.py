#!/usr/bin/env python3
"""Oxelia51 GitHub webhook receiver.

监听 127.0.0.1:9000，验证 HMAC-SHA256 签名，
仅在 push 到 release 分支时触发 deploy.sh。

环境变量：
  WEBHOOK_SECRET  - GitHub webhook 密钥（必填）
  DEPLOY_SCRIPT   - 部署脚本路径（默认 /opt/Oxelia51/deploy/webhook/deploy.sh）
"""
import hashlib
import hmac
import json
import os
import subprocess
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

SECRET = os.environ.get("WEBHOOK_SECRET", "").encode()
DEPLOY_SCRIPT = os.environ.get("DEPLOY_SCRIPT", "/opt/Oxelia51/deploy/webhook/deploy.sh")
LISTEN_ADDR = ("127.0.0.1", 9000)
TRIGGER_REF = "refs/heads/release"


def verify_signature(body: bytes, sig_header: str) -> bool:
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
            self._respond(403, b"invalid signature\n")
            return

        event = self.headers.get("X-GitHub-Event", "")
        if event != "push":
            self._respond(200, b"ignored: not push event\n")
            return

        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self._respond(400, b"invalid json\n")
            return

        ref = payload.get("ref", "")
        if ref != TRIGGER_REF:
            self._respond(200, f"ignored: {ref} (only {TRIGGER_REF})\n".encode())
            return

        # 触发部署（后台执行，避免 webhook 超时）
        subprocess.Popen(
            ["bash", DEPLOY_SCRIPT],
            stdout=open("/var/log/oxelia51-webhook-deploy.log", "a"),
            stderr=subprocess.STDOUT,
        )
        self._respond(200, b"deploy triggered\n")

    def do_GET(self):
        # 健康检查端点
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
        print("错误：WEBHOOK_SECRET 环境变量未设置", file=sys.stderr)
        sys.exit(1)
    server = HTTPServer(LISTEN_ADDR, WebhookHandler)
    print(f"webhook receiver listening on {LISTEN_ADDR[0]}:{LISTEN_ADDR[1]}")
    server.serve_forever()
