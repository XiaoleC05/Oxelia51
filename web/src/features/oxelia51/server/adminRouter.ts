import { z } from "zod";
import {
  authenticatedProcedure,
  createTRPCRouter,
} from "@/src/server/api/trpc";
import {
  adminProcedure,
  superAdminProcedure,
} from "@/src/features/oxelia51/server/adminAuth";
import {
  clientIpFromHeaders,
  goFetch,
} from "@/src/features/oxelia51/server/goClient";
import {
  isAdminEmail,
  isSuperAdminEmail,
} from "@/src/features/oxelia51/server/adminAuth";

import { adminUserProcedures } from "@/src/features/oxelia51/server/adminUserRouter";
import { adminOrgProcedures } from "@/src/features/oxelia51/server/adminOrgRouter";
import { adminStatsProcedures } from "@/src/features/oxelia51/server/adminStatsRouter";
import { adminFeedbackProcedures } from "@/src/features/oxelia51/server/adminFeedbackRouter";

/**
 * Oxelia51 后台管理 tRPC router。
 * Langfuse 登录态即管理员身份：服务端持有 Go 后端运维凭证换 JWT 转发，
 * 凭证不下发到浏览器。
 * 权限两级（统一邮箱制，见 adminAuth.ts）：
 * - 管理员（adminProcedure）：OXELIA_SUPER_ADMIN_EMAIL 恒为管理员，
 *   外加 OXELIA51_ADMIN_EMAILS 邮箱名单（空名单 = 除超级管理员外无人是管理员）。
 * - 超级管理员（superAdminProcedure）：仅 OXELIA_SUPER_ADMIN_EMAIL，
 *   所有写操作（白名单增删、电费抓取、反馈流转）仅其可执行。
 *
 * 按域拆分子模块：adminUserRouter / adminOrgRouter / adminStatsRouter / adminFeedbackRouter。
 */

const whitelistIdSchema = z.object({
  id: z.string().regex(/^\d+$/, "无效的 id"),
});

export const oxelia51AdminRouter = createTRPCRouter({
  /** 前端据此决定后台管理入口可见性、操作按钮显隐（任何登录用户可调） */
  whoami: authenticatedProcedure.query(({ ctx }) => {
    return {
      email: ctx.session.user.email,
      isAdmin: isAdminEmail(ctx.session.user.email),
      isSuperAdmin: isSuperAdminEmail(ctx.session.user.email),
    };
  }),

  // ---- IP 白名单管理 ----
  whitelistList: adminProcedure.query(({ ctx }) =>
    goFetch(
      "/api/admin/ip-whitelist",
      "GET",
      undefined,
      true,
      clientIpFromHeaders(ctx.headers),
    ),
  ),
  whitelistCreate: superAdminProcedure
    .input(
      z.object({
        ip: z
          .string()
          .regex(
            /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}(\/\d{1,2})?|[0-9a-fA-F:]+(\/\d{1,3})?)$/,
            "请输入合法 IP 或 CIDR（如 1.2.3.4 或 1.2.3.0/24）",
          ),
        label: z.string().max(50).default(""),
      }),
    )
    .mutation(({ ctx, input }) =>
      goFetch(
        "/api/admin/ip-whitelist",
        "POST",
        input,
        true,
        clientIpFromHeaders(ctx.headers),
      ),
    ),
  whitelistDelete: superAdminProcedure
    .input(whitelistIdSchema)
    .mutation(({ ctx, input }) =>
      goFetch(
        `/api/admin/ip-whitelist/${input.id}`,
        "DELETE",
        undefined,
        true,
        clientIpFromHeaders(ctx.headers),
      ),
    ),

  // ---- 域子模块 ----
  ...adminUserProcedures,
  ...adminOrgProcedures,
  ...adminStatsProcedures,
  ...adminFeedbackProcedures,
});
