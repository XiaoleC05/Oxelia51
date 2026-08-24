# 架构文档

**更新**：2026-08-25

本目录承载 v4 现行架构文档（从代码反向核实撰写），替代 `docs/archive/` 下 v3 历史快照（1–6 号）。

| 篇目 | 内容 |
|------|------|
| [overview.md](overview.md) | 总体架构：子系统拓扑、双云部署、数据流总图、CI/CD 管线、阅读地图 |
| [web.md](web.md) | Web 应用（web/ + packages/shared/）：路由、tRPC、认证、数据访问、构建部署 |
| [backend.md](backend.md) | Go 管理后台（backend/）：API 四档权限、安全设计、运维通道 |
| [proxy-gateway.md](proxy-gateway.md) | 代理网关（proxy-gateway/）：双模式、转发与计价链路、落账与自愈 |
| [analytics.md](analytics.md) | 分析引擎（analytics/）：Step 1–8 流水线、游标幂等、告警外发 |
| [desktop.md](desktop.md) | 桌面应用（desktop/）：Tauri 壳、proxyctl 方案 C、双窗口、UI 结构 |
| [data-flow.md](data-flow.md) | 端到端数据流与存储：四库三机、事件生命周期、同步协议、迁移治理 |

历史参考（v3 快照，与现状有偏差）：[docs/archive/3-architecture.md](../archive/3-architecture.md)、[docs/archive/4-detailed-design.md](../archive/4-detailed-design.md)。
