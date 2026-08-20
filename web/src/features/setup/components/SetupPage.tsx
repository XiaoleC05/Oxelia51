import Header from "@/src/components/layouts/header";
import ContainerPage from "@/src/components/layouts/container-page";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/src/components/ui/breadcrumb";
import { Card } from "@/src/components/ui/card";
import { NewOrganizationForm } from "@/src/features/organizations/components/NewOrganizationForm";
import { NewProjectForm } from "@/src/features/projects/components/NewProjectForm";
import { useQueryProjectOrOrganization } from "@/src/features/projects/hooks";
import { createProjectRoute } from "@/src/features/setup/setupRoutes";
import { cn } from "@/src/utils/tailwind";
import { Check } from "lucide-react";
import { useRouter } from "next/router";

// Manual setup process
// 1. Create Organization: /setup
// 2. Create Project: /organization/:orgId/setup?orgstep=create-project
export function SetupPage() {
  const { organization } = useQueryProjectOrOrganization();
  const router = useRouter();

  // starts at 1 to align with breadcrumb
  const stepInt = organization ? 2 : 1;

  return (
    <ContainerPage
      headerProps={{
        title: "初始设置",
        help: {
          description: "创建新组织。组织用于管理你的项目和团队。",
        },
        ...(stepInt === 1 && {
          breadcrumb: [
            {
              name: "组织",
              href: "/",
            },
          ],
        }),
      }}
    >
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage
              className={cn(
                stepInt !== 1
                  ? "text-muted-foreground"
                  : "text-foreground font-bold",
              )}
            >
              1. 创建组织
              {stepInt > 1 && <Check className="ml-1 inline-block h-3 w-3" />}
            </BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage
              className={cn(
                stepInt !== 2
                  ? "text-muted-foreground"
                  : "text-foreground font-bold",
              )}
            >
              2. 创建项目
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Card className="p-3">
        {
          // 1. Create Org
          stepInt === 1 && (
            <div>
              <Header title="新建组织" />
              <p className="text-muted-foreground mb-4 text-sm">
                组织用于管理你的项目和团队。
              </p>
              <NewOrganizationForm
                onSuccess={(orgId) => {
                  router.push(createProjectRoute(orgId));
                }}
              />
            </div>
          )
        }
        {
          // 2. Create Project
          stepInt === 2 && organization && (
            <div>
              <Header title="新建项目" />
              <p className="text-muted-foreground mb-4 text-sm">
                项目用于对追踪、数据集、评估和提示词进行分组。
                可使用内置的环境功能隔离不同环境。
              </p>
              <NewProjectForm
                orgId={organization.id}
                onSuccess={(projectId) =>
                  router.push(`/project/${projectId}/traces`)
                }
              />
            </div>
          )
        }
      </Card>
    </ContainerPage>
  );
}
