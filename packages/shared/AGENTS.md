# Oxelia51 `@oxelia51/shared` 包指南

本文件是 `packages/shared` 的本地说明。monorepo 级规则见根目录
[AGENTS.md](../../AGENTS.md)。

## 现状

共享领域/数据库/服务端工具包，被 `web` 消费。已从 langfuse 上游收敛为
Oxelia51 最小集，包名 `@oxelia51/shared`。

## Prisma schema 原则

- `prisma/schema.prisma` 已收敛为 Oxelia51 最小集：NextAuth + 组织/项目 RBAC
  + ApiKey + AuditLog，另保留少量 langfuse 遗留表（Dataset 系列、
  TraceSession、SsoConfig、Survey、CronJobs 等），因为 web 存活代码仍引用。
- `prisma/migrations/` 已有迁移文件一律不动（生产已应用，改动会破坏 checksum 校验）。
- 已从 schema 移除的表仍存在于生产库，属预期。**新增 migration 前必须人工审查
  是否夹带 DROP 语句**，防止误删生产数据。
- 已知坑：迁移 `20260806070003_add_oxelia51_alert_channel_verification` 直接
  `ALTER TABLE oxelia51.alert_channels`（该表由 C++ 分析引擎建管），在全新数据库上
  `prisma migrate deploy` 会因表不存在失败。因文件已被生产应用、改动会破坏
  checksum，**不能修改该迁移文件**；全新部署的变通方法：先手工建空表
  （`CREATE TABLE IF NOT EXISTS oxelia51.alert_channels (...)`，结构见
  `analytics/deploy/migrations/002_analytics_tables.sql`）再跑 migrate deploy。
- 改 schema 后运行 `pnpm --filter @oxelia51/shared run db:generate` 重新生成
  client。

## 保留的服务

`src/server/` 下保留并维护的服务：

- `repositories/` + `../db.ts`：Prisma 数据访问与 ClickHouse 读路径
  （`traces.ts` 只保留 3 个存活读函数，写路径/upsert 已删）
- `auth/`：API key 等认证辅助
- `redis/`：仅 `redis.ts`（+ 其测试；Redis 连接、safeMultiDel、scanKeys）；
  所有 bullmq 队列类与 `queues.ts`/`getQueue.ts` 已随队列功能删除
- `clickhouse/`：ClickHouse client 与迁移
- `queries/clickhouse-sql/`：仅存活的 filter/CTE 查询构建器
  （`clickhouse-filter`、`event-query-builder` 的 CTEQueryBuilder +
  EventsAggregationQueryBuilder、`fts`、`query-fragments` 的
  eventsTracesAggregation）
- `ingestion/`：仅 `ingestionAttribution`（+ 其测试与 types）
- `instrumentation/`：埋点/观测辅助
- `llm/`：仅 `types.ts`
- `utils/`：compareVersions、formatAuthProvider、metadata_conversion、
  rendering、sqlLike 等通用工具
- `filterToPrisma.ts`、`headerPropagation.ts`：散置的存活辅助模块
- `services/email/`：邮件发送（SES/SMTP 传输层 + 存活模板：
  passwordReset、organizationInvitation、feedback、oxelia51 等；
  batchExport/cloudSpendAlert 等遗留模板对应的队列功能已删，视为死代码，
  不要再接入）
- `test-utils/`：测试工厂，不进生产 barrel，经
  `@oxelia51/shared/src/server/test-utils` 子路径仅供测试导入
- `logger.ts`、`../env.ts`：日志与环境变量 schema

已删除模块（勿再引入）：`otel/`、`features/query/`、`llm/` 的
compileChatMessages/internalTraceEvents（`llm/` 仅余 `types.ts`）、
`StorageService`/`s3/`、
`outbound-url/`、`webhooks/`、`sessions-ui-table-*`、`orderByToPrisma`、
`billingCycleHelpers`、`tableMappings/`。

## 构建方式

- `pnpm --filter @oxelia51/shared run build`：纯 `tsc`，输出到 `dist/`。
- `package.json#exports` 全部指向 `dist/` 产物；web 直接消费 dist，
  因此改完本包必须先 build 再构建 web。
- 不要手改 `dist/`、`prisma/generated/`。

## 导出入口

- `@oxelia51/shared`（`src/index.ts`）：前端安全的类型、zod schema、领域常量
- `@oxelia51/shared/src/server`：服务端 barrel
- `@oxelia51/shared/src/db`：Prisma client（不得进客户端 bundle）
- `@oxelia51/shared/src/env`：环境变量 schema
- `@oxelia51/shared/encryption`：加密/签名辅助
- `@oxelia51/shared/src/server/test-utils`：测试工厂（仅测试使用）
- 窄口子路径：`/src/server/auth/apiKeys`、`/src/utils/chatml`

改动导出面时，保持 `package.json#exports`、对应 barrel 文件与本文件同步。

## ClickHouse

- 迁移：`clickhouse/migrations/{clustered,unclustered}/`
- 脚本：`clickhouse/scripts/`（up/down/drop/dev-tables）
- seeder 已删除，`db:seed*`/`ch:seed`/`seed:scenario`/`load:setup` 脚本随之移除；
  `ch:reset` 现为 down → up → dev-tables。

## 维护契约

以下变更需同步更新本文件：schema/migration 工作流、导出入口、保留服务清单、
构建或验证命令。
