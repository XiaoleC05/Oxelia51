#!/usr/bin/env bash
# =============================================
#  Oxelia51 v3.0 — Langfuse 腾讯云部署
#  用途：安装 | 启动 | 停止 | 日志 | 状态
#  用法：bash langfuse-deploy.sh <command>
# =============================================
set -euo pipefail

COMPOSE_FILE="/opt/langfuse/docker-compose.langfuse.yml"
ENV_FILE="/opt/langfuse/.env"
PROJECT_NAME="langfuse"

die() { echo "[ERROR] $*" >&2; exit 1; }
info() { echo "[INFO]  $*"; }

cd /opt/langfuse 2>/dev/null || die "目录 /opt/langfuse 不存在，请先运行 install"

case "${1:-}" in
  install)
    info "首次安装 Langfuse 到 /opt/langfuse..."

    # 创建目录
    mkdir -p /opt/langfuse

    # 检查 compose 文件
    if [ ! -f "$COMPOSE_FILE" ]; then
      die "未找到 $COMPOSE_FILE，请先从仓库复制"
    fi

    # 生成 .env
    if [ -f "$ENV_FILE" ]; then
      info ".env 已存在，跳过生成"
    else
      info "生成 .env 密钥..."
      cat > "$ENV_FILE" << EOF
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=postgres
CLICKHOUSE_USER=clickhouse
CLICKHOUSE_PASSWORD=$(openssl rand -hex 16)
REDIS_AUTH=$(openssl rand -hex 16)
MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=$(openssl rand -hex 16)
SALT=$(openssl rand -hex 16)
ENCRYPTION_KEY=$(openssl rand -hex 32)
NEXTAUTH_SECRET=$(openssl rand -hex 32)
NEXTAUTH_URL=http://localhost:3000
LANGFUSE_INIT_ORG_NAME=Oxelia51
LANGFUSE_INIT_PROJECT_NAME=default
LANGFUSE_INIT_USER_EMAIL=admin@oxelia51.com
LANGFUSE_INIT_USER_NAME=admin
LANGFUSE_INIT_USER_PASSWORD=$(openssl rand -hex 12)
EOF
      info ".env 已生成 → $ENV_FILE"
      info "管理员初始密码: $(grep LANGFUSE_INIT_USER_PASSWORD $ENV_FILE | cut -d= -f2)"
    fi

    # 拉取镜像
    info "拉取 Docker 镜像（可能需要几分钟）..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull

    info "安装完成。运行 'bash $0 start' 启动服务。"
    ;;

  start)
    info "启动 Langfuse..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -p "$PROJECT_NAME" up -d
    info "等待健康检查（约 30-60 秒）..."
    sleep 5
    bash "$0" status
    ;;

  stop)
    info "停止 Langfuse..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -p "$PROJECT_NAME" stop
    info "已停止"
    ;;

  restart)
    info "重启 Langfuse..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -p "$PROJECT_NAME" restart
    sleep 5
    bash "$0" status
    ;;

  down)
    echo "⚠ 此操作将删除容器（数据卷保留）。"
    echo "   如需完全删除数据，请手动执行: docker volume rm langfuse_..."
    read -rp "确认继续? [y/N] " confirm
    [ "${confirm,,}" = "y" ] || { echo "已取消"; exit 0; }
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -p "$PROJECT_NAME" down
    info "容器已删除，数据卷保留"
    ;;

  status)
    info "容器状态:"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -p "$PROJECT_NAME" ps 2>/dev/null || {
      info "服务未运行"
      exit 1
    }
    echo ""
    info "健康检查:"
    curl -sf http://127.0.0.1:3000/api/public/health 2>/dev/null \
      && echo "  langfuse-web ✅" \
      || echo "  langfuse-web ❌"
    curl -sf http://127.0.0.1:8123/ping 2>/dev/null \
      && echo "  clickhouse   ✅" \
      || echo "  clickhouse   ❌"
    ;;

  logs)
    shift || true
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -p "$PROJECT_NAME" logs -f --tail="${1:-100}" "${@:2}"
    ;;

  stats)
    docker stats --no-stream \
      langfuse-postgres \
      langfuse-redis \
      langfuse-clickhouse \
      langfuse-minio \
      langfuse-worker \
      langfuse-web 2>/dev/null || info "容器未全部运行"
    ;;

  *)
    echo "用法: $0 <command>"
    echo ""
    echo "命令:"
    echo "  install   首次安装（生成 .env + 拉取镜像）"
    echo "  start     启动全部容器"
    echo "  stop      停止全部容器"
    echo "  restart   重启全部容器"
    echo "  down      删除容器（保留数据）"
    echo "  status    查看状态 + 健康检查"
    echo "  logs [N]  查看日志（默认 100 行，可指定行数）"
    echo "  stats     查看容器资源使用"
    exit 1
    ;;
esac
