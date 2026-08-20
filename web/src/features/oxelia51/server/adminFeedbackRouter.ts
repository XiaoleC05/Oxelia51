import { z } from "zod";
import { prisma } from "@oxelia51/shared/src/db";
import { sendFeedbackReplyEmail } from "@oxelia51/shared/src/server";
import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  superAdminProcedure,
} from "@/src/features/oxelia51/server/adminAuth";
import { env } from "@/src/env.mjs";

/**
 * 管理台用户反馈：列表/状态流转/回复。
 * 每个 procedure 单独导出，由 adminRouter.ts 合并为 tRPC router。
 */

export const adminFeedbackProcedures = {
  /** 用户反馈列表（oxelia51.feedback，按时间倒序；status 可选筛选） */
  listFeedback: adminProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(200).default(50),
          status: z.enum(["new", "processing", "done"]).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const status = input?.status ?? "";
      const rows = await prisma.$queryRaw<
        Array<{
          id: unknown;
          email: string;
          category: string;
          message: string;
          project_id: string | null;
          project_name: string | null;
          status: string;
          created_at: Date;
        }>
      >`
        SELECT f.id, f.email, f.category, f.message, f.project_id,
               p.name AS project_name, f.status, f.created_at
        FROM oxelia51.feedback f
        LEFT JOIN projects p ON p.id = f.project_id
        WHERE (${status} = '' OR f.status = ${status})
        ORDER BY f.created_at DESC
        LIMIT ${input?.limit ?? 50}
      `;
      return {
        items: rows.map((r) => ({
          id: Number(r.id),
          email: r.email,
          category: r.category,
          message: r.message,
          projectId: r.project_id,
          projectName: r.project_name,
          status: r.status,
          createdAt: r.created_at,
        })),
      };
    }),

  /** 反馈状态流转：new → processing → done ——写操作，仅超级管理员 */
  updateFeedbackStatus: superAdminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["new", "processing", "done"]),
      }),
    )
    .mutation(async ({ input }) => {
      await prisma.$executeRaw`
        UPDATE oxelia51.feedback SET status = ${input.status} WHERE id = ${input.id}
      `;
      return { success: true };
    }),

  /**
   * 回复用户反馈：向反馈者邮箱发送回复邮件（Oxelia51 品牌模板，引用原反馈摘要），
   * 并将该反馈状态置为 done。——写操作，仅超级管理员
   */
  replyFeedback: superAdminProcedure
    .input(
      z.object({
        feedbackId: z.number().int().positive(),
        message: z
          .string()
          .trim()
          .min(1, "回复内容不能为空")
          .max(2000, "回复内容不能超过 2000 字"),
      }),
    )
    .mutation(async ({ input }) => {
      const rows = await prisma.$queryRaw<
        Array<{ id: unknown; email: string; message: string }>
      >`
        SELECT id, email, message FROM oxelia51.feedback WHERE id = ${input.feedbackId} LIMIT 1
      `;
      const feedback = rows[0];
      if (!feedback) {
        throw new TRPCError({ code: "NOT_FOUND", message: "反馈不存在" });
      }
      await sendFeedbackReplyEmail({
        env: {
          EMAIL_FROM_ADDRESS: env.EMAIL_FROM_ADDRESS,
          SMTP_CONNECTION_URL: env.SMTP_CONNECTION_URL,
        },
        to: feedback.email,
        replyMessage: input.message,
        feedbackMessage: feedback.message,
      });
      await prisma.$executeRaw`
        UPDATE oxelia51.feedback SET status = 'done' WHERE id = ${input.feedbackId}
      `;
      return { success: true };
    }),
};
