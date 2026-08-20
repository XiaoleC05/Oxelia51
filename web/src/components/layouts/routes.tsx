import { type Flag } from "@/src/features/feature-flags/types";
import { type ProjectScope } from "@/src/features/rbac/constants/projectAccessRights";
import {
  type LucideIcon,
  Settings,
  Grid2X2,
  Search,
  Home,
  BarChart3,
  Coins,
  Siren,
} from "lucide-react";
import { type ReactNode } from "react";
import { type Entitlement } from "@/src/features/entitlements/constants/entitlements";
import { type Session } from "next-auth";
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
    organization:
      | NonNullable<Session["user"]>["organizations"][number]
      | undefined;
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
  {
    title: "组织",
    pathname: "/",
    icon: Grid2X2,
    show: ({ organization }) => organization === undefined,
    section: RouteSection.Main,
  },
  {
    title: "项目",
    pathname: "/organization/[organizationId]",
    icon: Grid2X2,
    section: RouteSection.Main,
  },
  {
    title: "首页",
    pathname: `/project/[projectId]`,
    icon: Home,
    section: RouteSection.Main,
  },
  {
    title: "Token 概览",
    pathname: `/project/[projectId]/dashboard/tokens`,
    icon: BarChart3,
    group: RouteGroup.TokenStats,
    section: RouteSection.Main,
  },
  {
    title: "成本分析",
    pathname: `/project/[projectId]/dashboard/cost`,
    icon: Coins,
    group: RouteGroup.TokenStats,
    section: RouteSection.Main,
  },
  {
    // Oxelia51：告警设置是产品核心卖点之一，从 Token 统计组移出，提升为一级独立条目
    title: "告警设置",
    pathname: `/project/[projectId]/settings/alerts`,
    icon: Siren,
    section: RouteSection.Main,
  },
  {
    title: "设置",
    pathname: "/project/[projectId]/settings",
    icon: Settings,
    section: RouteSection.Secondary,
    // Oxelia51：项目设置仅在项目上下文显示，避免与组织设置重复
    show: ({ projectId }) => projectId !== undefined,
  },
  {
    title: "设置",
    pathname: "/organization/[organizationId]/settings",
    icon: Settings,
    section: RouteSection.Secondary,
    // 组织设置仅在组织上下文显示
    show: ({ organization }) => organization !== undefined,
  },
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
