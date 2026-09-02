import { z } from "zod";
import {
  createTRPCRouter,
  authenticatedProcedure,
} from "@/src/server/api/trpc";
import { StringNoHTML } from "@oxelia51/shared";

const updateDisplayNameSchema = z.object({
  name: StringNoHTML.min(1, "Name cannot be empty").max(
    100,
    "Name must be at most 100 characters",
  ),
});

export const userAccountRouter = createTRPCRouter({
  updateDisplayName: authenticatedProcedure
    .input(updateDisplayNameSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const updatedUser = await ctx.prisma.user.update({
        where: { id: userId },
        data: {
          name: input.name,
        },
      });

      return {
        success: true,
        name: updatedUser.name,
      };
    }),

  /**
   * 删除当前登录用户：仅删用户本体，memberships / 会话 / 账户等关联数据由
   * schema onDelete: Cascade 处理。Oxelia51 组织/项目模块已删除，
   * 不再做「组织最后所有者」校验。
   */
  delete: authenticatedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    await ctx.prisma.user.delete({
      where: { id: userId },
    });

    return {
      success: true,
    };
  }),
});
