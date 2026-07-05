#!/usr/bin/env bash
# 生成自签证书并启用 HTTPS（备案关 DNS 期间的临时方案）
# 用法：bash setup-ssl.sh
set -euo pipefail

echo "=== 1. 生成自签证书 ==="
mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/selfsigned.key \
    -out /etc/nginx/ssl/selfsigned.crt \
    -subj "/CN=47.108.202.199" \
    -addext "subjectAltName=IP:47.108.202.199" 2>/dev/null || \
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/selfsigned.key \
    -out /etc/nginx/ssl/selfsigned.crt \
    -subj "/CN=47.108.202.199"
chmod 600 /etc/nginx/ssl/selfsigned.key
echo "证书已生成: /etc/nginx/ssl/selfsigned.crt"

echo "=== 2. 安装 HTTPS nginx 配置 ==="
cp /opt/Oxelia51-src/deploy/nginx/default-ip-ssl.conf /etc/nginx/sites-available/default-ip-ssl
ln -sf /etc/nginx/sites-available/default-ip-ssl /etc/nginx/sites-enabled/default-ip-ssl

echo "=== 3. 测试 nginx 配置 ==="
nginx -t

echo "=== 4. 重载 nginx ==="
systemctl reload nginx

echo "=== 5. 验证 ==="
curl -sk https://127.0.0.1/api/health 2>/dev/null && echo "" || echo "(后端可能还在启动)"
echo ""
echo "=== 完成 ==="
echo "现在可以通过 https://47.108.202.199 访问（浏览器会提示证书不受信任，点「继续」即可）"
echo "密码将通过加密传输，不再触发「密码暴露」警告"
echo ""
echo "注意：80 端口（HTTP + webhook）仍然保留，webhook 不受影响"
