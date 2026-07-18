#!/usr/bin/env python3
"""Oxelia51 GitHub webhook receiver.

监听 127.0.0.1:9000，验证 HMAC-SHA256 签名，
在 push 到 release 分支时触发相应的部署脚本。

支持多仓库：
  - XiaoleC05/Oxelia51 → 主平台 deploy.sh
  - 工具仓库 → tool-deploy.sh <tool-name>

环境变量：
  WEBHOOK_SECRET  - GitHub webhook 密钥（必填）
  DEPLOY_SCRIPT   - 主平台部署脚本路径（默认 /opt/Oxelia51/deploy/webhook/deploy.sh）
  TOOL_DEPLOY_SCRIPT - 工具部署脚本路径（默认 /opt/Oxelia51/deploy/webhook/tool-deploy.sh）
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
TOOL_DEPLOY_SCRIPT = os.environ.get("TOOL_DEPLOY_SCRIPT", "/opt/Oxelia51/deploy/webhook/tool-deploy.sh")
LISTEN_ADDR = ("127.0.0.1", 9000)
TRIGGER_REF = "refs/heads/release"

# Repo → tool-name mapping (工具仓库 fully-qualified name → service name on server)
TOOL_REPOS = {
    "XiaoleC05/DormGuard":    "dormguard",
    "XiaoleC05/SuperRead":    "superread",
    "XiaoleC05/AIHelper":     "aihelper",
    "XiaoleC05/AgentCanvas":  "agentcanvas",
    "XiaoleC05/SecretStore":  "secretstore",
}


def verify_signature(body: bytes, sig_header: str) -> bool:
    if not SECRET or not sig_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig_header, expected)


def trigger_deploy(script: str, *args: str):
    """后台执行部署脚本，输出写入日志"""
    log_file = "/var/log/oxelia51-webhook-deploy.log"
    cmd = ["bash", script] + list(args)
    subprocess.Popen(
        cmd,
        stdout=open(log_file, "a"),
        stderr=subprocess.STDOUT,
    )


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

        repo = payload.get("repository", {}).get("full_name", "")

        if repo == "XiaoleC05/Oxelia51":
            # 主平台部署
            trigger_deploy(DEPLOY_SCRIPT)
            self._respond(200, b"platform deploy triggered\n")

        elif repo in TOOL_REPOS:
            tool_name = TOOL_REPOS[repo]
            trigger_deploy(TOOL_DEPLOY_SCRIPT, tool_name, repo)
            self._respond(200, f"tool deploy triggered: {tool_name}\n".encode())

        else:
            self._respond(200, f"unknown repo: {repo}\n".encode())

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
        print("error: WEBHOOK_SECRET not set", file=sys.stderr)
        sys.exit(1)
    server = HTTPServer(LISTEN_ADDR, WebhookHandler)
    print(f"webhook receiver listening on {LISTEN_ADDR[0]}:{LISTEN_ADDR[1]}")
    server.serve_forever()
