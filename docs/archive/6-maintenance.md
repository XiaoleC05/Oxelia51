# 维护与服务器

**项目**：oxelia51.com | **版本**：3.0.0 | **日期**：2026-07-27

---

## 1. 服务器信息

### 1.1 主机清单

| 属性 | 阿里云 | 腾讯云 |
|------|--------|--------|
| 公网 IP | 47.108.202.199 | 118.25.138.177 |
| 配置 | 2C2G 40GB | 4C4G 40GB |
| 系统 | Alibaba Cloud Linux 3 | Ubuntu 24.04 |
| SSH | Workbench（22 不对外） | Workbench（22 不对外） |
| 运行服务 | Nginx, Go 代理 :9090, Go 管理后台 :8080, Webhook :9000 | Docker: Langfuse (6 容器) + SmartKB, C++ 引擎 (计划) |

### 1.2 端口清单

#### 阿里云 (47.108.202.199)

| 端口 | 绑定 | 服务 | 对外 |
|:--:|------|------|:--:|
| 80/443 | 0.0.0.0 | Nginx | ✅ |
| 9090 | 127.0.0.1 | Go 代理网关 | ❌ |
| 8080 | 127.0.0.1 | Go 管理后台 | ❌ |
| 9000 | 127.0.0.1 | Webhook 接收器 | ❌ |

#### 腾讯云 (118.25.138.177)

| 端口 | 绑定 | 服务 | 对外 |
|:--:|------|------|:--:|
| 80 | 0.0.0.0 | Nginx → Langfuse Web | ✅ |
| 3000 | 127.0.0.1 | Langfuse Web | ❌ |
| 3030 | 127.0.0.1 | Langfuse Worker | ❌ |
| 8123 | 127.0.0.1 | ClickHouse HTTP | ❌ |
| 9000 | 127.0.0.1 | ClickHouse Native | ❌ |
| 9009 | — | ClickHouse 内部 | ❌ |
| 5433 | 127.0.0.1 | SmartKB PostgreSQL | ❌ |
| 5434 | 127.0.0.1 | Langfuse PostgreSQL | ❌ |
| 6379 | 127.0.0.1 | Langfuse Redis | ❌ |
| 9090 | 127.0.0.1 | MinIO S3 | ❌ |
| 9091 | 127.0.0.1 | MinIO Console | ❌ |
| 8007 | 127.0.0.1 | SmartKB API | ❌ |

---

## 2. 日常运维命令

### 2.1 阿里云

```bash
# 服务状态
systemctl status nginx
systemctl status token-proxy            # Go 代理
systemctl status oxelia51-backend       # 管理后台
systemctl status oxelia51-webhook       # Webhook 接收器

# 查看日志（近 100 行 + 实时跟踪）
journalctl -u token-proxy -n 100 -f
journalctl -u oxelia51-backend -n 100 -f
journalctl -u oxelia51-webhook -n 100 -f

# Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# 部署日志
tail -f /var/log/oxelia51-webhook-deploy.log

# 重启服务
systemctl restart token-proxy
systemctl restart oxelia51-backend
systemctl reload nginx                     # 无中断重载配置
```

### 2.2 腾讯云

```bash
cd /opt/langfuse

# 容器状态
docker compose -f docker-compose.langfuse.yml --env-file .env -p langfuse ps

# 容器日志
docker compose -f docker-compose.langfuse.yml --env-file .env -p langfuse logs -f --tail=100 langfuse-web

# 重启单个容器
docker compose -f docker-compose.langfuse.yml --env-file .env -p langfuse restart langfuse-web

# 全部重启
docker compose -f docker-compose.langfuse.yml --env-file .env -p langfuse down
docker compose -f docker-compose.langfuse.yml --env-file .env -p langfuse up -d

# 或使用管理脚本
bash langfuse-deploy.sh status
bash langfuse-deploy.sh logs
bash langfuse-deploy.sh restart

# Docker 镜像加速器
cat /etc/docker/daemon.json
# {"registry-mirrors":["https://mirror.ccs.tencentyun.com","https://docker.1ms.run"]}

# C++ 引擎（计划部署）
# systemctl status token-analytics
# journalctl -u token-analytics -n 50 -f
```

### 2.3 数据库

```bash
# ClickHouse — 客户端连接
clickhouse-client -u clickhouse --password "$CH_PASS"

# 查今日 Token 总量
clickhouse-client --query "
  SELECT sum(total_tokens), sum(cost_usd), count()
  FROM oxelia51.token_events
  WHERE toDate(timestamp) = today()"

# 查表大小
clickhouse-client --query "
  SELECT table,
         formatReadableSize(sum(bytes_on_disk)) AS size,
         sum(rows) AS rows
  FROM system.parts
  WHERE database = 'oxelia51'
  GROUP BY table"

# PostgreSQL — 客户端连接（Langfuse PG 在 5434，SmartKB PG 在 5433）
psql -h localhost -p 5434 -U postgres -d postgres   # Langfuse
psql -h localhost -p 5433 -U postgres -d postgres   # SmartKB

# 查看近期告警
psql -c "SELECT * FROM oxelia51.alert_logs ORDER BY created_at DESC LIMIT 20"
```

---

## 3. 故障排查 Runbook

### 3.1 用户反馈「仪表盘没有数据」

```
阿里云操作：
1. 检查 Go 代理是否在记录
   journalctl -u token-proxy --since "5 min ago" | grep "recorded"
   预期：约 1 条/秒 "recorded" 日志
   若 0 条 → Go 代理未收到请求，检查 Nginx 转发

腾讯云操作：
2. 检查 ClickHouse 是否有数据
   clickhouse-client --query "SELECT count() FROM oxelia51.token_events WHERE timestamp >= now() - INTERVAL 5 MINUTE"
   预期：> 0
   若 0 → Go 代理写入失败，检查腾讯云 ClickHouse 是否可达

3. 检查 Langfuse Web 是否可访问
   curl http://127.0.0.1:3000/api/public/health
   预期：200 OK
   若失败 → docker compose -f /opt/langfuse/docker-compose.langfuse.yml --env-file /opt/langfuse/.env -p langfuse ps langfuse-web
```

### 3.2 用户反馈「代理返回 502」

```
1. 检查上游 LLM 是否可达
   curl -I https://api.anthropic.com
   预期：200 或 401（无 API Key 的正常拒绝）
   若超时/连接拒绝 → 检查服务器出网是否正常

2. 检查 Go 代理是否在运行
   systemctl status token-proxy
   若 dead → systemctl start token-proxy

3. 检查 Go 代理日志
   journalctl -u token-proxy --since "1 min ago" | grep -i "error\|upstream\|unavailable"
   常见错误：
   - "upstream unavailable" → LLM API 真的挂了
   - "context deadline exceeded" → 超时，LLM 响应太慢
   - "missing X-Project-ID" → 用户没配 Project ID
```

### 3.3 用户反馈「网页打不开 / 加载很慢」

```
阿里云操作：
1. 检查 Nginx
   systemctl status nginx
   curl -o /dev/null -w "%{http_code}" https://oxelia51.com
   预期：200

2. 检查 Tencent 云是否可达
   curl -m 5 http://118.25.138.177/api/public/health
   预期：{"status":"OK","version":"..."}
   若超时 → 检查腾讯云安全组/防火墙是否放行阿里云 IP

腾讯云操作：
3. 检查 Langfuse Web 容器
   cd /opt/langfuse
   docker compose -f docker-compose.langfuse.yml --env-file .env -p langfuse ps langfuse-web
   预期：Up
   若 Restarting → docker logs langfuse-web 查原因
```

### 3.4 服务器磁盘满

```bash
# 定位大文件
du -sh /* 2>/dev/null | sort -rh | head -20

# Docker 清理
docker system prune -a -f --volumes  # 删除所有未使用的镜像/容器/卷（谨慎！）

# 日志清理
journalctl --vacuum-size=500M
find /var/log -name "*.log" -mtime +30 -delete
```

### 3.5 内存不足

```bash
# 查看内存分布
free -h
docker stats --no-stream
```

> **注意**：Langfuse Web 是 Next.js 应用，启动时会编译大量页面，实际峰值内存可超过 1GB。**不要设置** `mem_limit` 小于 1GB，否则会 OOM。当前配置不设上限，依赖 Docker 自动管理。腾讯云 4G 内存跑 7 个容器（含 SmartKB PG），空闲约 1GB，够用。

---

## 4. 备份与恢复

### 4.1 PostgreSQL（每日自动）

```bash
#!/bin/bash
# crontab: 0 3 * * * /opt/scripts/backup-postgres.sh
DATE=$(date +%Y%m%d)
BACKUP_DIR=/opt/backups/postgres
mkdir -p "$BACKUP_DIR"

pg_dump -h localhost -U postgres postgres | gzip > "$BACKUP_DIR/$DATE.sql.gz"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
echo "backup: $DATE ($(du -h $BACKUP_DIR/$DATE.sql.gz | cut -f1))"
```

### 4.2 ClickHouse（每日自动）

```bash
#!/bin/bash
# crontab: 0 4 * * * /opt/scripts/backup-clickhouse.sh
DATE=$(date +%Y%m%d)
BACKUP_DIR=/opt/backups/clickhouse
mkdir -p "$BACKUP_DIR"

clickhouse-client --query "BACKUP DATABASE oxelia51 TO Disk('backups','$DATE.zip')"
```

### 4.3 恢复

```bash
# PostgreSQL
gunzip -c /opt/backups/postgres/20260727.sql.gz | psql -h localhost -U postgres postgres

# ClickHouse
clickhouse-client --query "RESTORE DATABASE oxelia51 FROM Disk('backups','20260727.zip')"
```

---

## 5. 性能调优

### 5.1 Go 代理网关（阿里云）

```bash
# 调整 GOMAXPROCS（默认 = CPU 核数）
# 2C 服务器，给代理留 1 核，另一个核给 Nginx + OS
# 在 /etc/systemd/system/token-proxy.service 中添加：
Environment=GOMAXPROCS=1

# 调整系统文件描述符限制
# /etc/security/limits.conf
oxelia51 soft nofile 65536
oxelia51 hard nofile 65536
```

### 5.2 ClickHouse（腾讯云）

```bash
# ClickHouse 容器内执行
docker exec -it langfuse-clickhouse clickhouse-client -u clickhouse --password "$CH_PASS"
```

```sql
-- 调整合并线程（4C 机器）
SET max_threads = 4;
SET max_bytes_before_external_group_by = 5000000000;

-- 检查慢查询
SELECT query, elapsed
FROM system.query_log
WHERE type = 'QueryFinish' AND elapsed > 1
ORDER BY elapsed DESC LIMIT 10;
```

### 5.3 PostgreSQL（腾讯云）

```bash
# Langfuse PG 在 5434，SmartKB PG 在 5433
psql -h localhost -p 5434 -U postgres -d postgres
```

```sql
-- 检查索引使用
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

---

## 6. 容量规划

### 6.1 存储监控

ClickHouse 数据量随请求量增长。通过以下查询监控实际增长速度：

```sql
-- 每月数据增量
SELECT toYYYYMM(timestamp) AS month,
       count() AS rows,
       formatReadableSize(sum(bytes_on_disk)) AS size_on_disk
FROM oxelia51.token_events
GROUP BY month ORDER BY month;
```

当前磁盘：阿里云 40GB，腾讯云 40GB。达到 70% 时需扩容。

### 6.2 扩容触发

| 指标 | 阈值 | 操作 |
|------|------|------|
| 磁盘使用 | > 70% | 所在云升配磁盘 |
| Go 代理 CPU | > 80% 持续 5 分钟 | 阿里云升配 CPU |
| 内存使用 | > 3.2GB (80%) | 升配内存 |

---

## 7. 监控

### 7.1 健康检查端点

**阿里云**：
```bash
# Go 代理
curl http://127.0.0.1:9090/api/proxy/status

# 管理后台
curl http://127.0.0.1:8080/api/health

# Webhook 接收器
curl http://127.0.0.1:9000
```

**腾讯云**：
```bash
# Langfuse Web
curl http://127.0.0.1:3000/api/public/health
# {"status":"OK","version":"3.224.1"}

# ClickHouse
curl http://127.0.0.1:8123/ping
# Ok

# 所有容器
docker compose -f /opt/langfuse/docker-compose.langfuse.yml --env-file /opt/langfuse/.env -p langfuse ps
```

### 7.2 定时健康检查脚本

**阿里云** (`/opt/Oxelia51/deploy/monitor/oxelia51-healthcheck.sh`, crontab `*/5 * * * *`):

```bash
#!/bin/bash
checks=(
    "Go 代理:curl -sf http://127.0.0.1:9090/api/proxy/status"
    "管理后台:curl -sf http://127.0.0.1:8080/api/health"
    "Webhook:curl -sf http://127.0.0.1:9000"
    "腾讯云 Langfuse:curl -sf http://118.25.138.177/api/public/health"
)

for check in "${checks[@]}"; do
    name="${check%%:*}"
    cmd="${check#*:}"
    if ! eval "$cmd" > /dev/null 2>&1; then
        echo "[$(date -Iseconds)] FAIL: $name"
    fi
done
```

---

## 8. 安全清单

| 检查项 | 服务器 | 频率 | 命令/方法 |
|------|:--:|:--:|------|
| Nginx 错误日志 | 阿里云 | 每日 | `grep -i "error\|attack\|scan\|inject" /var/log/nginx/error.log` |
| Go 代理鉴权失败 | 阿里云 | 每日 | `journalctl -u token-proxy --since "1 day ago" \| grep -c "missing X-Project-ID"` |
| SSH 登录 | 双机 | 每日 | `last -20` |
| ClickHouse 端口 | 腾讯云 | 每月 | `ss -tlnp \| grep 8123` 确认绑定 127.0.0.1 |
| TLS 证书到期 | 阿里云 | 每月 | `certbot certificates` 或 `openssl s_client -connect oxelia51.com:443` |
| 系统更新 | 双机 | 每月 | `apt upgrade -y`（腾讯云）；`yum update -y`（阿里云） |
| SSH Key 轮换 | 双机 | 每年 | 重新生成 `~/.ssh/oxelia51_deploy`，更新 GitHub Deploy Keys |
| 数据库密码轮换 | 腾讯云 | 每半年 | 更新 `/opt/langfuse/.env` → `docker compose down && up -d` |

---

## 9. 腾讯云初始化

```bash
# 首次在腾讯云服务器执行
scp deploy/tencent-cloud/init-server.sh root@118.25.138.177:/root/
ssh root@118.25.138.177 "bash /root/init-server.sh"

# init-server.sh 包含：
# 1. apt update && apt upgrade
# 2. 安装 Docker + docker-compose
# 3. 配置 UFW 防火墙（仅放行 80/443/22，限制 22 仅阿里云 IP）
# 4. 安装 health-server (Go 编译好的监控采集)
# 5. 配置 systemd health-server 服务
# 6. 创建 /opt/ 目录结构
```
