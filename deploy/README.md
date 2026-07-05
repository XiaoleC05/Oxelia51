# Oxelia51 生产部署（ADR-006 阶段 2）

## 架构

```text
公网 Nginx (oxelia51.com)
  ├─ /        → /opt/Oxelia51/frontend/dist
  └─ /api/    → 127.0.0.1:8080 (Oxelia51 Go)
                    └─ /api/tools/dormguard/proxy/* → 127.0.0.1:8000 (DormGuard, 网关模式)

DormGuard :8000  — 仅 loopback（MySQL 独立）
NoneBot  :8089  — 释放 8080 给平台
PostgreSQL/Redis — Docker 127.0.0.1
```

## 首次切换（在服务器上）

```bash
# 1. 依赖（若未装 Docker/Nginx）
sudo bash /opt/Oxelia51/deploy/bootstrap-server.sh

# 2. 部署 Oxelia51 发布包（GitHub Actions self-hosted 或手动 tar）
sudo bash /opt/Oxelia51/deploy/ci-deploy.sh /path/to/oxelia51-release.tar.gz
# 若 exit 2：编辑 /opt/Oxelia51/backend/.env 后重跑

# 3. 合并 DormGuard（网关模式 + Nginx 切换）
sudo bash /opt/Oxelia51/deploy/platform-cutover.sh
```

## backend/.env 必填

- `DB_PASSWORD` / `JWT_SECRET` / `ADMIN_INITIAL_PASSWORD`
- `APP_PUBLIC_URL=https://oxelia51.com`
- `LISTEN_ADDR=127.0.0.1:8080`
- `TOOL_API_BASE_DORMGUARD=http://127.0.0.1:8000`

## 登录

- 平台管理者：`oxelia51` + `ADMIN_INITIAL_PASSWORD`
- DormGuard 旧 `root` 独立登录已废弃；业务经 `/tools/dormguard` + 平台 JWT

## 健康检查

```bash
/opt/Oxelia51/deploy/monitor/oxelia51-healthcheck.sh
/opt/DormGuard/deploy/monitor/dormguard-healthcheck.sh
```
