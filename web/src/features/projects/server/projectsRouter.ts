import {
  createTRPCRouter,
  protectedOrganizationProcedure,
  protectedProjectProcedure,
} from "@/src/server/api/trpc";
import * as z from "zod";
import { throwIfNoProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { throwIfNoEntitlement } from "@/src/features/entitlements/server/hasEntitlement";
import { TRPCError } from "@trpc/server";
import { projectNameSchema } from "@/src/features/auth/lib/projectNameSchema";
import { auditLog } from "@/src/features/audit-logs/auditLog";
import { throwIfNoOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { ApiAuthService } from "@/src/features/public-api/server/apiAuth";
import {
  redis,
  commandClickhouse,
  getEnvironmentsForProject,
  logger,
} from "@oxelia51/shared/src/server";
import { StringNoHTMLNonEmpty } from "@oxelia51/shared";
import { buildAdminOrgContext } from "@/src/features/organizations/server/adminOrgContext";

export const projectsRouter = createTRPCRouter({
  create: protectedOrganizationProcedure
    .input(
      z.object({
        name: StringNoHTMLNonEmpty,
        orgId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        session: ctx.session,
        organizationId: input.orgId,
        scope: "projects:create",
      });

      const existingProject = await ctx.prisma.project.findFirst({
        where: {
          name: input.name,
          orgId: input.orgId,
          deletedAt: null,
        },
      });

      if (existingProject) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "A project with this name already exists in your organization",
        });
      }

      const project = await ctx.prisma.project.create({
        data: {
          name: input.name,
          orgId: input.orgId,
        },
      });
      await auditLog({
        session: ctx.session,
        resourceType: "project",
        resourceId: project.id,
        action: "create",
        after: project,
      });

      return {
        id: project.id,
        name: project.name,
        role: "OWNER",
      };
    }),

  update: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
        newName: projectNameSchema.shape.name,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "project:update",
      });

      // check if the project name is already taken by another project
      const otherProjectWithSameName = await ctx.prisma.project.findFirst({
        where: {
          name: input.newName,
          orgId: ctx.session.orgId,
          deletedAt: null,
          id: {
            not: input.projectId,
          },
        },
      });
      if (otherProjectWithSameName) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "A project with this name already exists in your organization",
        });
      }

      const project = await ctx.prisma.project.update({
        where: {
          id: input.projectId,
          orgId: ctx.session.orgId,
        },
        data: {
          name: input.newName,
        },
      });
      await auditLog({
        session: ctx.session,
        resourceType: "project",
        resourceId: input.projectId,
        action: "update",
        after: project,
      });
      return true;
    }),

  setRetention: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
        retention: z.number().int().gte(3).nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "project:update",
      });
      if (input.retention !== null && input.retention > 0) {
        throwIfNoEntitlement({
          entitlement: "data-retention",
          sessionUser: ctx.session.user,
          projectId: input.projectId,
        });
      }

      const project = await ctx.prisma.project.update({
        where: {
          id: input.projectId,
          orgId: ctx.session.orgId,
        },
        data: {
          retentionDays: input.retention,
        },
      });
      await auditLog({
        session: ctx.session,
        resourceType: "project",
        resourceId: input.projectId,
        action: "update",
        after: project,
      });
      return true;
    }),

  delete: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: ctx.session.projectId,
        scope: "project:delete",
      });

      // API keys need to be deleted from cache. Otherwise, they will still be valid.
      await new ApiAuthService(
        ctx.prisma,
        redis,
      ).invalidateCachedProjectApiKeys(input.projectId);

      // 同步删除（原设计：软删 + ProjectDeleteQueue 由 worker 异步清数，但 worker
      // 包已随上游剥离从仓库删除、队列无消费者，任务入队即永久堆积，故改为请求内
      // 直接删干净）。原 worker 的 ClickHouse 步骤针对 traces/observations/scores
      // 等已删功能的表，Oxelia51 不使用，跳过；oxelia51 归属 project 的数据
      // （PG oxelia51.* 与 CH oxelia51.token_events）在此显式清除。
      const project = await ctx.prisma.$transaction(async (tx) => {
        // oxelia51 schema：项目级告警/预算配置与用量统计（无外键约束，需显式清）
        await tx.$executeRaw`
          DELETE FROM oxelia51.alert_channels WHERE project_id = ${input.projectId}
        `;
        await tx.$executeRaw`
          DELETE FROM oxelia51.budget_configs WHERE project_id = ${input.projectId}
        `;
        await tx.$executeRaw`
          DELETE FROM oxelia51.alert_logs WHERE project_id = ${input.projectId}
        `;
        await tx.$executeRaw`
          DELETE FROM oxelia51.daily_stats WHERE project_id = ${input.projectId}
        `;

        // Delete API keys from DB
        await tx.apiKey.deleteMany({
          where: {
            projectId: input.projectId,
            scope: "PROJECT",
          },
        });

        // 硬删项目行：project_memberships / datasets / invitations /
        // trace_sessions 等经 schema onDelete: Cascade 一并清除
        return await tx.project.delete({
          where: {
            id: input.projectId,
            orgId: ctx.session.orgId,
          },
        });
      });

      await auditLog({
        session: ctx.session,
        resourceType: "project",
        resourceId: input.projectId,
        before: project,
        action: "delete",
      });

      // ClickHouse oxelia51.token_events：ALTER ... DELETE 是异步 mutation，
      // 入队即返回；CH 不可达不阻塞删除结果，仅告警（残留随表 TTL 过期，
      // 与 userDeletion 级联路径语义一致）
      try {
        await commandClickhouse({
          query: `ALTER TABLE oxelia51.token_events DELETE WHERE project_id = {projectId: String}`,
          params: { projectId: input.projectId },
          tags: {
            surface: "oxelia51",
            route: "project-delete",
            projectId: input.projectId,
          },
        });
      } catch (error) {
        logger.warn(
          `Failed to purge ClickHouse token_events for deleted project ${input.projectId}`,
          error,
        );
      }

      return true;
    }),

  transfer: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
        targetOrgId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // source org
      throwIfNoOrganizationAccess({
        session: ctx.session,
        organizationId: ctx.session.orgId,
        scope: "projects:transfer_org",
      });
      // destination org
      throwIfNoOrganizationAccess({
        session: ctx.session,
        organizationId: input.targetOrgId,
        scope: "projects:transfer_org",
      });

      const project = await ctx.prisma.project.findUnique({
        where: {
          id: input.projectId,
          deletedAt: null,
        },
      });
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      await auditLog({
        session: ctx.session,
        resourceType: "project",
        resourceId: input.projectId,
        action: "transfer",
        before: { orgId: ctx.session.orgId },
        after: { orgId: input.targetOrgId },
      });

      await ctx.prisma.$transaction([
        ctx.prisma.projectMembership.deleteMany({
          where: {
            projectId: input.projectId,
          },
        }),
        ctx.prisma.project.update({
          where: {
            id: input.projectId,
            orgId: ctx.session.orgId,
          },
          data: {
            orgId: input.targetOrgId,
          },
        }),
      ]);

      // API keys need to be deleted from cache. Otherwise, they will still be valid.
      // It has to be called after the db is done to prevent new API keys from being cached.
      await new ApiAuthService(
        ctx.prisma,
        redis,
      ).invalidateCachedProjectApiKeys(input.projectId);
    }),

  environmentFilterOptions: protectedProjectProcedure
    .input(
      z.object({ projectId: z.string(), fromTimestamp: z.date().optional() }),
    )
    .query(async ({ input }) => getEnvironmentsForProject(input)),

  // Admin-only fallback for useProject: returns the project and its org in the
  // same shape as session.user.organizations[number], since admins are not
  // members of customer projects and have no session entry.
  byId: protectedProjectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx }) => {
      const organization = await buildAdminOrgContext(ctx);
      const project = organization?.projects.find(
        (p) => p.id === ctx.session.projectId,
      );
      if (!organization || !project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      return { project, organization };
    }),
});
