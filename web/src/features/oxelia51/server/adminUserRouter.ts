import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "@oxelia51/shared/src/db";
import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  superAdminProcedure,
  isAdminEmail,
  isSuperAdminEmail,
} from "@/src/features/oxelia51/server/adminAuth";
import { updateUserPassword } from "@/src/features/auth-credentials/lib/credentialsServerUtils";

/**
 * 管理台用户管理：列表/密码重置/删除。
 * 每个 procedure 单独导出，由 adminRouter.ts 合并为 tRPC router。
 */

export const adminUserProcedures = {
  /** 平台用户列表：直查 Langfuse 用户表（不走 Go 后端），支持邮箱/姓名模糊搜索 + OFFSET 分页 */
  usersList: adminProcedure
    .input(
      z
        .object({
          search: z.string().trim().max(100).optional(),
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const search = input?.search ?? "";
      const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      const [users, totalRows] = await Promise.all([
        prisma.$queryRaw<
          Array<{
            id: string;
            name: string | null;
            email: string | null;
            created_at: Date;
            updated_at: Date;
          }>
        >`
          SELECT u.id, u.name, u.email, u.created_at, u.updated_at
          FROM users u
          WHERE (${search} = '' OR u.email ILIKE ${like} OR u.name ILIKE ${like})
          ORDER BY u.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) AS count FROM users u
          WHERE (${search} = '' OR u.email ILIKE ${like} OR u.name ILIKE ${like})
        `,
      ]);
      const items = users.map((u) => ({
        ...u,
        isPlatformAdmin: isAdminEmail(u.email),
        isPlatformSuperAdmin: isSuperAdminEmail(u.email),
      }));
      return { items, total: Number(totalRows[0]?.count ?? 0) };
    }),

  /**
   * 重置用户密码：生成 12 位随机临时密码并写库（复用 credentials 的 bcrypt 哈希）。
   * 临时密码仅在本次响应返回，不落明文日志、不入库明文。——写操作，仅超级管理员
   * 安全：重置同时吊销该用户全部 oxelia51.sync_tokens（旧密码签发的桌面同步密钥
   * 在密码重置后必须失效，否则持旧密钥者可绕过新密码继续同步）。
   * Web 会话说明：next-auth 配置为 JWT 会话（web/src/server/auth.ts session.strategy="jwt"），
   * 无服务端会话行可删，旧 JWT 只能等其自然过期——这是已知取舍，如需即时生效须引入会话黑名单。
   */
  adminResetUserPassword: superAdminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true },
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
      }
      const tempPassword = randomBytes(9).toString("base64url");
      // 注：updateUserPassword 内部使用 prisma 单例，无法传入事务客户端；
      // 密码更新与同步密钥吊销之间存在狭小原子性缺口（P2 级，概率极低）。
      // 如 updateUserPassword 未来支持事务注入可无缝加固。
      await updateUserPassword(user.id, tempPassword);
      await prisma.$executeRaw`
        UPDATE oxelia51.sync_tokens
        SET revoked_at = now()
        WHERE user_id = ${user.id} AND revoked_at IS NULL
      `;
      return { email: user.email, tempPassword };
    }),

  /**
   * 删除用户：仅删用户本体，memberships / 会话 / 账户等关联数据由 schema
   * onDelete: Cascade 处理。组织/项目随单默认组织机制保留，不做级联清理。——写操作，仅超级管理员
   * 保护：不能删除自己、不能删除 OXELIA_SUPER_ADMIN_EMAIL。
   */
  adminDeleteUser: superAdminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "不能删除当前登录的管理员账户",
        });
      }
      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
      }
      if (isSuperAdminEmail(target.email)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "不能删除超级管理员账户",
        });
      }
      await prisma.user.delete({ where: { id: target.id } });
      return {
        success: true,
        email: target.email,
      };
    }),
};
