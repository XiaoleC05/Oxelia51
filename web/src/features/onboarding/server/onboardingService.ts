import {
  type Prisma,
  type PrismaClient,
  Role,
  SurveyName,
} from "@oxelia51/shared/src/db";
import { resolveProjectRole } from "@oxelia51/shared/src/server";
import { env } from "@/src/env.mjs";
import { auditLog } from "@/src/features/audit-logs/auditLog";
import {
  organizationRoleAccessRights,
  type OrganizationScope,
} from "@/src/features/rbac/constants/organizationAccessRights";
import { projectRoleAccessRights } from "@/src/features/rbac/constants/projectAccessRights";

/** Oxelia51：组织/项目模块已删除，onboarding 完成后静默直跳个人工作台。 */
const WORKSPACE_HOME = "/app";

const DEFAULT_STARTER_PROJECT_NAME = "My Project";
const STARTER_ORGANIZATION_METADATA = {
  langfuseOnboarding: {
    starterOrganization: true,
  },
} as const;

const getStarterOrganizationName = (userName?: string | null) => {
  const firstName = userName?.trim().split(/\s+/)[0];

  return firstName ? `${firstName}'s Organization` : "My Organization";
};

const getRealOrganizationMembershipWhereClause = (
  userId: string,
): NonNullable<
  NonNullable<
    Parameters<
      | Prisma.OrganizationMembershipDelegate["findMany"]
      | Prisma.OrganizationMembershipDelegate["count"]
    >[0]
  >["where"]
> => ({
  userId,
  ...(env.NEXT_PUBLIC_DEMO_ORG_ID
    ? { orgId: { not: env.NEXT_PUBLIC_DEMO_ORG_ID } }
    : {}),
});

const getRealOrganizationMemberships = ({
  prisma,
  userId,
}: {
  prisma: Pick<PrismaClient, "organizationMembership">;
  userId: string;
}) =>
  prisma.organizationMembership.findMany({
    where: getRealOrganizationMembershipWhereClause(userId),
    include: {
      ProjectMemberships: true,
      organization: {
        include: {
          projects: {
            where: {
              deletedAt: null,
            },
            orderBy: [
              {
                createdAt: "asc",
              },
              {
                id: "asc",
              },
            ],
          },
        },
      },
    } satisfies Prisma.OrganizationMembershipInclude,
    orderBy: [
      {
        createdAt: "asc",
      },
      {
        id: "asc",
      },
    ],
  });

export type RealOrganizationMembership = Awaited<
  ReturnType<typeof getRealOrganizationMemberships>
>[number];

export type OnboardingRedirectTarget = {
  redirectTo: string;
  orgId?: string;
};

const getAccessibleProjects = (
  organizationMemberships: RealOrganizationMembership[],
) =>
  organizationMemberships.flatMap((membership) =>
    membership.organization.projects
      .map((project) => ({
        projectId: project.id,
        role: resolveProjectRole({
          projectId: project.id,
          projectMemberships: membership.ProjectMemberships,
          orgMembershipRole: membership.role,
        }),
      }))
      .filter((project) =>
        projectRoleAccessRights[project.role].includes("project:read"),
      ),
  );

const getFirstOrganizationWithProjectCreationAccess = (
  organizationMemberships: RealOrganizationMembership[],
) =>
  organizationMemberships.find((membership) =>
    ((role: Role, scope: OrganizationScope): boolean =>
      organizationRoleAccessRights[role].includes(scope))(
      membership.role,
      "projects:create",
    ),
  );

/**
 * onboarding 完成后的落地地址：组织/项目页面已随模块删除，
 * 恒为个人工作台 /app。保留 async 签名以兼容既有调用方。
 */
export const resolveOnboardingRedirectTargetWithFallback = async (): Promise<OnboardingRedirectTarget> => ({
  redirectTo: WORKSPACE_HOME,
});

export const getCloudSignupOnboardingStatus = async ({
  prisma,
  userId,
}: {
  prisma: Pick<PrismaClient, "survey">;
  userId: string;
}) => {
  const completedSurvey = await prisma.survey.findFirst({
    where: {
      userId,
      surveyName: SurveyName.USER_ONBOARDING,
    },
    select: {
      id: true,
    },
  });

  if (!completedSurvey) {
    return {
      completed: false as const,
    };
  }

  const redirectTarget = await resolveOnboardingRedirectTargetWithFallback();

  return {
    completed: true as const,
    redirectTo: redirectTarget.redirectTo,
  };
};

export const completeCloudSignupOnboarding = async ({
  prisma,
  userId,
  userEmail,
  referralSource,
}: {
  prisma: PrismaClient;
  userId: string;
  userEmail?: string | null;
  referralSource?: string;
}) =>
  prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id
      FROM users
      WHERE id = ${userId}
      FOR UPDATE
    `;

    const existingSurvey = await tx.survey.findFirst({
      where: {
        userId,
        surveyName: SurveyName.USER_ONBOARDING,
      },
      select: {
        id: true,
      },
    });

    const redirectTarget = await resolveOnboardingRedirectTargetWithFallback();

    if (!existingSurvey) {
      const normalizedReferralSource = referralSource?.trim();

      await tx.survey.create({
        data: {
          surveyName: SurveyName.USER_ONBOARDING,
          response: normalizedReferralSource
            ? {
                referralSource: normalizedReferralSource,
              }
            : {},
          userId,
          userEmail: userEmail ?? undefined,
        },
      });
    }

    return {
      redirectTo: redirectTarget.redirectTo,
    };
  });

export const provisionStarterOrganizationForNewUser = async ({
  prisma,
  userId,
  userName,
}: {
  prisma: PrismaClient;
  userId: string;
  userName?: string | null;
}) => {
  const createdResources = await prisma.$transaction(async (tx) => {
    // Serialize starter provisioning per user so concurrent first-login flows
    // cannot both observe "no real orgs yet" and create duplicate starters.
    await tx.$queryRaw`
      SELECT id
      FROM users
      WHERE id = ${userId}
      FOR UPDATE
    `;

    const realOrganizationMemberships = await getRealOrganizationMemberships({
      prisma: tx,
      userId,
    });

    const accessibleProjects = getAccessibleProjects(
      realOrganizationMemberships,
    );
    const firstOrganizationWithProjectCreationAccess =
      getFirstOrganizationWithProjectCreationAccess(
        realOrganizationMemberships,
      );

    if (accessibleProjects[0] || firstOrganizationWithProjectCreationAccess) {
      // Do not create a starter org if the user already has access to a project or can create projects in an existing org
      return null;
    }

    const organization = await tx.organization.create({
      data: {
        name: getStarterOrganizationName(userName),
        metadata: STARTER_ORGANIZATION_METADATA,
        organizationMemberships: {
          create: {
            userId,
            role: Role.OWNER,
          },
        },
      },
    });

    const project = await tx.project.create({
      data: {
        name: DEFAULT_STARTER_PROJECT_NAME,
        orgId: organization.id,
      },
    });

    return { organization, project };
  });

  if (!createdResources) {
    return null;
  }

  await auditLog(
    {
      resourceType: "organization",
      resourceId: createdResources.organization.id,
      action: "create",
      orgId: createdResources.organization.id,
      orgRole: Role.OWNER,
      userId,
      after: createdResources.organization,
    },
    prisma,
  );

  await auditLog(
    {
      resourceType: "project",
      resourceId: createdResources.project.id,
      action: "create",
      orgId: createdResources.organization.id,
      orgRole: Role.OWNER,
      projectId: createdResources.project.id,
      projectRole: Role.OWNER,
      userId,
      after: createdResources.project,
    },
    prisma,
  );

  return createdResources;
};
