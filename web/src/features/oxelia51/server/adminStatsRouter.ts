import os from "node:os";
import { statfs } from "node:fs/promises";
import {
  adminProcedure,
  superAdminProcedure,
} from "@/src/features/oxelia51/server/adminAuth";
import { env } from "@/src/env.mjs";
import { goFetch } from "@/src/features/oxelia51/server/goClient";
import { prisma } from "@oxelia51/shared/src/db";

/**
 * 管理台统计/监控：服务器状态、网关指标、电费、平台概览、告警日志、用量趋势。
 * 每个 procedure 单独导出，由 adminRouter.ts 合并为 tRPC router。
 */

export const adminStatsProcedures = {
  /** Go 后端服务器状态（阿里云） */
  serverStats: adminProcedure.query(() =>
    goFetch("/api/admin/server-stats", "GET"),
  ),

  /** 代理网关状态（QPS/延迟/成功率/供应商分布） */
  gatewayStats: adminProcedure.query(() =>
    goFetch("/api/admin/gateway-stats", "GET"),
  ),

  /** 腾讯云服务器状态：langfuse-web 容器所在主机（本进程读取） */
  localStats: adminProcedure.query(async () => {
    const load = (os.loadavg()[0] / os.cpus().length) * 100;
    const totalMem = os.totalmem();
    const usedMem = totalMem - os.freemem();
    let diskUsedPercent: number | null = null;
    let diskTotalGB: number | null = null;
    try {
      const st = await statfs("/");
      const total = st.blocks * st.bsize;
      const free = st.bavail * st.bsize;
      diskTotalGB = Math.round(total / 1e9);
      diskUsedPercent = ((total - free) / total) * 100;
    } catch {
      // statfs 不可用时留空
    }
    return {
      cpuPercent: load,
      memoryUsedMB: Math.round(usedMem / 1048576),
      memoryTotalMB: Math.round(totalMem / 1048576),
      diskUsedPercent,
      diskTotalGB,
      uptimeSeconds: Math.round(os.uptime()),
      processUptimeSeconds: Math.round(process.uptime()),
    };
  }),

  /** 宿舍电费查询（DormGuard 代理） */
  dormPower: adminProcedure.query(() =>
    goFetch(
      `/api/tools/dormguard/proxy/api/power/records/${env.OXELIA51_DORM_NUMBER ?? "320"}/latest`,
      "GET",
    ),
  ),

  /** 手动触发一次电费抓取（DormGuard /api/system/crawl）——写操作，仅超级管理员 */
  dormPowerRefresh: superAdminProcedure.mutation(() =>
    goFetch("/api/tools/dormguard/proxy/api/system/crawl", "POST"),
  ),

  /** 平台总览指标：注册用户/项目/待处理反馈/近 24h 告警（直查 PG，只读聚合） */
  platformOverview: adminProcedure.query(async () => {
    const [users, projects, pendingFeedback, alerts24h] = await Promise.all([
      prisma.$queryRaw<
        [{ count: bigint }]
      >`SELECT COUNT(*) AS count FROM users`,
      prisma.$queryRaw<
        [{ count: bigint }]
      >`SELECT COUNT(*) AS count FROM projects`,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count FROM oxelia51.feedback WHERE status = 'new'
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count FROM oxelia51.alert_logs
        WHERE created_at > now() - interval '24 hours'
      `,
    ]);
    return {
      userCount: Number(users[0]?.count ?? 0),
      projectCount: Number(projects[0]?.count ?? 0),
      pendingFeedbackCount: Number(pendingFeedback[0]?.count ?? 0),
      alertsLast24hCount: Number(alerts24h[0]?.count ?? 0),
    };
  }),

  /** 跨项目最近告警记录（oxelia51.alert_logs，由外部分析引擎写入，只读；关联 projects 取项目名） */
  listAlertLogs: adminProcedure.query(async () => {
    const rows = await prisma.$queryRaw<
      Array<{
        id: unknown;
        project_id: string;
        project_name: string | null;
        alert_type: string;
        severity: string;
        message: string | null;
        status: string;
        created_at: Date;
      }>
    >`
      SELECT a.id, a.project_id, p.name AS project_name,
             a.alert_type, a.severity, a.message, a.status, a.created_at
      FROM oxelia51.alert_logs a
      LEFT JOIN projects p ON p.id = a.project_id
      ORDER BY a.created_at DESC
      LIMIT 100
    `;
    return {
      items: rows.map((r) => ({
        id: Number(r.id),
        projectId: r.project_id,
        projectName: r.project_name,
        alertType: r.alert_type,
        severity: r.severity,
        message: r.message ?? "",
        status: r.status,
        createdAt: r.created_at,
      })),
    };
  }),

  /**
   * 平台级近 14 天用量趋势：直查 oxelia51.daily_stats 汇总全部项目（只读）。
   * generate_series 补齐无数据日期（0 值），保证图表 X 轴连续；
   * 日期服务端格式化为 YYYY-MM-DD 字符串，避免 timestamp 跨时区偏移。
   */
  platformDailyTrend: adminProcedure.query(async () => {
    const rows = await prisma.$queryRaw<
      Array<{ day: string; tokens: unknown; cost_usd: unknown }>
    >`
      SELECT to_char(d.date, 'YYYY-MM-DD') AS day,
             COALESCE(sum(s.total_tokens), 0) AS tokens,
             COALESCE(sum(s.cost_usd), 0) AS cost_usd
      FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, interval '1 day') AS d(date)
      LEFT JOIN oxelia51.daily_stats s ON s.date = d.date
      GROUP BY d.date
      ORDER BY d.date ASC
    `;
    return rows.map((r) => ({
      day: r.day,
      tokens: Number(r.tokens ?? 0),
      costUsd: Number(r.cost_usd ?? 0),
    }));
  }),
};
