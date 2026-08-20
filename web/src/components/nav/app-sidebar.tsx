"use client";

import * as React from "react";
import { NavMain, type NavMainItem } from "@/src/components/nav/nav-main";
import {
  NavUser,
  type UserNavigationProps,
} from "@/src/components/nav/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarTrigger,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/src/components/ui/sidebar";
import { env } from "@/src/env.mjs";
import { useRouter } from "next/router";
import Link from "next/link";
import { Oxelia51Logo } from "@/src/components/Oxelia51Logo";
import { MobileNavSwitcher } from "@/src/components/nav/mobile-nav-switcher";
import { type RouteGroup } from "@/src/components/layouts/routes";
import { ExternalLink, Grid2X2 } from "lucide-react";
import { useLangfuseCloudRegion } from "@/src/features/organizations/hooks";
import { Oxelia51ThemeToggle } from "@/src/features/theming/Oxelia51ThemeToggle";
import { Oxelia51ColorSettings } from "@/src/features/theming/Oxelia51ColorSettings";
import { FeedbackDialog } from "@/src/features/oxelia51/components/FeedbackDialog";
import { AdminSidebarEntry } from "@/src/features/oxelia51/components/admin/AdminSidebarEntry";
import { OXELIA_DOCS_URL } from "@/src/features/oxelia51/constants";

type AppSidebarProps = {
  navItems: {
    grouped: Partial<Record<RouteGroup, NavMainItem[]>> | null;
    ungrouped: NavMainItem[];
    flattened: NavMainItem[];
  };
  secondaryNavItems: {
    grouped: Partial<Record<RouteGroup, NavMainItem[]>> | null;
    ungrouped: NavMainItem[];
    flattened: NavMainItem[];
  };
  userNavProps: UserNavigationProps;
  /** Oxelia51：右缘拖动调宽回调 */
  onStartResize?: (e: React.MouseEvent) => void;
} & React.ComponentProps<typeof Sidebar>;

export function AppSidebar({
  navItems,
  secondaryNavItems,
  userNavProps,
  onStartResize,
  ...props
}: AppSidebarProps) {
  const { isMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon" variant="sidebar" {...props}>
      <SidebarHeader>
        <div className="flex min-h-9 items-center gap-2 py-2 pr-2 pl-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:p-2">
          <Oxelia51Logo version />
          {/* Oxelia51：侧栏展开/收起按钮。折叠态下不隐藏，
              图标自动切换为「展开」，保证收起后仍可展开。 */}
          <SidebarTrigger className="ml-auto hidden h-7 w-7 shrink-0 group-data-[collapsible=icon]:ml-0 md:flex" />
        </div>
        <div className="h-1 flex-1 border-b" />
        <DemoBadge />
      </SidebarHeader>
      <SidebarContent>
        {isMobile && <MobileNavSwitcher />}
        <NavMain items={navItems} />
        <div className="flex-1" />
        {/* oxelia51 fork: the upstream sidebar notification stack (Langfuse
            launch-week promo cards + GitHub star card) was removed. */}
        {/* 辅助功能：与主导航分隔，折叠态隐藏分隔线 */}
        {(secondaryNavItems.ungrouped.length > 0 ||
          Object.keys(secondaryNavItems.grouped ?? {}).length > 0) && (
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="mx-2 border-t" />
            <NavMain items={secondaryNavItems} />
          </div>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 pb-2">
          <Oxelia51ThemeToggle />
          <Oxelia51ColorSettings />
          <FeedbackDialog />
          {/* 管理台入口：仅管理员可见 */}
          <AdminSidebarEntry />
        </div>
        <NavUser {...userNavProps} />
      </SidebarFooter>
      {/* Oxelia51：自研 Rail——点击收起/展开，拖动调整宽度。
          原生 SidebarRail（z-50 w-4 隐形按钮）会盖住独立手柄，故二合一。 */}
      <SidebarResizeRail onStartResize={onStartResize} />
    </Sidebar>
  );
}

const DemoBadge = () => {
  const router = useRouter();
  const { isLangfuseCloud } = useLangfuseCloudRegion();
  const routerProjectId = router.query.projectId as string | undefined;

  if (
    !(
      env.NEXT_PUBLIC_DEMO_ORG_ID &&
      env.NEXT_PUBLIC_DEMO_PROJECT_ID &&
      routerProjectId === env.NEXT_PUBLIC_DEMO_PROJECT_ID &&
      isLangfuseCloud
    )
  )
    return null;

  return (
    <SidebarGroup className="border-b">
      <SidebarGroupLabel>演示项目（只读）</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="使用演示应用创建追踪"
              variant="cta"
            >
              <Link
                href={OXELIA_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                <span>使用演示应用</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="您的 Oxelia51 组织">
              <Link href="/">
                <Grid2X2 className="h-4 w-4" />
                <span>您的 Oxelia51 组织</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

/** 点击切换侧栏；按住横向拖动调整宽度（阈值 4px 区分点击与拖动）。 */
function SidebarResizeRail({
  onStartResize,
}: {
  onStartResize?: (e: React.MouseEvent) => void;
}) {
  const { toggleSidebar } = useSidebar();
  const dragState = React.useRef<{ startX: number; dragging: boolean }>({
    startX: 0,
    dragging: false,
  });

  return (
    <button
      type="button"
      data-sidebar="rail"
      aria-label="拖动调整宽度，点击收起侧栏"
      tabIndex={-1}
      title="拖动调整宽度 · 点击收起"
      onMouseDown={(e) => {
        dragState.current = { startX: e.clientX, dragging: false };
        onStartResize?.(e);
      }}
      onClick={(e) => {
        // 拖动（位移 > 4px）不触发收起
        if (Math.abs(e.clientX - dragState.current.startX) > 4) return;
        toggleSidebar();
      }}
      className="hover:after:bg-sidebar-accent absolute inset-y-0 z-50 hidden w-4 -translate-x-1/2 cursor-col-resize transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] md:flex"
    />
  );
}
