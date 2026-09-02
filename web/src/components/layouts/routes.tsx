import { type Flag } from "@/src/features/feature-flags/types";
import { type ProjectScope } from "@/src/features/rbac/constants/projectAccessRights";
import { type LucideIcon, Search } from "lucide-react";
import { type ReactNode } from "react";
import { type Entitlement } from "@/src/features/entitlements/constants/entitlements";
import { type OrganizationScope } from "@/src/features/rbac/constants/organizationAccessRights";
// Oxelia51：「快速预览」(V4SidebarToggle) 与「更新」(V4MigrationNavItem) 入口已随 v4 迁移功能一并删除
import { SidebarMenuButton } from "@/src/components/ui/sidebar";
import { KeyboardShortcut } from "@/src/components/ui/keyboard-shortcut";
import { useCommandMenu } from "@/src/features/command-k-menu/CommandMenuProvider";
import { usePostHogClientCapture } from "@/src/features/posthog-analytics/usePostHogClientCapture";

export enum RouteSection {
  Main = "main",
  Secondary = "secondary",
}

export enum RouteGroup {
  TokenStats = "Token 统计",
  // Oxelia51：管理台已迁出业务侧栏（独立 /admin 区域），不再设导航分组
}

export type Route = {
  title: string;
  menuNode?: ReactNode;
  featureFlag?: Flag;
  label?: string | ReactNode;
  projectRbacScopes?: ProjectScope[]; // array treated as OR
  organizationRbacScope?: OrganizationScope;
  icon?: LucideIcon; // ignored for nested routes
  pathname: string; // link
  items?: Array<Route>; // folder
  section?: RouteSection; // which section of the sidebar (top/main/bottom)
  newTab?: boolean; // open in new tab
  entitlements?: Entitlement[]; // entitlements required, array treated as OR
  show?: (p: {
    projectId: string | undefined;
    isLangfuseCloud: boolean;
  }) => boolean;
  group?: RouteGroup; // group this route belongs to (within a section)
};

export const ROUTES: Route[] = [
  {
    title: "前往...",
    pathname: "", // Empty pathname since this is a dropdown
    icon: Search,
    menuNode: <CommandMenuTrigger />,
    section: RouteSection.Main,
  },
  // Oxelia51：业务导航由 /app 工作区侧栏承载；原「首页/Token 概览/成本分析/告警设置」
  // 四个 /project/[projectId] 入口随组织/项目模块一并删除。
];

function CommandMenuTrigger() {
  const { setOpen } = useCommandMenu();
  const capture = usePostHogClientCapture();

  return (
    <SidebarMenuButton
      onClick={() => {
        capture("cmd_k_menu:opened", {
          source: "main_navigation",
        });
        setOpen(true);
      }}
      className="whitespace-nowrap"
    >
      <Search className="h-4 w-4" />
      前往...
      <KeyboardShortcut
        className="ml-auto"
        keys={[navigator.userAgent.includes("Mac") ? "⌘" : "Ctrl", "K"]}
      />
    </SidebarMenuButton>
  );
}
