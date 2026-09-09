# 待办队列（按优先级）

> 更新：2026-09-09

## P0（紧急）

- [ ] （无）

## P1（高）

- [ ] 配置 GitHub repo secret `UMAMI_WEBSITE_ID` 并手动 workflow_dispatch 重建 web 镜像（umami 统计生效，见 deploy/umami/README.md §6）
- [ ] 产品开放注册后的浏览器回归：注册（邮箱验证码，自动加入默认组织/项目并直跳 /app）→ 代理接入生成密钥 → 接入验证
- [ ] 代理网关鉴权模式由 `optional` 切 `required`（待现有客户端全部迁移到项目密钥后）
- [ ] 回归验证后台管理功能（IP 白名单、网关状态、告警通道配置——需登录浏览器测试）

## P2（预防性维护）

- [ ] 生产观察期：web 并入主仓 + worker 停跑后观察一轮（资源占用、同步链路、告警邮件）
- [ ] ClickHouse IPv6 监听 DNS 警告（listen_host ::1 在容器内报错刷 err.log）——加 config.d 覆盖文件禁用 ::1
- [ ] 磁盘监控：ClickHouse 系统日志表（trace_log/text_log/part_log 等，曾膨胀至 20G+ 吃满磁盘）已全部设 7 天 TTL，持续观察回收效果；关注 weekly backup + 镜像累积

## P3（开发）

- [ ] 计量计费 / 配额（用量超限控制）
- [ ] 自托管文档缺口：faq 已改为「暂不支持一键自托管」，后续视需求补自托管部署指南

## P4-P6（优化）

- [ ] 服务器架构优化（评估单云整合，见 SINGLE_CLOUD_MIGRATION.md）

## 已完成（2026-08-06 归档）

- [x] Docker 日志轮转配置（logging: json-file + max-size 50m×3）——已随 compose 应用
- [x] Langfuse 容器内存/CPU limits（web 2.5G / ch 1G / worker 512M）——已应用
- [x] ClickHouse 跨云写入加密——已确认经 SSH 隧道（native TCP 9001→9000），无需额外 TLS
- [x] 告警 alerter 部署（token-analytics + 5min timer）——2026-08-06 上线，端到端邮件验证通过
- [x] Git 仓库瘦身 + 服务器冗余清理——2026-08-06
- [x] 面向用户的使用文档站（接入教程、FAQ、定价页）——已上线（web/src/content/docs/ 10 篇）

## 已完成（2026-09-09 归档）

- [x] langfuse 残余清理 + 服务器瘦身——腾讯云删除 langfuse-minio / langfuse-redis 容器与数据卷、langfuse-worker / minio / redis 镜像（约 1.9GB）、compose .bak×3、.env 死变量（REDIS_AUTH / MINIO_ROOT_*）；compose 收敛为 3 容器（postgres / clickhouse / web），web 重建后健康检查、ClickHouse、分析引擎、外网访问全部验证通过；阿里云侧无 langfuse 残余（镜像全部在用）
- [x] 两台服务器 ollama 完全删除——SmartKB 试验期遗留，生产无任何连接/调用；停用并删除服务、二进制、systemd unit、ollama 用户/组；腾讯云删 /root/.ollama（含 qwen2.5:1.5b，释放约 3GB 磁盘），阿里云删 /usr/share/ollama；11434 端口已释放，外网 200 验证通过
- [x] 阿里云 napcat 删除（290MB）——无进程无服务，纯遗留；**MySQL 经核实为 DormGuard 硬依赖（database.py 硬编码 mysql+pymysql），裁定保留**

## 已完成（2026-08-21 归档）

- [x] ClickHouse 容器内存 1G → 2G（analytics 聚合积压需 ~1.5G）——已应用
- [x] langfuse-worker 停跑——仅服务已删的 tracing 功能，compose 定义已移除
- [x] web 前端并入主仓 + 两轮死代码大扫除（shared 删约 1.6 万行、web 删 58 个零引用文件）
- [x] GitHub Releases 清理
