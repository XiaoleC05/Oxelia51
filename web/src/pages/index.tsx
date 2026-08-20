import { LandingPage } from "@/src/features/oxelia51/components/landing/LandingPage";

/**
 * Oxelia51：`/` 恒为品牌落地页（无论登录状态）。
 *
 * v4 起取消「已登录自动跳转项目页」：落地页对所有人一致展示，
 * 已登录用户通过顶栏「进入工作台」显式进入自己的项目，不再被动跳转。
 */
export default function Home() {
  return <LandingPage />;
}

// Oxelia51 v4：落地页为全宽品牌页，绕开 AppLayout 的应用外壳（主题/Session 仍由 _app 提供）。
Home.skipAppLayout = true;
