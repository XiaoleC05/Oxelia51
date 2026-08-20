import { BookOpen, LockIcon, Settings, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Separator } from "@/src/components/ui/separator";
import Header from "@/src/components/layouts/header";
import { Button } from "@/src/components/ui/button";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { StringParam, useQueryParams } from "use-query-params";
import { Input } from "@/src/components/ui/input";
import { useHasOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { env } from "@/src/env.mjs";
import { Fragment } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import {
  createOrganizationRoute,
  createProjectRoute,
} from "@/src/features/setup/setupRoutes";
import { isCloudPlan, planLabels } from "@oxelia51/shared";
import ContainerPage from "@/src/components/layouts/container-page";
import { type Session } from "next-auth";
import { usePostHogClientCapture } from "@/src/features/posthog-analytics/usePostHogClientCapture";
import { OXELIA_DOCS_URL } from "@/src/features/oxelia51/constants";

const OrganizationProjectTiles = ({
  org,
  search,
}: {
  org: NonNullable<Session["user"]>["organizations"][number];
  search?: string;
}) => {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {org.projects
        .filter(
          (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()),
        )
        .map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle className="truncate text-base" title={project.name}>
                {project.name}
              </CardTitle>
            </CardHeader>
            {!project.deletedAt ? (
              <CardFooter className="gap-2">
                <Button asChild variant="secondary">
                  <Link href={`/project/${project.id}`}>进入项目</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href={`/project/${project.id}/settings`}>
                    <Settings size={16} />
                  </Link>
                </Button>
              </CardFooter>
            ) : (
              <CardContent>
                <CardDescription>项目正在删除中</CardDescription>
              </CardContent>
            )}
          </Card>
        ))}
    </div>
  );
};

const DemoOrganizationTile = () => {
  const capture = usePostHogClientCapture();

  return (
    <Card>
      <CardHeader>
        <CardTitle>试用 Oxelia51 演示</CardTitle>
      </CardHeader>
      <CardContent>
        我们构建了一个基于 Oxelia51 文档回答问题的问答机器人。 与它交互即可在
        Oxelia51 中查看追踪。
      </CardContent>
      <CardFooter>
        <Button asChild variant="secondary">
          <Link
            href={`/project/${env.NEXT_PUBLIC_DEMO_PROJECT_ID}/traces`}
            onClick={() =>
              capture("organizations:demo_project_button_click", {
                location: "project_overview_demo_tile",
              })
            }
          >
            查看演示项目
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

const OrganizationActionButtons = ({
  orgId,
  primaryButtonVariant = "default",
}: {
  orgId: string;
  primaryButtonVariant?: "default" | "secondary";
}) => {
  const membersViewAccess = useHasOrganizationAccess({
    organizationId: orgId,
    scope: "organizationMembers:read",
  });
  const createProjectAccess = useHasOrganizationAccess({
    organizationId: orgId,
    scope: "projects:create",
  });

  return (
    <>
      <Button asChild variant="ghost">
        <Link href={`/organization/${orgId}/settings`}>
          <Settings size={14} />
        </Link>
      </Button>
      {membersViewAccess && (
        <Button asChild variant="ghost">
          <Link href={`/organization/${orgId}/settings/members`}>
            <Users size={14} />
          </Link>
        </Button>
      )}
      {createProjectAccess ? (
        <Button asChild variant={primaryButtonVariant}>
          <Link href={createProjectRoute(orgId)}>
            <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            新建项目
          </Link>
        </Button>
      ) : (
        <Button disabled variant={primaryButtonVariant}>
          <LockIcon className="mr-2 h-4 w-4" aria-hidden="true" />
          新建项目
        </Button>
      )}
    </>
  );
};

const SingleOrganizationPage = ({
  orgId,
  search,
}: {
  orgId: string;
  search?: string;
}) => {
  const session = useSession();
  const org = session.data?.user?.organizations.find((o) => o.id === orgId);

  if (!org) {
    return null;
  }

  const isDemoOrg =
    env.NEXT_PUBLIC_DEMO_ORG_ID === orgId &&
    org.projects.some((p) => p.id === env.NEXT_PUBLIC_DEMO_PROJECT_ID);

  if (isDemoOrg) {
    return (
      <ContainerPage
        headerProps={{
          title: "演示组织",
        }}
      >
        <DemoOrganizationTile />
      </ContainerPage>
    );
  }

  return (
    <ContainerPage
      headerProps={{
        title: org?.name ?? "组织",
        actionButtonsRight: <OrganizationActionButtons orgId={orgId} />,
      }}
    >
      <OrganizationProjectTiles org={org} search={search} />
    </ContainerPage>
  );
};

const SingleOrganizationProjectOverviewTile = ({
  orgId,
  search,
}: {
  orgId: string;
  search?: string;
}) => {
  const session = useSession();
  const org = session.data?.user?.organizations.find((o) => o.id === orgId);

  if (!org) {
    return null;
  }

  const isDemoOrg =
    env.NEXT_PUBLIC_DEMO_ORG_ID === orgId &&
    org.projects.some((p) => p.id === env.NEXT_PUBLIC_DEMO_PROJECT_ID);

  if (isDemoOrg) {
    return (
      <div key={orgId}>
        <DemoOrganizationTile />
      </div>
    );
  }

  return (
    <div key={orgId}>
      <Header
        title={org.name}
        className="truncate"
        status={orgId === env.NEXT_PUBLIC_DEMO_ORG_ID ? "演示组织" : undefined}
        label={
          isCloudPlan(org.plan)
            ? {
                text: planLabels[org.plan],
                href: `/organization/${org.id}/settings/billing`,
              }
            : undefined
        }
        actionButtons={
          <OrganizationActionButtons
            orgId={orgId}
            primaryButtonVariant="secondary"
          />
        }
      />
      <OrganizationProjectTiles org={org} search={search} />
    </div>
  );
};

export const OrganizationProjectOverview = () => {
  const router = useRouter();
  const queryOrgId = router.query.organizationId;
  const session = useSession();
  const canCreateOrg = session.data?.user?.canCreateOrganizations;
  const organizations = session.data?.user?.organizations;
  const [{ search }, setQueryParams] = useQueryParams({ search: StringParam });

  if (organizations === undefined) {
    return "加载中…";
  }

  const showOnboarding =
    organizations.filter((org) => org.id !== env.NEXT_PUBLIC_DEMO_ORG_ID)
      .length === 0 && !queryOrgId;

  if (queryOrgId) {
    const org = organizations.find((org) => org.id === queryOrgId);

    if (!org) {
      return null;
    }

    return (
      <SingleOrganizationPage orgId={org.id} search={search ?? undefined} />
    );
  }

  return (
    <ContainerPage
      headerProps={{
        title: "组织",
        help: {
          description:
            "组织帮助您管理对项目的访问权限。每个组织可以拥有多个项目以及承担不同角色的团队成员。",
          href: OXELIA_DOCS_URL,
        },
        breadcrumb: [
          {
            name: "组织",
            href: "/",
          },
        ],
        actionButtonsRight: (
          <>
            <Input
              className="mr-1 w-36 lg:w-56"
              placeholder="搜索项目"
              onChange={(e) => setQueryParams({ search: e.target.value })}
            />
            {canCreateOrg && (
              <Button data-testid="create-organization-btn" asChild>
                <Link href={createOrganizationRoute}>
                  <PlusIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  新建组织
                </Link>
              </Button>
            )}
          </>
        ),
      }}
    >
      {showOnboarding && <Onboarding />}
      {organizations
        .map((org) => {
          const isDemo = env.NEXT_PUBLIC_DEMO_ORG_ID === org.id;
          return [org, isDemo] as const;
        })
        .sort(([, isDemoA], [, isDemoB]) => {
          if (isDemoA) return 1;
          if (isDemoB) return -1;
          return 0;
        })
        .map(([org, isDemo], index) => {
          return (
            <Fragment key={org.id}>
              {!queryOrgId && isDemo && <Separator className="my-8" />}
              <div key={org.id} className={index > 0 && !isDemo ? "mt-8" : ""}>
                <SingleOrganizationProjectOverviewTile
                  orgId={org.id}
                  search={search ?? undefined}
                />
              </div>
            </Fragment>
          );
        })}
    </ContainerPage>
  );
};

const Onboarding = () => {
  const session = useSession();
  const canCreateOrgs = session.data?.user?.canCreateOrganizations;
  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle data-testid="create-new-project-title">开始使用</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>
          {canCreateOrgs
            ? "创建一个组织即可开始使用。或者，请您的组织管理员邀请您加入。"
            : "您需要被邀请加入某个组织才能开始使用 Oxelia51。"}
        </CardDescription>
      </CardContent>
      <CardFooter className="flex gap-4">
        {canCreateOrgs && (
          <Button data-testid="create-project-btn" asChild>
            <Link href={createOrganizationRoute}>
              <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              新建组织
            </Link>
          </Button>
        )}
        <Button variant="secondary" asChild>
          {/* oxelia51 fork: points to the in-product landing page (上手教程)
              instead of the upstream docs site; the "问助手" (ask-ai)
              button was removed as this fork has no ask-ai backend. */}
          <Link href="/">
            <BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
            文档
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};
