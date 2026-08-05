# 待办队列（按优先级）

> 更新：2026-08-05

## P0（紧急）
- [ ] （无）

## P1（高）
- [ ] 回归验证后台管理功能（IP 白名单、电费拉取、双列布局——需登录浏览器测试）

## P2（预防性维护）
- [ ] ClickHouse IPv6 监听 DNS 警告（listen_host ::1 在容器内报错刷 err.log）——加 config.d 覆盖文件禁用 ::1
- [ ] Docker 日志轮转配置（logging: json-file + max-size）——根治日志撑爆磁盘
- [ ] Langfuse 容器内存/CPU limits
- [ ] ClickHouse native TLS（跨云写入加密）
- [ ] 磁盘扩容评估（长期：Hermes 已删，当前 44% 可用）

## P3（开发）
- [ ] （无紧急项）

## P4-P6（优化）
- [ ] 服务器架构优化（评估单云整合）
