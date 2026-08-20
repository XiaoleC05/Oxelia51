import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  authenticatedProcedure,
} from "@/src/server/api/trpc";
import { toNumber } from "@/src/features/oxelia51/server/common";
import {
  costOf,
  loadPricingMap,
} from "@/src/features/oxelia51/server/workspaceRouter";

/**
 * Oxelia51 桌面账本云同步（/app 设置页「同步账本」）。
 *
 * 数据来自 oxelia51.synced_events / sync_tokens（由 /api/sync/* 写入），
 * 本 router 只按「当前登录用户」读汇总与吊销密钥；估算成本用 model_pricing 现算，
 * 无定价的模型计 0（与 workspaceRouter 口径一致）。
 */

type DeviceRow = {
  device_id: string;
  events: unknown;
  last_event_ts: Date | string | null;
  last_synced_at: Date | string | null;
};

type TokenRow = {
  id: unknown;
  device_label: string;
  created_at: Date | string;
  last_used_at: Date | string | null;
};

const toIso = (v: Date | string | null | undefined): string | null =>
  v == null ? null : new Date(v).toISOString();

export const syncRouter = createTRPCRouter({
  /** 同步状态汇总：设备列表、总事件数、近 30 日 token/估算成本、有效同步密钥（不含 hash） */
  status: authenticatedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [deviceRows, totalRows, modelRows, tokenRows, pricing] =
      await Promise.all([
        ctx.prisma.$queryRaw<DeviceRow[]>`
          SELECT device_id,
                 count(*)        AS events,
                 max(ts)         AS last_event_ts,
                 max(synced_at)  AS last_synced_at
          FROM oxelia51.synced_events
          WHERE user_id = ${userId}
          GROUP BY device_id
          ORDER BY last_synced_at DESC
        `,
        ctx.prisma.$queryRaw<
          Array<{ total_events: unknown; month_tokens: unknown }>
        >`
          SELECT count(*) AS total_events,
                 COALESCE(sum(total_tokens) FILTER (WHERE ts >= now() - INTERVAL '30 days'), 0) AS month_tokens
          FROM oxelia51.synced_events
          WHERE user_id = ${userId}
        `,
        ctx.prisma.$queryRaw<
          Array<{ model: string; prompt: unknown; completion: unknown }>
        >`
          SELECT model,
                 sum(prompt_tokens)     AS prompt,
                 sum(completion_tokens) AS completion
          FROM oxelia51.synced_events
          WHERE user_id = ${userId} AND ts >= now() - INTERVAL '30 days'
          GROUP BY model
        `,
        ctx.prisma.$queryRaw<TokenRow[]>`
          SELECT id, device_label, created_at, last_used_at
          FROM oxelia51.sync_tokens
          WHERE user_id = ${userId} AND revoked_at IS NULL
          ORDER BY created_at DESC
        `,
        loadPricingMap(ctx.prisma),
      ]);

    // 近 30 日估算成本：按模型 token × 参考价现算后求和
    const monthCostUsd = modelRows.reduce(
      (sum, r) =>
        sum +
        costOf(pricing, r.model, toNumber(r.prompt), toNumber(r.completion)),
      0,
    );

    return {
      devices: deviceRows.map((r) => ({
        deviceId: r.device_id,
        events: toNumber(r.events),
        lastEventTs: toIso(r.last_event_ts),
        lastSyncedAt: toIso(r.last_synced_at),
      })),
      totalEvents: toNumber(totalRows[0]?.total_events),
      last30dTokens: toNumber(totalRows[0]?.month_tokens),
      last30dCostUsd: monthCostUsd,
      tokens: tokenRows.map((r) => ({
        id: toNumber(r.id),
        deviceLabel: r.device_label,
        createdAt: toIso(r.created_at) ?? "",
        lastUsedAt: toIso(r.last_used_at),
      })),
    };
  }),

  /** 吊销同步密钥（桌面端立即失效）；限本人、幂等（已吊销按不存在处理） */
  revokeToken: authenticatedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.prisma.$executeRaw`
        UPDATE oxelia51.sync_tokens
        SET revoked_at = now()
        WHERE id = ${input.id}
          AND user_id = ${ctx.session.user.id}
          AND revoked_at IS NULL
      `;
      if (toNumber(updated) === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "同步密钥不存在或已断开",
        });
      }
      return { success: true };
    }),
});
