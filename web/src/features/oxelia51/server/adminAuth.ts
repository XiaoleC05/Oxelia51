import { env } from "@/src/env.mjs";
import { authenticatedProcedure } from "@/src/server/api/trpc";
import { TRPCError } from "@trpc/server";

/**
 * oxelia51 管理台授权统一走邮箱制（区别于 langfuse 组织/角色体系）：
 * - 超级管理员：仅 OXELIA_SUPER_ADMIN_EMAIL（写操作、白名单、反馈流转）。
 * - 管理员：超级管理员恒为管理员，外加 OXELIA51_ADMIN_EMAILS 邮箱名单
 *   （空名单 = 除超级管理员外无人是管理员，fail-closed）。
 * adminRouter / proxyKeyRouter / 用户列表的「平台管理员」标记均复用这里。
 *
 * adminProcedure / superAdminProcedure 是 tRPC 中间件，子 router 文件各自导入。
 */

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && email === env.OXELIA_SUPER_ADMIN_EMAIL;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  // 超级管理员永远拥有管理员权限（即使 env 名单漏配）
  if (isSuperAdminEmail(email)) return true;
  const allowlist = (env.OXELIA51_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  // 空名单视为未配置：拒绝所有人，而非放行所有人
  if (allowlist.length === 0) return false;
  return Boolean(email) && allowlist.includes(email as string);
}

/** 仅管理员的 procedure（在登录态之上再校验邮箱名单） */
export const adminProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (!isAdminEmail(ctx.session.user.email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "当前账户无后台管理权限",
    });
  }
  return next();
});

/** 仅超级管理员的 procedure：所有写操作走此入口 */
export const superAdminProcedure = authenticatedProcedure.use(
  ({ ctx, next }) => {
    if (!isSuperAdminEmail(ctx.session.user.email)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "仅超级管理员可执行此操作",
      });
    }
    return next();
  },
);
