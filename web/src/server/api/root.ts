import { createTRPCRouter } from "@/src/server/api/trpc";
import { projectsRouter } from "@/src/features/projects/server/projectsRouter";
import { projectApiKeysRouter } from "@/src/features/public-api/server/projectApiKeyRouter";
import { membersRouter } from "@/src/features/rbac/server/membersRouter";
import { userAccountRouter } from "@/src/server/api/routers/userAccount";
import { organizationsRouter } from "@/src/features/organizations/server/organizationRouter";
import { organizationApiKeysRouter } from "@/src/features/public-api/server/organizationApiKeyRouter";
import { credentialsRouter } from "@/src/features/auth-credentials/server/credentialsRouter";
import { onboardingRouter } from "@/src/features/onboarding/server/onboardingRouter";
import { oxelia51Router } from "@/src/features/oxelia51/server/oxelia51Router";
import { workspaceRouter } from "@/src/features/oxelia51/server/workspaceRouter";
import { syncRouter } from "@/src/features/oxelia51/server/syncRouter";
import { oxelia51AdminRouter } from "@/src/features/oxelia51/server/adminRouter";
import { proxyKeyRouter } from "@/src/features/oxelia51/server/proxyKeyRouter";
import { siteContentRouter } from "@/src/features/oxelia51/server/siteContentRouter";
import { siteStatsRouter } from "@/src/features/oxelia51/server/siteStatsRouter";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  organizations: organizationsRouter,
  organizationApiKeys: organizationApiKeysRouter,
  projects: projectsRouter,
  userAccount: userAccountRouter,
  projectApiKeys: projectApiKeysRouter,
  members: membersRouter,
  credentials: credentialsRouter,
  onboarding: onboardingRouter,
  oxelia51: oxelia51Router,
  workspace: workspaceRouter,
  sync: syncRouter,
  oxelia51Admin: oxelia51AdminRouter,
  proxyKey: proxyKeyRouter,
  siteContent: siteContentRouter,
  siteStats: siteStatsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
