import Head from "next/head";
import { useRouter } from "next/router";
import {
  Bell,
  LayoutDashboard,
  MessageSquare,
  PenSquare,
  Server,
  Settings,
  Shield,
  Users,
  Wrench,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { AdminShell } from "@/src/features/oxelia51/components/admin/AdminShell";
import { AdminGate } from "@/src/features/oxelia51/components/admin/AdminGate";
import { OverviewTab } from "@/src/features/oxelia51/components/admin/OverviewTab";
import { FeedbackTab } from "@/src/features/oxelia51/components/admin/FeedbackTab";
import { UsersTab } from "@/src/features/oxelia51/components/admin/UsersTab";
import { SystemTab } from "@/src/features/oxelia51/components/admin/SystemTab";
import { SecurityTab } from "@/src/features/oxelia51/components/admin/SecurityTab";
import { ToolsTab } from "@/src/features/oxelia51/components/admin/ToolsTab";
import { AlertsTab } from "@/src/features/oxelia51/components/admin/AlertsTab";
import { SettingsTab } from "@/src/features/oxelia51/components/admin/SettingsTab";
import { ContentTab } from "@/src/features/oxelia51/components/admin/ContentTab";

const NAV_ITEMS = [
  { value: "overview", label: "总览", icon: LayoutDashboard },
  { value: "feedback", label: "用户反馈", icon: MessageSquare },
  { value: "users", label: "用户管理", icon: Users },
  { value: "system", label: "系统状态", icon: Server },
  { value: "security", label: "安全", icon: Shield },
  { value: "tools", label: "工具", icon: Wrench },
  { value: "alerts", label: "告警", icon: Bell },
  { value: "settings", label: "设置", icon: Settings },
  { value: "content", label: "内容编辑", icon: PenSquare },
] as const;

type TabValue = (typeof NAV_ITEMS)[number]["value"];

const TAB_VALUES = new Set<string>(NAV_ITEMS.map((item) => item.value));

const DEFAULT_TAB: TabValue = "overview";

/**
 * Oxelia51 独立管理台（/admin）。
 * 三态门控见 AdminGate；布局：桌面端左侧纵向导航（sticky），移动端回落为顶部横向滚动 tabs。
 * Tab 与 URL 深链同步：?tab=xxx 决定初始 Tab（非法值回落总览），
 * 切换时 router.replace 浅路由写回，刷新 / 分享链接保持当前 Tab。
 */
export default function AdminConsolePage() {
  const router = useRouter();
  const rawTab = router.query.tab;
  const tab: TabValue =
    typeof rawTab === "string" && TAB_VALUES.has(rawTab)
      ? (rawTab as TabValue)
      : DEFAULT_TAB;

  const handleTabChange = (value: string) => {
    void router.replace(
      { pathname: "/admin", query: { tab: value } },
      undefined,
      { shallow: true },
    );
  };

  return (
    <>
      <Head>
        <title>管理台 | Oxelia51</title>
      </Head>
      <AdminShell>
        <AdminGate>
          <Tabs
            value={tab}
            onValueChange={handleTabChange}
            className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6"
          >
            {/* 导航：移动端顶部横向滚动（右侧渐变遮罩提示可滚），桌面端左侧纵向 sticky */}
            <div className="relative shrink-0 md:contents">
              <TabsList className="flex h-auto w-full flex-row items-stretch justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 pr-6 md:sticky md:top-14 md:w-52 md:flex-col md:pr-0">
                {NAV_ITEMS.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="text-muted-foreground h-9 shrink-0 justify-start gap-2 rounded-md px-3 text-sm whitespace-nowrap transition-colors hover:bg-[var(--ox-bg-alt)] hover:text-[var(--ox-text-h)] data-[state=active]:bg-[var(--ox-bg-alt)] data-[state=active]:font-bold data-[state=active]:text-[var(--ox-accent)] data-[state=active]:shadow-none md:data-[state=active]:shadow-[inset_3px_0_0_0_var(--ox-accent)]"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {/* 移动端横滚渐变遮罩（提示右侧还有内容） */}
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--ox-bg)] to-transparent md:hidden" />
            </div>
            {/* key=当前 tab：切换时重放 .ox-page-in 入场动效（主题 CSS 已定义） */}
            <div key={tab} className="ox-page-in min-w-0 flex-1">
              <TabsContent value="overview" className="mt-0">
                <OverviewTab />
              </TabsContent>
              <TabsContent value="feedback" className="mt-0">
                <FeedbackTab />
              </TabsContent>
              <TabsContent value="users" className="mt-0">
                <UsersTab />
              </TabsContent>
              <TabsContent value="system" className="mt-0">
                <SystemTab />
              </TabsContent>
              <TabsContent value="security" className="mt-0">
                <SecurityTab />
              </TabsContent>
              <TabsContent value="tools" className="mt-0">
                <ToolsTab />
              </TabsContent>
              <TabsContent value="alerts" className="mt-0">
                <AlertsTab />
              </TabsContent>
              <TabsContent value="settings" className="mt-0">
                <SettingsTab />
              </TabsContent>
              <TabsContent value="content" className="mt-0">
                <ContentTab />
              </TabsContent>
            </div>
          </Tabs>
        </AdminGate>
      </AdminShell>
    </>
  );
}
