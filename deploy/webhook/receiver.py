#!/usr/bin/env python3
"""Oxelia51 GitHub webhook receiver.

监听 127.0.0.1:9000，验证 HMAC-SHA256 签名，
在 GitHub Release published 时触发部署脚本。

支持多仓库：
  - XiaoleC05/Oxelia51 → 主平台 deploy.sh <tarball_url>
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

# 工具仓库 mapping
TOOL_REPOS = {
    "XiaoleC05/DormGuard":    "dormguard",
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

        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self._respond(400, b"invalid json\n")
            return

        if event == "release":
            action = payload.get("action", "")
            if action != "published":
                self._respond(200, f"ignored: release {action}\n".encode())
                return

            repo = payload.get("repository", {}).get("full_name", "")

            if repo == "XiaoleC05/Oxelia51":
                assets = payload.get("release", {}).get("assets", [])
                if not assets:
                    self._respond(500, b"no assets in release\n")
                    return
                tarball_url = assets[0]["browser_download_url"]
                trigger_deploy(DEPLOY_SCRIPT, tarball_url)
                self._respond(200, b"platform deploy triggered\n")

            elif repo in TOOL_REPOS:
                tool_name = TOOL_REPOS[repo]
                trigger_deploy(TOOL_DEPLOY_SCRIPT, tool_name, repo)
                self._respond(200, f"tool deploy triggered: {tool_name}\n".encode())

            else:
                self._respond(200, f"unknown repo: {repo}\n".encode())

        elif event == "push":
            ref = payload.get("ref", "")
            repo = payload.get("repository", {}).get("full_name", "")

            if ref == "refs/heads/master":
                self._respond(200, b"ignored: push to master, deploy via release\n".encode())
            elif repo in TOOL_REPOS:
                tool_name = TOOL_REPOS[repo]
                trigger_deploy(TOOL_DEPLOY_SCRIPT, tool_name, repo)
                self._respond(200, f"tool deploy triggered: {tool_name}\n".encode())
            else:
                self._respond(200, f"ignored: {ref}\n".encode())

        else:
            self._respond(200, f"ignored: {event}\n".encode())

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
