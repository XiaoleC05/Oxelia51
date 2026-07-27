#!/usr/bin/env bash
# =============================================
#  Oxelia51 v3.0 — Go 代理网关部署（阿里云）
#  从 release 分支拉取编译好的二进制并部署
#  用法：由 webhook 自动触发 或 手动执行
# =============================================
set -euo pipefail

APP_DIR="/opt/oxelia51/proxy"
ENV_FILE="$APP_DIR/.env"
SERVICE_NAME="token-proxy"
HEALTH_URL="http://127.0.0.1:9090/api/proxy/status"

die() { echo "[ERROR] $*" >&2; exit 1; }
info() { echo "[INFO]  $*"; }

# ---- 首次安装 ----
do_install() {
    info "首次安装 Go 代理网关..."

    mkdir -p "$APP_DIR"

    # 生成默认 .env
    if [ ! -f "$ENV_FILE" ]; then
        cat > "$ENV_FILE" << 'EOF'
# Go 代理网关配置
PROXY_PORT=9090
# ClickHouse 写入目标 — v3.0 时改为腾讯云内网地址
CLICKHOUSE_ADDR=118.25.138.177:9000
CLICKHOUSE_USER=clickhouse
CLICKHOUSE_PASSWORD=CHANGEME
CLICKHOUSE_DATABASE=oxelia51
# 日志级别: debug | info | warn | error
LOG_LEVEL=info
EOF
        info ".env 模板已创建 → $ENV_FILE"
        info "请编辑 .env 填入 ClickHouse 密码后重新部署"
    fi

    # 安装 systemd 服务
    cp /opt/Oxelia51/deploy/systemd/token-proxy.service /etc/systemd/system/
    systemctl daemon-reload

    info "首次安装完成。"
    info "请确保 Go 二进制已放置到 $APP_DIR/proxy-server"
    info "然后执行: systemctl enable --now $SERVICE_NAME"
}

# ---- 部署更新 ----
do_deploy() {
    info "部署 Go 代理网关..."

    # 检查二进制
    [ -f "$APP_DIR/proxy-server" ] || die "未找到 $APP_DIR/proxy-server"

    chmod +x "$APP_DIR/proxy-server"

    # 更新 systemd 配置
    cp /opt/Oxelia51/deploy/systemd/token-proxy.service /etc/systemd/system/
    systemctl daemon-reload

    # 更新 Nginx 配置
    if [ -f /opt/Oxelia51/deploy/nginx/proxy-gateway.conf ]; then
        cp /opt/Oxelia51/deploy/nginx/proxy-gateway.conf /opt/Oxelia51/deploy/nginx/proxy-gateway.conf.bak 2>/dev/null || true
    fi

    # 重启服务
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        systemctl restart "$SERVICE_NAME"
    else
        systemctl enable --now "$SERVICE_NAME"
    fi

    # 重载 Nginx（新配置）
    nginx -t && systemctl reload nginx

    # 健康检查
    sleep 2
    info "健康检查..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        info "代理网关 ✅ (HTTP $HTTP_CODE)"
    else
        info "代理网关 ⚠ (HTTP $HTTP_CODE)，请检查日志: journalctl -u $SERVICE_NAME -n 20"
    fi
}

# ---- 状态 ----
do_status() {
    echo "=== 服务状态 ==="
    systemctl status "$SERVICE_NAME" --no-pager 2>/dev/null || echo "  服务未安装"
    echo ""
    echo "=== 健康检查 ==="
    curl -s "$HEALTH_URL" 2>/dev/null || echo "  健康检查失败"
}

# ---- 主入口 ----
case "${1:-}" in
    install) do_install ;;
    deploy)  do_deploy ;;
    status)  do_status ;;
    restart) systemctl restart "$SERVICE_NAME" ;;
    logs)    journalctl -u "$SERVICE_NAME" -n "${2:-50}" -f ;;
    *)
        echo "用法: $0 <command>"
        echo "  install  首次安装（创建目录 + .env + systemd）"
        echo "  deploy   部署更新（重启服务 + 重载 Nginx + 健康检查）"
        echo "  status   查看状态"
        echo "  restart  重启服务"
        echo "  logs [N] 查看日志"
        ;;
esac
