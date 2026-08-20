import { z } from "zod";
import {
  createTRPCRouter,
  authenticatedProcedure,
} from "@/src/server/api/trpc";
import { queryClickhouse } from "@oxelia51/shared/src/server";
import { Prisma } from "@oxelia51/shared/src/db";
import { toNumber } from "@/src/features/oxelia51/server/common";

/**
 * Oxelia51 个人工作台（P2）——跨项目数据层。
 *
 * 与 oxelia51Router（project 作用域）不同，本 router 全部走 `authenticatedProcedure`，
 * 按「用户可见的所有项目」（跨所有组织）聚合 token_events / daily_stats，
 * 支撑 /app/* 个人工作台的「总览 → 项目 → 会话」个人化信息架构。
 *
 * 成本说明：token_events.cost_usd 恒 0（由 C++ 引擎后算进 daily_stats），
 * 会话/明细级成本在此用 token × model_pricing 现算。
 */

type SessionUser = {
  organizations: { projects: { id: string }[] }[];
};

/** 用户可见的全部 projectId（跨所有组织，平铺） */
function getAllProjectIds(user: SessionUser): string[] {
  return user.organizations.flatMap((org) => org.projects.map((p) => p.id));
}

type Pricing = { prompt: number; completion: number };
export type PricingMap = Map<string, Pricing>;

/** 从 PG oxelia51.model_pricing 加载定价表（per 1M tokens USD） */
export async function loadPricingMap(prisma: {
  $queryRaw: (
    q: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
}): Promise<PricingMap> {
  const rows = (await prisma.$queryRaw`
    SELECT model, prompt_price_usd, completion_price_usd FROM oxelia51.model_pricing
  `) as Array<{
    model: string;
    prompt_price_usd: unknown;
    completion_price_usd: unknown;
  }>;
  const map: PricingMap = new Map();
  for (const r of rows) {
    map.set(r.model, {
      prompt: toNumber(r.prompt_price_usd),
      completion: toNumber(r.completion_price_usd),
    });
  }
  return map;
}

/** 按 token × 定价现算成本（USD），无定价的模型计 0 */
export function costOf(
  pricing: PricingMap,
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = pricing.get(model);
  if (!p) return 0;
  return (
    (promptTokens / 1e6) * p.prompt + (completionTokens / 1e6) * p.completion
  );
}

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

const EMPTY_OVERVIEW = {
  todayTokens: 0,
  todayCostUsd: 0,
  yesterdayTokens: 0,
  weekTokens: 0,
  prevWeekTokens: 0,
  monthTokens: 0,
  prevMonthTokens: 0,
  monthCostUsd: 0,
};

export const workspaceRouter = createTRPCRouter({
  /** 当日汇率（CNY/USD）：跨项目共用，取 oxelia51.exchange_rates 最新 */
  exchangeRate: authenticatedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.$queryRaw<Array<{ rate: unknown }>>`
      SELECT rate_cny_per_usd AS rate
      FROM oxelia51.exchange_rates
      ORDER BY date DESC
      LIMIT 1
    `;
    return { rateCnyPerUsd: toNumber(rows[0]?.rate) || 7.2 };
  }),

  /** 工作台总览：跨项目今日/本周/本月 token + 本月成本 */
  overview: authenticatedProcedure.query(async ({ ctx }) => {
    const projectIds = getAllProjectIds(ctx.session.user);
    if (projectIds.length === 0) return EMPTY_OVERVIEW;

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
      WHERE project_id IN (${Prisma.join(projectIds)})
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

  /** 工作台 Token 趋势：跨项目，按日/周/月粒度 × 模型 */
  tokenTrend: authenticatedProcedure
    .input(
      z.object({
        granularity: z.enum(["day", "week", "month"]).default("day"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const projectIds = getAllProjectIds(ctx.session.user);
      if (projectIds.length === 0) return [];
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
          WHERE project_id IN ({projectIds: Array(String)})
            AND timestamp >= now() - INTERVAL ${intervalExpr}
          GROUP BY bucket, model
          ORDER BY bucket ASC
        `,
        params: { projectIds },
        tags: { surface: "oxelia51", route: "workspace-token-trend" },
      });
      return rows.map((r) => ({
        bucket: r.bucket,
        model: r.model,
        tokens: toNumber(r.tokens),
      }));
    }),

  /** 工作台按模型：跨项目近 N 天，token + 成本（现算） */
  byModel: authenticatedProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const projectIds = getAllProjectIds(ctx.session.user);
      if (projectIds.length === 0) return [];
      const pricing = await loadPricingMap(ctx.prisma);

      const rows = await queryClickhouse<{
        model: string;
        prompt: string | number;
        completion: string | number;
        tokens: string | number;
        requests: string | number;
      }>({
        query: `
          SELECT model,
                 sum(prompt_tokens) AS prompt,
                 sum(completion_tokens) AS completion,
                 sum(total_tokens) AS tokens,
                 count() AS requests
          FROM oxelia51.token_events
          WHERE project_id IN ({projectIds: Array(String)})
            AND timestamp >= now() - INTERVAL {days: UInt32} DAY
          GROUP BY model
          ORDER BY tokens DESC
        `,
        params: { projectIds, days: input.days },
        tags: { surface: "oxelia51", route: "workspace-by-model" },
      });
      return rows.map((r) => {
        const prompt = toNumber(r.prompt);
        const completion = toNumber(r.completion);
        return {
          model: r.model,
          promptTokens: prompt,
          completionTokens: completion,
          tokens: toNumber(r.tokens),
          requests: toNumber(r.requests),
          costUsd: costOf(pricing, r.model, prompt, completion),
        };
      });
    }),

  /** 工作台按供应商：跨所有项目，按 provider（LLM 平台）聚合 token/成本（现算） */
  byProvider: authenticatedProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const projectIds = getAllProjectIds(ctx.session.user);
      if (projectIds.length === 0) return [];
      const pricing = await loadPricingMap(ctx.prisma);

      const rows = await queryClickhouse<{
        provider: string;
        model: string;
        prompt: string | number;
        completion: string | number;
        tokens: string | number;
        requests: string | number;
      }>({
        query: `
          SELECT provider, model,
                 sum(prompt_tokens) AS prompt,
                 sum(completion_tokens) AS completion,
                 sum(total_tokens) AS tokens,
                 count() AS requests
          FROM oxelia51.token_events
          WHERE project_id IN ({projectIds: Array(String)})
            AND provider != ''
            AND timestamp >= now() - INTERVAL {days: UInt32} DAY
          GROUP BY provider, model
          ORDER BY tokens DESC
        `,
        params: { projectIds, days: input.days },
        tags: { surface: "oxelia51", route: "workspace-by-provider" },
      });

      // 按 provider 聚合：成本按模型现算后求和
      // hasUnpriced：该 provider 下存在定价表查无的模型（其成本被计 0，总额偏低估）
      const byProvider = new Map<
        string,
        {
          provider: string;
          tokens: number;
          costUsd: number;
          requests: number;
          hasUnpriced: boolean;
        }
      >();
      for (const r of rows) {
        const agg = byProvider.get(r.provider) ?? {
          provider: r.provider,
          tokens: 0,
          costUsd: 0,
          requests: 0,
          hasUnpriced: false,
        };
        agg.tokens += toNumber(r.tokens);
        agg.costUsd += costOf(
          pricing,
          r.model,
          toNumber(r.prompt),
          toNumber(r.completion),
        );
        agg.requests += toNumber(r.requests);
        if (!pricing.has(r.model)) agg.hasUnpriced = true;
        byProvider.set(r.provider, agg);
      }

      return Array.from(byProvider.values()).sort(
        (a, b) => b.tokens - a.tokens,
      );
    }),

  /** 工作台按 Agent：跨所有项目，按 agent（用户使用的软件）聚合 token/成本（现算） */
  byAgent: authenticatedProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const projectIds = getAllProjectIds(ctx.session.user);
      if (projectIds.length === 0) return [];
      const pricing = await loadPricingMap(ctx.prisma);

      const rows = await queryClickhouse<{
        agent: string;
        model: string;
        prompt: string | number;
        completion: string | number;
        tokens: string | number;
        requests: string | number;
      }>({
        query: `
          SELECT agent, model,
                 sum(prompt_tokens) AS prompt,
                 sum(completion_tokens) AS completion,
                 sum(total_tokens) AS tokens,
                 count() AS requests
          FROM oxelia51.token_events
          WHERE project_id IN ({projectIds: Array(String)})
            AND agent != ''
            AND timestamp >= now() - INTERVAL {days: UInt32} DAY
          GROUP BY agent, model
          ORDER BY tokens DESC
        `,
        params: { projectIds, days: input.days },
        tags: { surface: "oxelia51", route: "workspace-by-agent" },
      });

      // 按 agent 聚合：成本按模型现算后求和
      // hasUnpriced：该 agent 下存在定价表查无的模型（其成本被计 0，总额偏低估）
      const byAgent = new Map<
        string,
        {
          agent: string;
          tokens: number;
          costUsd: number;
          requests: number;
          hasUnpriced: boolean;
        }
      >();
      for (const r of rows) {
        const agg = byAgent.get(r.agent) ?? {
          agent: r.agent,
          tokens: 0,
          costUsd: 0,
          requests: 0,
          hasUnpriced: false,
        };
        agg.tokens += toNumber(r.tokens);
        agg.costUsd += costOf(
          pricing,
          r.model,
          toNumber(r.prompt),
          toNumber(r.completion),
        );
        agg.requests += toNumber(r.requests);
        if (!pricing.has(r.model)) agg.hasUnpriced = true;
        byAgent.set(r.agent, agg);
      }

      return Array.from(byAgent.values()).sort((a, b) => b.tokens - a.tokens);
    }),

  /** 工作台日历热力图：近 N 天按日 token（着色用） */
  calendarHeatmap: authenticatedProcedure
    .input(z.object({ days: z.number().int().min(7).max(180).default(35) }))
    .query(async ({ ctx, input }) => {
      const projectIds = getAllProjectIds(ctx.session.user);
      if (projectIds.length === 0) return [];

      const rows = await queryClickhouse<{
        date: string;
        tokens: string | number;
      }>({
        query: `
          SELECT toDate(timestamp) AS date,
                 sum(total_tokens) AS tokens
          FROM oxelia51.token_events
          WHERE project_id IN ({projectIds: Array(String)})
            AND timestamp >= now() - INTERVAL {days: UInt32} DAY
          GROUP BY date
          ORDER BY date ASC
        `,
        params: { projectIds, days: input.days },
        tags: { surface: "oxelia51", route: "workspace-calendar" },
      });
      return rows.map((r) => ({
        date: r.date,
        tokens: toNumber(r.tokens),
      }));
    }),
});
