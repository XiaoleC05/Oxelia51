import { TRPCError } from "@trpc/server";
import type { Prisma } from "@oxelia51/shared/src/db";
import { checkUserCanBeDeleted } from "@/src/server/api/routers/userAccount";

/**
 * 管理台删用户的级联规则（oxelia51 自有面，复用上游 userAccount 的「最后所有者」校验）：
 * - 用户是某组织唯一所有者、且组织内无其他成员 → 级联删除该组织（连同项目），
 *   schema 上 projects / organization_memberships / api_keys 等均对 organizations
 *   声明了 onDelete: Cascade，事务内删 organization 行即完成级联。
 * - 组织内还有其他成员 → 不级联，报 PRECONDITION_FAILED 并说明是哪个组织、还有几名成员。
 *
 * 说明：上游 organizationRouter.delete 是会话态 tRPC procedure（要求组织访问权限、
 * 且禁止删除带项目的组织），没有可复用的独立服务端函数，故此处按外键级联在事务内实现，
 * 并在 adminRouter 侧补做缓存 API key 失效（同上游步骤）。
 * 注意：该路径不经过 ProjectDeleteQueue（上游软删 + worker 异步清 ClickHouse 的流程），
 * 被级联项目的 ClickHouse trace 数据不会主动清除，随 TTL/保留期自然过期——
 * 仅用于「唯一成员废弃组织」，属可接受残留。
 */
export async function deleteUserWithOrgCascade(
  userId: string,
  tx: Prisma.TransactionClient,
): Promise<{ deletedOrganizations: Array<{ id: string; name: string }> }> {
  const { canDelete, blockingOrganizations } = await checkUserCanBeDeleted(
    userId,
    tx,
  );

  let deletedOrganizations: Array<{ id: string; name: string }> = [];

  if (!canDelete) {
    const blocked: Array<{ name: string; otherMemberCount: number }> = [];
    const cascadable: Array<{ id: string; name: string }> = [];
    for (const org of blockingOrganizations) {
      const memberCount = await tx.organizationMembership.count({
        where: { orgId: org.id },
      });
      // memberCount === 1：唯一成员就是被删用户本人（唯一所有者必然也是成员）
      if (memberCount <= 1) {
        cascadable.push(org);
      } else {
        blocked.push({ name: org.name, otherMemberCount: memberCount - 1 });
      }
    }

    if (blocked.length > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: blocked
          .map(
            (b) =>
              `该用户仍是组织「${b.name}」的唯一所有者（组织内还有 ${b.otherMemberCount} 名其他成员），请先移交所有者`,
          )
          .join("；"),
      });
    }

    for (const org of cascadable) {
      await tx.organization.delete({ where: { id: org.id } });
    }
    deletedOrganizations = cascadable;
  }

  // 组织先删（cascade 顺带清掉该用户的 membership 行），再删用户本体
  await tx.user.delete({ where: { id: userId } });

  return { deletedOrganizations };
}
