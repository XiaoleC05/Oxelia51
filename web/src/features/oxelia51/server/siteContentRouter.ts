import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/src/server/api/trpc";
import { prisma } from "@oxelia51/shared/src/db";
import { superAdminProcedure } from "@/src/features/oxelia51/server/adminAuth";

/**
 * 站点内容编辑（管理台「内容编辑」Tab 的读写）。
 * 存储：oxelia51.site_content（key → JSONB）。页面读取缺省回退硬编码默认值
 * （web/src/features/oxelia51/content/defaults.ts），管理台写入后即时生效。
 * 写操作仅超级管理员（superAdminProcedure），读公开。
 */

const contentKeySchema = z.string().min(1).max(64);

export const siteContentRouter = createTRPCRouter({
  /** 站点页面读取：公开。返回 JSONB 内容或 null（页面回退默认值） */
  get: publicProcedure
    .input(z.object({ key: contentKeySchema }))
    .query(async ({ input }) => {
      const rows = await prisma.$queryRaw<Array<{ content: unknown }>>`
        SELECT content FROM oxelia51.site_content WHERE key = ${input.key}
      `;
      return rows[0]?.content ?? null;
    }),

  /** 管理台「内容编辑」：列出已有键及其更新信息（超级管理员） */
  list: superAdminProcedure.query(async () => {
    const rows = await prisma.$queryRaw<
      Array<{ key: string; updated_at: Date; updated_by: string }>
    >`
      SELECT key, updated_at, updated_by FROM oxelia51.site_content ORDER BY key
    `;
    return rows;
  }),

  /** 管理台「内容编辑」：保存（超级管理员），upsert 记录操作人邮箱 */
  update: superAdminProcedure
    .input(z.object({ key: contentKeySchema, content: z.unknown() }))
    .mutation(async ({ ctx, input }) => {
      const email = ctx.session.user.email ?? "";
      const json = JSON.stringify(input.content ?? {});
      await prisma.$executeRaw`
        INSERT INTO oxelia51.site_content (key, content, updated_by, updated_at)
        VALUES (${input.key}, ${json}::jsonb, ${email}, now())
        ON CONFLICT (key) DO UPDATE
        SET content = EXCLUDED.content,
            updated_by = EXCLUDED.updated_by,
            updated_at = now()
      `;
      return { success: true };
    }),
});
