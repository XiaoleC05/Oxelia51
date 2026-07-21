# Oxelia51 服务器架构方案

**原则**：分层 · 单一职责 · 无状态 · 水平扩展 · 服务隔离 · 高可用 · 安全 · 可观测 · 自动化

---

## 一、十项原则落地

| 原则 | 当前问题 | 改进方案 |
|------|---------|---------|
| **分层** | 所有服务平铺在 `/opt/` 下，无层次 | 四层：边缘→应用→数据→支撑 |
| **单一职责** | 阿里云服务器承载全部 10+ 服务 | 每服务一个 systemd unit，独立日志 |
| **无状态** | session 在 Redis，OK | 确保所有服务重启不丢数据（已在 Redis/PostgreSQL） |
| **水平扩展** | 单机瓶颈 | 腾讯云作为热备节点，关键服务双实例 |
| **服务隔离** | 一个服务 OOM 影响全局 | systemd memory limit + 独立用户运行 |
| **高可用** | 腾讯云几乎闲置 | 腾讯云运行 PostgreSQL 只读副本 + health-server |
| **安全** | 公网暴露 443/80 | 最小暴露面：仅 443，SSH 仅 Workbench。IP 白名单保护 `/api/admin/*`，管理员在后台管理 |
| **配置分离** | `.env` 文件在服务器上，OK | 补充 `.env.example` 模板 + 部署时注入 |
| **可观测** | slog 日志已结构化 | 补充 health-check 定时脚本 + 告警 |
| **自动化** | GitHub Actions 已有，OK | 补充零停机重启（graceful shutdown） |

---

## 二、四层架构

```
┌─────────────────────────────────────────────────────┐
│ 第一层：边缘                                        │
│ Nginx（SSL 终止 / 静态文件 / 限流 / 路由）            │
│ 阿里云 :443 → 分发到各服务                            │
├─────────────────────────────────────────────────────┤
│ 第二层：应用                                        │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│ │ Oxelia51 │ │ SmartKB  │ │ SuperRead│ ... 共 6 个  │
│ │ :8080    │ │ :8007    │ │ :8002    │             │
│ └──────────┘ └──────────┘ └──────────┘             │
│ ┌──────────┐ ┌──────────┐                          │
│ │ remoteshell│ │ NapCat  │                          │
│ │ :8088    │ │ QQ Bot  │                          │
│ └──────────┘ └──────────┘                          │
├─────────────────────────────────────────────────────┤
│ 第三层：数据                                        │
│ ┌──────────┐ ┌──────────┐                          │
│ │PostgreSQL│ │  Redis   │                          │
│ │ :5432    │ │ :6379    │                          │
│ └──────────┘ └──────────┘                          │
├─────────────────────────────────────────────────────┤
│ 第四层：支撑                                        │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│ │ Actions  │ │ 健康检查  │ │ 日志收集  │             │
│ │ Runner   │ │ 定时脚本  │ │ systemd   │             │
│ └──────────┘ └──────────┘ └──────────┘             │
└─────────────────────────────────────────────────────┘
```

---

## 三、双服务器分工

| 服务器 | 服务 | 角色 |
|--------|------|------|
| **阿里云** 47.108.202.199 | Nginx, Oxelia51 API, NapCat QQ Bot, remoteshell | **主节点**（用户请求入口） |
| 阿里云 | PostgreSQL, Redis, Actions Runner | 数据 + CI/CD |
| 阿里云 | DormGuard, SmartKB | 主节点工具服务 |
| **腾讯云** 118.25.138.177 | health-server :8090 | 健康检查端点 |
| 腾讯云 | SuperRead, AIHelper, AgentCanvas, SecretStore | **从节点**（工具服务分流） |

**原则**：
- 阿里云承载用户面（API + 数据库 + QQ Bot）
- 腾讯云承载工具面（计算密集的四个工具），减轻阿里云 2C2G 压力
- 两服各运行 health-server，互相监控

---

## 四、单服务标准化

每个服务使用统一的 systemd unit 模板：

```ini
# /etc/systemd/system/oxelia51-backend.service
[Unit]
Description=Oxelia51 API Server
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=oxelia51
WorkingDirectory=/opt/Oxelia51/backend
ExecStart=/opt/Oxelia51/backend/oxelia51-server
Restart=always
RestartSec=5
MemoryMax=512M
CPUQuota=200%
LimitNOFILE=65536
StandardOutput=journal
StandardError=journal
SyslogIdentifier=oxelia51-api
EnvironmentFile=/opt/Oxelia51/backend/.env

[Install]
WantedBy=multi-user.target
```

关键字段：
- `MemoryMax`：限制内存，防 OOM 扩散
- `Restart=always`：崩溃自动恢复
- `EnvironmentFile`：配置与代码分离
- `StandardOutput=journal`：日志进 systemd journal

---

## 五、健康检查 + 可观测

### 5.1 定时健康检查脚本

```bash
#!/bin/bash
# /opt/Oxelia51/deploy/monitor/healthcheck.sh
# crontab: */5 * * * *

ENDPOINTS=(
  "https://oxelia51.com/api/health"
  "http://127.0.0.1:8007/api/health"   # SmartKB
  "http://127.0.0.1:8002/api/health"   # SuperRead
  "http://118.25.138.177:8090/health"  # Tencent
)

for url in "${ENDPOINTS[@]}"; do
  if ! curl -sf --max-time 10 "$url" > /dev/null; then
    echo "[$(date -Is)] FAIL $url" >> /var/log/healthcheck.log
    # 可选：发告警（邮件/webhook）
  fi
done
```

### 5.2 日志

- 所有服务日志通过 systemd journal 收集
- `journalctl -u oxelia51-backend --since "10 min ago"` 快速排查
- slog JSON 格式输出，可直接用 `jq` 解析

### 5.3 监控面板

管理后台 `/admin` 已有双服务器 CPU/内存/磁盘监控面板（`GET /api/admin/server-stats`）。

---

## 六、安全

| 层面 | 措施 |
|------|------|
| 网络 | 仅 443 对外，22 仅 Workbench。工具端口（8000-8007）仅 loopback |
| 传输 | SSL/TLS 全站，HSTS 头 |
| 认证 | JWT + HMAC 网关签名，Authorization 不转发到上游 |
| 隔离 | 每个工具独立 systemd unit，独立用户运行 |
| 限流 | 注册 3次/小时/IP，登录 10次/15分钟/IP |
| 日志 | 无敏感信息（密码不记录），结构化输出 |

---

## 七、部署流程

```
本地 git push master
  ↓
GitHub Actions（build-test job）
  ├── go vet + test
  ├── GOOS=linux 交叉编译 oxelia51-server
  └── npm build → frontend-dist
  ↓
打包 tarball → push release 分支
  ↓
服务器 webhook 检测 release 更新
  ↓
apply-release.sh
  ├── 停止旧服务（graceful：SIGTERM → 等待 → SIGKILL）
  ├── 替换二进制 + 前端 dist
  ├── 启动新服务
  └── health-check（curl localhost:8080/api/health，最多重试 5 次）
  ↓
若健康检查失败 → 自动回滚到上一版本
```

---

## 八、扩容路径

| 阶段 | 操作 | 成本 |
|------|------|------|
| 当前 | 双服分工，服务隔离 | 0 |
| 增长 1 | 阿里云升配 4C8G，PostgreSQL 迁移到腾讯云 | ~200/月 |
| 增长 2 | 腾讯云新增 PostgreSQL 副本 + Redis 集群 | ~300/月 |
| 增长 3 | 加第三台服务器做负载均衡（Nginx → upstream 多节点） | ~200/月 |

---

## 九、执行清单

| # | 操作 | 负责 |
|:--:|------|:--:|
| 1 | 为每个服务创建独立 systemd unit（加 memory limit） | Claude |
| 2 | 工具服务（SuperRead/AIHelper/AgentCanvas/SecretStore）迁移到腾讯云 | Claude |
| 3 | 腾讯云部署 health-server 互相监控 | Claude |
| 4 | 部署定时健康检查脚本（cron） | Claude |
| 5 | `apply-release.sh` 加 graceful shutdown + health-check + 回滚 | Claude |
| 6 | 安全审计：端口暴露面、服务用户权限 | Claude |
| 7 | 压力测试：wrk 对关键 API 做基准测试 | Qoder |
