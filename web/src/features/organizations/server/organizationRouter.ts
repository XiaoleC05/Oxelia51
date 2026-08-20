import {
  createTRPCRouter,
  protectedOrganizationProcedure,
  authenticatedProcedure,
} from "@/src/server/api/trpc";
import { auditLog } from "@/src/features/audit-logs/auditLog";
import {
  organizationOptionalNameSchema,
  organizationNameSchema,
} from "@/src/features/organizations/utils/organizationNameSchema";
import * as z from "zod";
import { throwIfNoOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { TRPCError } from "@trpc/server";
import { ApiAuthService } from "@/src/features/public-api/server/apiAuth";
import {
  getLastTraceTimestampsByProjects,
  redis,
} from "@oxelia51/shared/src/server";
import { buildAdminOrgContext } from "@/src/features/organizations/server/adminOrgContext";

import { env } from "@/src/env.mjs";

export const organizationsRouter = createTRPCRouter({
  // Admin-only fallback for useOrganization: returns the org in the same shape
  // as session.user.organizations[number], since admins are not members of
  // customer orgs and have no session entry.
  byId: protectedOrganizationProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx }) => {
      const organization = await buildAdminOrgContext(ctx);
      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "未找到组织",
        });
      }
      return organization;
    }),
  lastTraceByProject: protectedOrganizationProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx }) => {
      const organization =
        ctx.session.user.admin === true
          ? await buildAdminOrgContext(ctx)
          : ctx.session.user.organizations.find(
              (org) => org.id === ctx.session.orgId,
            );

      return getLastTraceTimestampsByProjects({
        projectIds: organization?.projects.map((project) => project.id) ?? [],
      });
    }),
  create: authenticatedProcedure
    .input(organizationNameSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session.user.canCreateOrganizations)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "你没有创建组织的权限",
        });

      const organization = await ctx.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: input.name,
            organizationMemberships: {
              create: {
                userId: ctx.session.user.id,
                role: "OWNER",
              },
            },
          },
        });

        return organization;
      });
      await auditLog({
        resourceType: "organization",
        resourceId: organization.id,
        action: "create",
        orgId: organization.id,
        orgRole: "OWNER",
        userId: ctx.session.user.id,
        after: organization,
      });

      return {
        id: organization.id,
        name: organization.name,
        role: "OWNER",
      };
    }),
  update: protectedOrganizationProcedure
    .input(
      organizationOptionalNameSchema
        .extend({
          orgId: z.string(),
          aiFeaturesEnabled: z.boolean().optional(),
          aiTelemetryEnabled: z.boolean().optional(),
        })
        .refine(
          (data) =>
            data.name ||
            data.aiFeaturesEnabled !== undefined ||
            data.aiTelemetryEnabled !== undefined,
          {
            message:
              "名称、aiFeaturesEnabled 或 aiTelemetryEnabled 至少需提供一项",
          },
        ),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        session: ctx.session,
        organizationId: input.orgId,
        scope: "organization:update",
      });

      if (
        (input.aiFeaturesEnabled !== undefined ||
          input.aiTelemetryEnabled !== undefined) &&
        !env.NEXT_PUBLIC_LANGFUSE_CLOUD_REGION
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "AI 功能在自托管部署中不可用。",
        });
      }

      const beforeOrganization = await ctx.prisma.organization.findFirst({
        where: {
          id: input.orgId,
        },
      });
      const afterOrganization = await ctx.prisma.organization.update({
        where: {
          id: input.orgId,
        },
        data: {
          name: input.name,
          aiFeaturesEnabled: input.aiFeaturesEnabled,
          aiTelemetryEnabled: input.aiTelemetryEnabled,
        },
      });

      await auditLog({
        session: ctx.session,
        resourceType: "organization",
        resourceId: input.orgId,
        action: "update",
        before: beforeOrganization,
        after: afterOrganization,
      });

      return true;
    }),
  delete: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        session: ctx.session,
        organizationId: input.orgId,
        scope: "organization:delete",
      });

      // count non-deleted projects
      const countNonDeletedProjects = await ctx.prisma.project.count({
        where: {
          orgId: input.orgId,
          deletedAt: null,
        },
      });

      // count all projects (including soft-deleted)
      const countAllProjects = await ctx.prisma.project.count({
        where: {
          orgId: input.orgId,
        },
      });

      if (countNonDeletedProjects > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "请先删除或转移所有项目，然后再删除组织。",
        });
      }

      if (countAllProjects > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Deletion of your projects is still being processed, please try deleting the organization later",
        });
      }

      const organization = await ctx.prisma.organization.delete({
        where: {
          id: input.orgId,
        },
      });

      // the api keys contain which org they belong to, so we need to remove them from Redis
      await new ApiAuthService(ctx.prisma, redis).invalidateCachedOrgApiKeys(
        input.orgId,
      );

      await auditLog({
        session: ctx.session,
        resourceType: "organization",
        resourceId: input.orgId,
        action: "delete",
        before: organization,
      });

      return true;
    }),
});
