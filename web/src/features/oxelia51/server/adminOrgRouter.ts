import { z } from "zod";
import { Prisma, prisma } from "@oxelia51/shared/src/db";
import { redis } from "@oxelia51/shared/src/server";
import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  superAdminProcedure,
} from "@/src/features/oxelia51/server/adminAuth";
import { ApiAuthService } from "@/src/features/public-api/server/apiAuth";

/**
 * 管理台组织/项目清理：废弃组织清单/删除、空项目清单/删除。
 * 每个 procedure 单独导出，由 adminRouter.ts 合并为 tRPC router。
 */

export const adminOrgProcedures = {
  /**
   * 废弃组织清单：无成员（organization_memberships 为空）的组织。
   * 只读列表，管理员先看清单、逐项确认后再用 deleteOrphanedOrg 删除。
   */
  listOrphanedOrgs: adminProcedure.query(async () => {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        created_at: Date;
        project_count: bigint;
      }>
    >`
      SELECT o.id, o.name, o.created_at, COUNT(p.id) AS project_count
      FROM organizations o
      LEFT JOIN projects p ON p.org_id = o.id
      WHERE NOT EXISTS (
        SELECT 1 FROM organization_memberships m WHERE m.org_id = o.id
      )
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 200
    `;
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
        projectCount: Number(r.project_count),
      })),
    };
  }),

  /**
   * 删除废弃组织：仅允许删除无成员的组织（删除前服务端再校验一次）。
   * 按 schema onDelete: Cascade 级联删除其项目/邀请/API key 等。——写操作，仅超级管理员
   * 注意：同 deleteUserWithOrgCascade，不经 ProjectDeleteQueue，ClickHouse 数据随 TTL 过期。
   */
  deleteOrphanedOrg: superAdminProcedure
    .input(z.object({ orgId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const org = await prisma.organization.findUnique({
        where: { id: input.orgId },
        select: { id: true, name: true },
      });
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "组织不存在" });
      }
      await prisma.$transaction(
        async (tx) => {
          const memberCount = await tx.organizationMembership.count({
            where: { orgId: org.id },
          });
          if (memberCount > 0) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `组织「${org.name}」仍有 ${memberCount} 名成员，不能按废弃组织删除`,
            });
          }
          await tx.organization.delete({ where: { id: org.id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await new ApiAuthService(prisma, redis).invalidateCachedOrgApiKeys(
        org.id,
      );
      return { success: true, name: org.name };
    }),

  /**
   * 空项目清单：仍有成员的活跃组织下、「无数据」的项目。
   * 口径（注释即约定）：「无数据」= PG projects.has_traces = false（项目收到首条
   * trace 时置真，轻量、无需 ClickHouse 聚合）且无任何项目级成员（project_memberships）。
   * 无成员组织下的项目不在此列（随「废弃组织」一起清理）。
   */
  listEmptyProjects: adminProcedure.query(async () => {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        org_name: string;
        created_at: Date;
      }>
    >`
      SELECT p.id, p.name, p.created_at, o.name AS org_name
      FROM projects p
      JOIN organizations o ON o.id = p.org_id
      WHERE p.deleted_at IS NULL
        AND p.has_traces = false
        AND NOT EXISTS (
          SELECT 1 FROM project_memberships pm WHERE pm.project_id = p.id
        )
        AND EXISTS (
          SELECT 1 FROM organization_memberships m WHERE m.org_id = o.id
        )
      ORDER BY p.created_at DESC
      LIMIT 200
    `;
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        orgName: r.org_name,
        createdAt: r.created_at,
      })),
    };
  }),

  /** 删除空项目（事务包裹检查+删除，消除 TOCTOU 竞态） */
  deleteEmptyProject: superAdminProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const result = await prisma.$transaction(
        async (tx) => {
          const project = await tx.project.findUnique({
            where: { id: input.projectId },
            select: { id: true, name: true, hasTraces: true, deletedAt: true },
          });
          if (!project || project.deletedAt) {
            throw new TRPCError({ code: "NOT_FOUND", message: "项目不存在" });
          }
          if (project.hasTraces) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `项目「${project.name}」已有 trace 数据，请走项目设置内的常规删除流程`,
            });
          }
          const membershipCount = await tx.projectMembership.count({
            where: { projectId: project.id },
          });
          if (membershipCount > 0) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `项目「${project.name}」仍有项目级成员，不能按空项目删除`,
            });
          }
          await tx.apiKey.deleteMany({
            where: { projectId: project.id, scope: "PROJECT" },
          });
          await tx.project.delete({ where: { id: project.id } });
          return { success: true, name: project.name };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await new ApiAuthService(prisma, redis).invalidateCachedProjectApiKeys(
        input.projectId,
      );
      return result;
    }),
};
