import { z } from "zod";
import { randomInt } from "crypto";
import {
  createTRPCRouter,
  protectedProjectProcedure,
  publicProcedure,
} from "@/src/server/api/trpc";
import {
  queryClickhouse,
  sendFeedbackNotificationEmail,
  sendFeedbackAutoReplyEmail,
  sendAlertChannelVerificationEmail,
  logger,
} from "@oxelia51/shared/src/server";
import { Prisma } from "@oxelia51/shared/src/db";
import { env } from "@/src/env.mjs";
import { TRPCError } from "@trpc/server";
import { toNumber } from "@/src/features/oxelia51/server/common";
import { clientIpFromHeaders } from "@/src/features/oxelia51/server/goClient";
import { allowFeedbackFromIp } from "@/src/features/oxelia51/server/feedbackRateLimit";

/** 反馈分类（DB 存英文枚举）→ 中文展示名（邮件主题/后台列表用）。 */
const FEEDBACK_CATEGORY_LABEL: Record<"feature" | "bug" | "other", string> = {
  feature: "功能建议",
  bug: "Bug 反馈",
  other: "其他",
};

/** 告警邮箱验证码有效期：10 分钟。 */
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;

/** 生成 6 位数字验证码（与 web/src/server/auth.ts 的邮箱验证码同一生成方式）。 */
const generateVerificationCode = () => randomInt(100000, 1000000).toString();

/**
 * Oxelia51 Token 监控平台自定义 router。
 * 数据来源：
 *  - PostgreSQL oxelia51 schema（daily_stats / budget_configs / alert_logs /
 *    alert_channels / exchange_rates），通过 Langfuse 已有 prisma 实例只读/写入；
 *  - ClickHouse oxelia51.token_events，通过 shared 包 queryClickhouse 封装。
 */

const projectIdInput = z.object({ projectId: z.string() });

type OverviewRow = {
  today_tokens: unknown;
  today_cost: unknown;
  yesterday_tokens: unknown;
  week_tokens: unknown;
  prev_week_tokens: unknown;
  month_tokens: unknown;
  prev_month_tokens: unknown;
  month_cost: unknown;
};

export const oxelia51Router = createTRPCRouter({
  /** TokenWidget：今日/本周/本月 Token 用量 + 本月花费（USD） */
  overview: protectedProjectProcedure
    .input(projectIdInput)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.$queryRaw<OverviewRow[]>`
        SELECT
          COALESCE(sum(total_tokens) FILTER (WHERE date = CURRENT_DATE), 0) AS today_tokens,
          COALESCE(sum(cost_usd)     FILTER (WHERE date = CURRENT_DATE), 0) AS today_cost,
          COALESCE(sum(total_tokens) FILTER (WHERE date = CURRENT_DATE - 1), 0) AS yesterday_tokens,
          COALESCE(sum(total_tokens) FILTER (WHERE date >= date_trunc('week', CURRENT_DATE)::date), 0) AS week_tokens,
          COALESCE(sum(total_tokens) FILTER (WHERE date >= date_trunc('week', CURRENT_DATE)::date - 7
                                             AND date <  date_trunc('week', CURRENT_DATE)::date), 0) AS prev_week_tokens,
          COALESCE(sum(total_tokens) FILTER (WHERE date >= date_trunc('month', CURRENT_DATE)::date), 0) AS month_tokens,
          COALESCE(sum(total_tokens) FILTER (WHERE date >= date_trunc('month', CURRENT_DATE)::date - INTERVAL '1 month'
                                             AND date <  date_trunc('month', CURRENT_DATE)::date), 0) AS prev_month_tokens,
          COALESCE(sum(cost_usd)     FILTER (WHERE date >= date_trunc('month', CURRENT_DATE)::date), 0) AS month_cost
        FROM oxelia51.daily_stats
        WHERE project_id = ${input.projectId}
      `;
      const row = rows[0];
      return {
        todayTokens: toNumber(row?.today_tokens),
        todayCostUsd: toNumber(row?.today_cost),
        yesterdayTokens: toNumber(row?.yesterday_tokens),
        weekTokens: toNumber(row?.week_tokens),
        prevWeekTokens: toNumber(row?.prev_week_tokens),
        monthTokens: toNumber(row?.month_tokens),
        prevMonthTokens: toNumber(row?.prev_month_tokens),
        monthCostUsd: toNumber(row?.month_cost),
      };
    }),

  /** 当日汇率（CNY/USD），取自 oxelia51.exchange_rates 最新一条 */
  exchangeRate: protectedProjectProcedure
    .input(projectIdInput)
    .query(async ({ ctx }) => {
      const rows = await ctx.prisma.$queryRaw<
        Array<{ date: Date; rate: unknown }>
      >`
        SELECT date, rate_cny_per_usd AS rate
        FROM oxelia51.exchange_rates
        ORDER BY date DESC
        LIMIT 1
      `;
      return {
        date: rows[0]?.date ?? null,
        rateCnyPerUsd: toNumber(rows[0]?.rate) || 7.2,
      };
    }),

  /** TokenChart：Token 趋势，按日/周/月粒度、按模型分色 */
  tokenTrend: protectedProjectProcedure
    .input(
      projectIdInput.extend({
        granularity: z.enum(["day", "week", "month"]).default("day"),
      }),
    )
    .query(async ({ input }) => {
      // 粒度对应回看范围：日 30 天 / 周 12 周 / 月 6 个月
      const bucketExpr = {
        day: "toDate(timestamp)",
        week: "toMonday(timestamp)",
        month: "toStartOfMonth(timestamp)",
      }[input.granularity];
      const intervalExpr = {
        day: "30 DAY",
        week: "12 WEEK",
        month: "6 MONTH",
      }[input.granularity];

      const rows = await queryClickhouse<{
        bucket: string;
        model: string;
        tokens: string | number;
      }>({
        query: `
          SELECT ${bucketExpr} AS bucket,
                 model,
                 sum(total_tokens) AS tokens
          FROM oxelia51.token_events
          WHERE project_id = {projectId: String}
            AND timestamp >= now() - INTERVAL ${intervalExpr}
          GROUP BY bucket, model
          ORDER BY bucket ASC
        `,
        params: { projectId: input.projectId },
        tags: {
          surface: "oxelia51",
          route: "token-trend",
          projectId: input.projectId,
        },
      });
      return rows.map((r) => ({
        bucket: r.bucket,
        model: r.model,
        tokens: toNumber(r.tokens),
      }));
    }),

  /** CostChart：近 N 天按模型成本占比 */
  costByModel: protectedProjectProcedure
    .input(
      projectIdInput.extend({
        days: z.number().int().min(1).max(365).default(30),
      }),
    )
    .query(async ({ input }) => {
      const rows = await queryClickhouse<{
        model: string;
        tokens: string | number;
        cost_usd: string | number;
      }>({
        query: `
          SELECT model,
                 sum(total_tokens) AS tokens,
                 sum(cost_usd) AS cost_usd
          FROM oxelia51.token_events
          WHERE project_id = {projectId: String}
            AND timestamp >= now() - INTERVAL {days: UInt32} DAY
          GROUP BY model
          ORDER BY cost_usd DESC
        `,
        params: { projectId: input.projectId, days: input.days },
        tags: {
          surface: "oxelia51",
          route: "cost-by-model",
          projectId: input.projectId,
        },
      });
      return rows.map((r) => ({
        model: r.model,
        tokens: toNumber(r.tokens),
        costUsd: toNumber(r.cost_usd),
      }));
    }),

  /** 成本分析页：近 30 天花费趋势（按日 × 模型，支持堆叠/分离视图） */
  costTrend: protectedProjectProcedure
    .input(projectIdInput)
    .query(async ({ input }) => {
      const rows = await queryClickhouse<{
        date: string;
        model: string;
        cost_usd: string | number;
      }>({
        query: `
          SELECT toDate(timestamp) AS date,
                 model,
                 sum(cost_usd) AS cost_usd
          FROM oxelia51.token_events
          WHERE project_id = {projectId: String}
            AND timestamp >= now() - INTERVAL 30 DAY
          GROUP BY date, model
          ORDER BY date ASC
        `,
        params: { projectId: input.projectId },
        tags: {
          surface: "oxelia51",
          route: "cost-trend",
          projectId: input.projectId,
        },
      });
      return rows.map((r) => ({
        date: r.date,
        model: r.model,
        costUsd: toNumber(r.cost_usd),
      }));
    }),

  /** 成本分析页：同组织内项目花费排行（近 30 天，daily_stats 汇总） */
  projectCostRanking: protectedProjectProcedure
    .input(projectIdInput)
    .query(async ({ ctx, input }) => {
      const organization = ctx.session.user.organizations.find((org) =>
        org.projects.some((p) => p.id === input.projectId),
      );
      const projectIds = organization?.projects.map((p) => p.id) ?? [
        input.projectId,
      ];

      const projects = await ctx.prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true },
      });
      const nameById = new Map(projects.map((p) => [p.id, p.name]));

      const rows = await ctx.prisma.$queryRaw<
        Array<{ project_id: string; tokens: unknown; cost_usd: unknown }>
      >`
        SELECT project_id,
               sum(total_tokens) AS tokens,
               sum(cost_usd) AS cost_usd
        FROM oxelia51.daily_stats
        WHERE project_id IN (${Prisma.join(projectIds)})
          AND date >= CURRENT_DATE - 30
        GROUP BY project_id
        ORDER BY cost_usd DESC
        LIMIT 20
      `;
      return rows.map((r) => ({
        projectId: r.project_id,
        projectName: nameById.get(r.project_id) ?? r.project_id,
        tokens: toNumber(r.tokens),
        costUsd: toNumber(r.cost_usd),
      }));
    }),

  /** 告警设置：读取预算配置 + 异常检测配置（存于 Langfuse project metadata） */
  getAlertConfig: protectedProjectProcedure
    .input(projectIdInput)
    .query(async ({ ctx, input }) => {
      const budgetRows = await ctx.prisma.$queryRaw<
        Array<{ budget_usd: unknown; threshold: unknown; enabled: boolean }>
      >`
        SELECT budget_usd, threshold, enabled
        FROM oxelia51.budget_configs
        WHERE project_id = ${input.projectId}
        LIMIT 1
      `;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId },
        select: { metadata: true },
      });
      const metadata = (project?.metadata ?? {}) as Record<string, unknown>;
      const oxelia = (metadata.oxelia51 ?? {}) as Record<string, unknown>;
      const anomaly = (oxelia.anomaly ?? {}) as Record<string, unknown>;

      return {
        budgetUsd: toNumber(budgetRows[0]?.budget_usd),
        threshold: toNumber(budgetRows[0]?.threshold) || 0.8,
        budgetEnabled: budgetRows[0]?.enabled ?? false,
        hasBudgetConfig: budgetRows.length > 0,
        anomalyMultiplier:
          toNumber(anomaly.spike_ratio ?? anomaly.multiplier) || 3,
        anomalyEnabled: Boolean(anomaly.enabled ?? false),
      };
    }),

  /**
   * 告警设置：保存预算配置（UPSERT）+ 异常检测配置（project metadata）。
   * 事务包裹两个写操作，消除原子性缺口（P1 修复）。
   */
  saveAlertConfig: protectedProjectProcedure
    .input(
      projectIdInput.extend({
        budgetUsd: z.number().min(0),
        threshold: z.number().min(0).max(1),
        budgetEnabled: z.boolean(),
        anomalyMultiplier: z.number().min(1),
        anomalyEnabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO oxelia51.budget_configs (project_id, budget_usd, threshold, enabled, updated_at)
          VALUES (${input.projectId}, ${input.budgetUsd}, ${input.threshold}, ${input.budgetEnabled}, now())
          ON CONFLICT (project_id) DO UPDATE SET
            budget_usd = EXCLUDED.budget_usd,
            threshold  = EXCLUDED.threshold,
            enabled    = EXCLUDED.enabled,
            updated_at = now()
        `;

        const project = await tx.project.findFirst({
          where: { id: input.projectId },
          select: { metadata: true },
        });
        const metadata = (project?.metadata ?? {}) as Record<string, unknown>;
        const oxelia = (metadata.oxelia51 ?? {}) as Record<string, unknown>;
        await tx.project.update({
          where: { id: input.projectId },
          data: {
            metadata: {
              ...metadata,
              oxelia51: {
                ...oxelia,
                // 键名与 C++ 分析引擎契约一致（detector.h / postgres.cpp）
                anomaly: {
                  spike_ratio: input.anomalyMultiplier,
                  enabled: input.anomalyEnabled,
                },
              },
            },
          },
        });
      });
      return { success: true };
    }),

  /** 告警设置：通知通道列表（email / webhook） */
  getAlertChannels: protectedProjectProcedure
    .input(projectIdInput)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.$queryRaw<
        Array<{
          id: unknown;
          type: string;
          address: string;
          verified: boolean;
        }>
      >`
        SELECT id, type, address, verified
        FROM oxelia51.alert_channels
        WHERE project_id = ${input.projectId}
        ORDER BY id ASC
      `;
      return rows.map((r) => ({
        id: toNumber(r.id),
        type: r.type,
        address: r.address,
        verified: r.verified,
      }));
    }),

  /**
   * 告警设置：保存通知通道（事务包裹，P1 修复）。
   * 地址未变化的通道保留原 verified 状态；新增邮件通道发验证码在事务提交后执行
   * （邮件发送失败不回滚通道落库，用户可点「重发验证码」）。
   */
  saveAlertChannels: protectedProjectProcedure
    .input(
      projectIdInput.extend({
        email: z.string().check(z.trim(), z.email()).or(z.literal("")),
        webhook: z.string().check(z.trim(), z.url()).or(z.literal("")),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const desired: Array<{ type: string; address: string }> = [];
      if (input.email) desired.push({ type: "email", address: input.email });
      if (input.webhook)
        desired.push({ type: "webhook", address: input.webhook });

      // 事务：读现有通道 → 删旧 → 插新（同一事务内可序列化隔离）
      const newEmailChannels: Array<{ address: string; code: string }> = [];
      await ctx.prisma.$transaction(async (tx) => {
        const existing = await tx.$queryRaw<
          Array<{ id: unknown; type: string; address: string }>
        >`
          SELECT id, type, address
          FROM oxelia51.alert_channels
          WHERE project_id = ${input.projectId}
        `;

        // 删除不再需要的通道
        for (const row of existing) {
          const keep = desired.some(
            (d) => d.type === row.type && d.address === row.address,
          );
          if (!keep) {
            await tx.$executeRaw`
              DELETE FROM oxelia51.alert_channels WHERE id = ${toNumber(row.id)}
            `;
          }
        }
        // 插入新通道
        for (const channel of desired) {
          const exists = existing.some(
            (row) =>
              row.type === channel.type && row.address === channel.address,
          );
          if (exists) continue;
          if (channel.type === "email") {
            const code = generateVerificationCode();
            const expires = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);
            await tx.$executeRaw`
              INSERT INTO oxelia51.alert_channels
                (project_id, type, address, verified, verification_code, verification_expires)
              VALUES (${input.projectId}, 'email', ${channel.address}, false, ${code}, ${expires})
            `;
            newEmailChannels.push({ address: channel.address, code });
          } else {
            await tx.$executeRaw`
              INSERT INTO oxelia51.alert_channels (project_id, type, address, verified)
              VALUES (${input.projectId}, ${channel.type}, ${channel.address}, true)
            `;
          }
        }
      });

      // 事务提交后再发验证邮件（失败只记日志，不回滚通道）
      const mailEnv = {
        EMAIL_FROM_ADDRESS: env.EMAIL_FROM_ADDRESS,
        SMTP_CONNECTION_URL: env.SMTP_CONNECTION_URL,
      };
      for (const ch of newEmailChannels) {
        await sendAlertChannelVerificationEmail({
          env: mailEnv,
          to: ch.address,
          code: ch.code,
        });
      }
      return {
        success: true,
        emailVerificationSent: newEmailChannels.length > 0,
      };
    }),

  /** 告警设置：校验邮件通道验证码，通过后 verified=true 并清除验证码。 */
  verifyAlertChannel: protectedProjectProcedure
    .input(
      projectIdInput.extend({
        code: z
          .string()
          .trim()
          .regex(/^\d{6}$/, "验证码为 6 位数字"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.prisma.$queryRaw<
        Array<{ id: unknown; verification_expires: Date | null }>
      >`
        SELECT id, verification_expires
        FROM oxelia51.alert_channels
        WHERE project_id = ${input.projectId}
          AND type = 'email'
          AND verified = false
          AND verification_code = ${input.code}
        ORDER BY id DESC
        LIMIT 1
      `;
      const channel = rows[0];
      if (!channel) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "验证码错误，请核对后重试。",
        });
      }
      if (
        !channel.verification_expires ||
        channel.verification_expires < new Date()
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "验证码已过期，请点击「重发验证码」获取新验证码。",
        });
      }
      await ctx.prisma.$executeRaw`
        UPDATE oxelia51.alert_channels
        SET verified = true,
            verification_code = NULL,
            verification_expires = NULL
        WHERE id = ${toNumber(channel.id)}
      `;
      return { success: true };
    }),

  /** 告警设置：为未验证的邮件通道重新生成验证码并重发验证邮件。 */
  resendAlertChannelVerification: protectedProjectProcedure
    .input(projectIdInput)
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.prisma.$queryRaw<
        Array<{ id: unknown; address: string }>
      >`
        SELECT id, address
        FROM oxelia51.alert_channels
        WHERE project_id = ${input.projectId}
          AND type = 'email'
          AND verified = false
        ORDER BY id ASC
      `;
      if (rows.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "当前没有待验证的邮件通道。",
        });
      }
      const mailEnv = {
        EMAIL_FROM_ADDRESS: env.EMAIL_FROM_ADDRESS,
        SMTP_CONNECTION_URL: env.SMTP_CONNECTION_URL,
      };
      for (const channel of rows) {
        const code = generateVerificationCode();
        const expires = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);
        await ctx.prisma.$executeRaw`
          UPDATE oxelia51.alert_channels
          SET verification_code = ${code},
              verification_expires = ${expires}
          WHERE id = ${toNumber(channel.id)}
        `;
        await sendAlertChannelVerificationEmail({
          env: mailEnv,
          to: channel.address,
          code,
        });
      }
      return { success: true };
    }),

  /** 告警设置：告警历史 */
  alertLogs: protectedProjectProcedure
    .input(
      projectIdInput.extend({
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.$queryRaw<
        Array<{
          id: unknown;
          alert_type: string;
          severity: string;
          message: string | null;
          status: string;
          created_at: Date;
        }>
      >`
        SELECT id, alert_type, severity, message, status, created_at
        FROM oxelia51.alert_logs
        WHERE project_id = ${input.projectId}
        ORDER BY created_at DESC
        LIMIT ${input.limit}
      `;
      return rows.map((r) => ({
        id: toNumber(r.id),
        alertType: r.alert_type,
        severity: r.severity,
        message: r.message ?? "",
        status: r.status,
        createdAt: r.created_at,
      }));
    }),

  /**
   * 用户反馈：写入 oxelia51.feedback，然后通知运营（默认 receive@oxelia51.com）
   * + 自动回复提交者。登录/未登录均可提交（弱认证原则）；同邮箱 5 分钟限一条，
   * 叠加同 IP 每小时 ≤ 5 条（防换邮箱绕过）；限流通过后才落库并发送两封邮件（同一决策）。
   * 邮件发送失败只记日志，不影响提交结果（DB 落库即成功）。
   */
  submitFeedback: publicProcedure
    .input(
      z.object({
        category: z.enum(["feature", "bug", "other"]),
        email: z.string().check(z.trim(), z.email("邮箱格式不正确")).max(320),
        message: z
          .string()
          .trim()
          .min(1, "内容不能为空")
          .max(2000, "内容最多 2000 字"),
        projectId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // projectId 仅作来源标记：仅当已登录且确为该组织成员时保留，匿名/非成员 → null
      const projectId =
        input.projectId &&
        ctx.session?.user?.organizations.some((org) =>
          org.projects.some((p) => p.id === input.projectId),
        )
          ? input.projectId
          : null;

      // 简单限频：同邮箱 5 分钟内只允许一条，防匿名刷屏
      const recent = await ctx.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(*) AS cnt FROM oxelia51.feedback
        WHERE email = ${input.email} AND created_at > NOW() - INTERVAL '5 minutes'
      `;
      if (Number(recent[0]?.cnt ?? 0) > 0) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "提交过于频繁，请稍后再试。",
        });
      }

      // IP 限流（与邮箱限流叠加，防换邮箱绕过）：同 IP 每小时 ≤ 5 条。
      // 限流决策在落库与两封邮件（通知 + 自动回复）之前统一做出，二者共享同一决策。
      const clientIp = clientIpFromHeaders(ctx.headers);
      if (!allowFeedbackFromIp(clientIp)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "提交过于频繁，请稍后再试。",
        });
      }

      await ctx.prisma.$executeRaw`
        INSERT INTO oxelia51.feedback (email, category, message, project_id)
        VALUES (${input.email}, ${input.category}, ${input.message}, ${projectId})
      `;

      const mailEnv = {
        EMAIL_FROM_ADDRESS: env.EMAIL_FROM_ADDRESS,
        SMTP_CONNECTION_URL: env.SMTP_CONNECTION_URL,
      };
      try {
        await sendFeedbackNotificationEmail({
          env: mailEnv,
          category: FEEDBACK_CATEGORY_LABEL[input.category],
          userEmail: input.email,
          content: input.message,
          submittedAt: new Date(),
        });
        await sendFeedbackAutoReplyEmail({ env: mailEnv, to: input.email });
      } catch (e) {
        logger.warn("feedback notification email failed", e);
      }
      return { success: true };
    }),
});
