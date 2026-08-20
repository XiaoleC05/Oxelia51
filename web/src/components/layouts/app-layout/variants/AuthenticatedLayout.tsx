/**
 * Authenticated layout variant
 * Full application layout with sidebar and navigation
 * Used for all main application pages when user is authenticated
 */

import { useEffect, useState, type PropsWithChildren } from "react";
import Head from "next/head";
import { useRouter, type NextRouter } from "next/router";
import { SidebarProvider, SidebarInset } from "@/src/components/ui/sidebar";
import { AppSidebar } from "@/src/components/nav/app-sidebar";
import { SidebarPresenceProvider } from "@/src/components/nav/sidebar-presence";
import { Toaster } from "@/src/components/ui/sonner";
import { Layer } from "@/src/components/ui/layer";
import { TopBannerProvider } from "@/src/features/top-banner";
import { VersionUpdateBanner } from "@/src/features/version-update";
import { FilingInfo } from "@/src/components/FilingInfo";
import {
  getAvailableCloudRegionOptions,
  getCloudRegionAuthUrl,
} from "@/src/features/organizations/cloudRegions";
import { useLangfuseCloudRegion } from "@/src/features/organizations/hooks";
import type { Session } from "next-auth";
import type { NavigationItem } from "@/src/components/layouts/utilities/routes";
import type { RouteGroup } from "@/src/components/layouts/routes";
import dynamic from "next/dynamic";

const CommandMenu = dynamic(
  () =>
    import("@/src/features/command-k-menu/CommandMenu").then((mod) => ({
      default: mod.CommandMenu,
    })),
  {
    ssr: false,
  },
);

/** Grouped navigation structure returned by processNavigation */
type GroupedNavigation = {
  ungrouped: NavigationItem[];
  grouped: Partial<Record<RouteGroup, NavigationItem[]>> | null;
  flattened: NavigationItem[];
};

type AuthenticatedLayoutProps = PropsWithChildren<{
  session: Session;
  navigation: {
    mainNavigation: GroupedNavigation;
    secondaryNavigation: GroupedNavigation;
    navigation: NavigationItem[];
  };
  metadata: {
    title: string;
    faviconPath: string;
    favicon256Path: string;
    appleTouchIconPath: string;
  };
  onSignOut: () => void;
}>;

/**
 * Full authenticated layout with all features:
 * - AppSidebar with navigation
 * - Payment banner (conditional)
 * - Support drawer
 * - Command menu (Cmd/Ctrl+K)
 * - Toast notifications
 * - Dynamic page metadata
 */
export function AuthenticatedLayout({
  children,
  session,
  navigation,
  metadata,
  onSignOut,
}: AuthenticatedLayoutProps) {
  const { isLangfuseCloud, region: currentRegion } = useLangfuseCloudRegion();
  const router = useRouter();
  useProjectCookie(router);

  // Safe assertion: AuthenticatedLayout is only rendered after auth checks pass
  // in AppLayout, which guarantees session.user exists at this point
  const user = session.user;

  // Oxelia51：侧边栏宽度可手动拖动调整（localStorage 持久化）
  const [sidebarWidth, setSidebarWidth] = useState(256);
  useEffect(() => {
    const saved = Number(window.localStorage.getItem("oxelia51-sidebar-width"));
    if (saved >= 208 && saved <= 400) setSidebarWidth(saved);
  }, []);
  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(400, Math.max(208, startW + ev.clientX - startX));
      setSidebarWidth(next);
    };
    const onUp = (ev: MouseEvent) => {
      const next = Math.min(400, Math.max(208, startW + ev.clientX - startX));
      window.localStorage.setItem("oxelia51-sidebar-width", String(next));
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  if (!user) {
    // This should never happen due to guards in AppLayout, but TypeScript needs this
    return null;
  }

  const regionMenuItems = getAvailableCloudRegionOptions(currentRegion).map(
    (region) => ({
      name: region.name,
      content: `${region.flag} ${region.name}`,
      onClick: () => {
        if (!region.rootUrl) return;
        window.open(
          getCloudRegionAuthUrl(region.rootUrl, user.email),
          "_blank",
          "noopener,noreferrer",
        );
      },
    }),
  );

  // User navigation items for sidebar dropdown
  const userNavProps = {
    user: {
      name: user.name ?? "",
      email: user.email ?? "",
      avatar: user.image ?? "",
    },
    items: [
      { name: "账户设置", href: "/account/settings" },
      ...(isLangfuseCloud
        ? [
            {
              name: "区域",
              subItems: regionMenuItems,
              content: (
                <>
                  区域
                  <div className="ml-2 inline-flex rounded bg-black/5 p-1 text-xs dark:bg-white/10">
                    当前：{currentRegion}
                  </div>
                </>
              ),
            },
          ]
        : []),
      { name: "退出登录", onClick: onSignOut },
    ],
  };

  return (
    <>
      <Head>
        <title>{metadata.title}</title>
        <link rel="icon" type="image/x-icon" href={metadata.faviconPath} />
        <link
          rel="icon"
          type="image/png"
          sizes="256x256"
          href={metadata.favicon256Path}
        />
        <link rel="apple-touch-icon" href={metadata.appleTouchIconPath} />
      </Head>

      <TopBannerProvider>
        <SidebarPresenceProvider>
          <SidebarProvider
            style={
              { "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties
            }
          >
            <div className="flex h-dvh w-full flex-col">
              <VersionUpdateBanner />
              <div className="pt-banner-offset flex min-h-0 flex-1">
                <AppSidebar
                  navItems={navigation.mainNavigation}
                  secondaryNavItems={navigation.secondaryNavigation}
                  userNavProps={userNavProps}
                  onStartResize={startSidebarResize}
                />
                <SidebarInset className="h-screen-with-banner max-w-full md:peer-data-[state=collapsed]:w-[calc(100vw-var(--sidebar-width-icon))] md:peer-data-[state=expanded]:w-[calc(100vw-var(--sidebar-width))]">
                  <div className="flex h-full flex-col">
                    <div className="flex min-h-0 flex-1 flex-col">
                      {children}
                    </div>
                    {/* Oxelia51 页脚：与登录页统一（品牌 + 链接 + 备案） */}
                    <footer className="bg-background shrink-0 border-t py-1">
                      <FilingInfo variant="full" />
                    </footer>
                  </div>
                  {/* Toasts render in the `toast` overlay layer — the last layer
                      in LAYER_ORDER — so they paint above every overlay (incl. a
                      non-modal peek) by DOM order alone, no z-index. Sonner's
                      Toaster is position:fixed, so nesting it in the fixed
                      full-screen layer container is positionally identical. */}
                  <Layer name="toast">
                    <Toaster visibleToasts={1} />
                  </Layer>
                  <CommandMenu mainNavigation={navigation.navigation} />
                </SidebarInset>
              </div>
            </div>
          </SidebarProvider>
        </SidebarPresenceProvider>
      </TopBannerProvider>
    </>
  );
}

/** useProjectCookie pings the visit beacon so the project sentinel can route the user back here. */
function useProjectCookie(router: NextRouter) {
  const projectId = router.query.projectId;
  useEffect(() => {
    if (typeof projectId !== "string") return;
    fetch(`/api/project/${encodeURIComponent(projectId)}/visit`, {
      method: "POST",
    }).catch(() => {});
  }, [projectId]);
}
