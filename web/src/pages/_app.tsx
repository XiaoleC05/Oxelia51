// Must stay the first import: installs a `crypto.randomUUID` fallback for
// non-secure (plain-HTTP) origins before any other module can call it
// (LFE-10858).
import "@/src/polyfills/crypto-random-uuid";

import { type AppType } from "next/app";
import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { setUser } from "@sentry/nextjs";
import { useSession } from "next-auth/react";
import { TooltipProvider } from "@/src/components/ui/tooltip";
import { CommandMenuProvider } from "@/src/features/command-k-menu/CommandMenuProvider";

import { api } from "@/src/utils/api";

import NextAdapterPages from "next-query-params/pages";
import { QueryParamProvider } from "use-query-params";

import "@/src/styles/globals.css";
import "@/src/features/theming/oxelia51-theme.css";
import "@/src/styles/oxelia51-vars.css";
import { AppLayout } from "@/src/components/layouts/app-layout";
import { Toaster } from "@/src/components/ui/sonner";
import { useEffect, useRef } from "react";
import { useRouter } from "next/router";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import prexit from "prexit";

// Custom polyfills not yet available in `next-core`:
// https://github.com/vercel/next.js/issues/58242
// https://nextjs.org/docs/architecture/supported-browsers#custom-polyfills
import "core-js/features/array/to-reversed";
import "core-js/features/array/to-spliced";
import "core-js/features/array/to-sorted";

import "react18-json-view/src/style.css";
import "streamdown/styles.css";

// Oxelia51 品牌字体（自托管 @fontsource，无外部 CDN 依赖）
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/noto-serif-sc/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";

// Oxelia51：移除原 Langfuse 的 Google Translate DOM monkey-patch。
// 该补丁无条件改写 Element.prototype.removeChild/insertBefore，React 19
// 每次渲染都经过它，可能中断 hydration（页面显示但点击/交互无效，需刷新恢复）。
// 站点已全面中文化，无需浏览器翻译，直接移除。

import { ThemeProvider } from "@/src/features/theming/ThemeProvider";
import { MarkdownContextProvider } from "@/src/features/theming/useMarkdownContext";
import { useLangfuseCloudRegion } from "@/src/features/organizations/hooks";
import { env } from "@/src/env.mjs";

// Check that PostHog is client-side (used to handle Next.js SSR) and that env vars are set
if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_POSTHOG_KEY &&
  process.env.NEXT_PUBLIC_POSTHOG_HOST
) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    // oxelia51 fork: follow the operator-configured host instead of
    // defaulting to PostHog's EU cloud.
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    // Enable debug mode in development
    loaded: (posthog) => {
      if (process.env.NODE_ENV === "development") posthog.debug();
    },
    session_recording: {
      maskCapturedNetworkRequestFn(request) {
        request.requestBody = request.requestBody ? "REDACTED" : undefined;
        request.responseBody = request.responseBody ? "REDACTED" : undefined;
        return request;
      },
    },
    autocapture: false,
    enable_heatmaps: false,
    persistence: "cookie",
  });
}

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  const router = useRouter();
  const skipAppLayout =
    "skipAppLayout" in Component && Component.skipAppLayout === true;

  useEffect(() => {
    // PostHog pageview tracking (only when operator configured own PostHog)
    if (env.NEXT_PUBLIC_POSTHOG_KEY && env.NEXT_PUBLIC_POSTHOG_HOST) {
      const handleRouteChange = () => {
        posthog.capture("$pageview");
      };
      router.events.on("routeChangeComplete", handleRouteChange);

      return () => {
        router.events.off("routeChangeComplete", handleRouteChange);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Oxelia51：浏览器从往返缓存（BFCache）恢复时，React 事件绑定可能失效，
    // 表现为「页面能看但点击无反应，刷新一次才正常」。检测 pageshow.persisted
    // 强制整页刷新恢复交互。
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const page = (
    <>
      <Component {...pageProps} />
      <UserTracking />
    </>
  );

  return (
    <QueryParamProvider
      adapter={NextAdapterPages}
      options={{ enableBatching: true }}
    >
      <TooltipProvider>
        <CommandMenuProvider>
          <PostHogProvider client={posthog}>
            <SessionProvider
              session={session}
              refetchOnWindowFocus={true}
              refetchInterval={5 * 60} // 5 minutes
              basePath={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/auth`}
            >
              <MarkdownContextProvider>
                <ThemeProvider
                  attribute="class"
                  enableSystem
                  disableTransitionOnChange
                >
                  {skipAppLayout ? (
                    <>
                      {page}
                      {/* 公开页没有 AppLayout，单独挂 Toaster 让反馈成功提示可用 */}
                      <Toaster />
                    </>
                  ) : (
                    <AppLayout>{page}</AppLayout>
                  )}
                </ThemeProvider>
              </MarkdownContextProvider>
            </SessionProvider>
          </PostHogProvider>
        </CommandMenuProvider>
      </TooltipProvider>
    </QueryParamProvider>
  );
};

export default api.withTRPC(MyApp);

function UserTracking() {
  const session = useSession();
  const { region } = useLangfuseCloudRegion();
  const sessionUser = session.data?.user;

  // Track user identity and properties
  const lastIdentifiedUser = useRef<string | null>(null);
  useEffect(() => {
    if (
      session.status === "authenticated" &&
      sessionUser &&
      lastIdentifiedUser.current !== JSON.stringify(sessionUser)
    ) {
      lastIdentifiedUser.current = JSON.stringify(sessionUser);
      // PostHog
      if (env.NEXT_PUBLIC_POSTHOG_KEY && env.NEXT_PUBLIC_POSTHOG_HOST) {
        posthog.identify(sessionUser.id ?? undefined, {
          environment: process.env.NODE_ENV,
          email: sessionUser.email ?? undefined,
          name: sessionUser.name ?? undefined,
          featureFlags: sessionUser.featureFlags ?? undefined,
          projects:
            sessionUser.organizations.flatMap((org) =>
              org.projects.map((project) => ({
                ...project,
                organization: org,
              })),
            ) ?? undefined,
          LANGFUSE_CLOUD_REGION: region,
        });
      }

      // Sentry
      setUser({
        email: sessionUser.email ?? undefined,
        id: sessionUser.id ?? undefined,
      });
    } else if (session.status === "unauthenticated") {
      lastIdentifiedUser.current = null;
      // Sentry
      setUser(null);
    }
  }, [sessionUser, session.status, region]);

  // add stripe link to chat
  // const orgStripeLink = organization?.cloudConfig?.stripe?.customerId
  //   ? `https://dashboard.stripe.com/customers/${organization.cloudConfig.stripe.customerId}`
  //   : undefined;
  // useEffect(() => {
  //   if (orgStripeLink) {
  //     chatSetUser({
  //       data: {
  //         stripe: orgStripeLink,
  //       },
  //     });
  //   }
  // }, [orgStripeLink]);

  return null;
}

if (
  process.env.NEXT_RUNTIME === "nodejs" &&
  process.env.NEXT_MANUAL_SIG_HANDLE
) {
  const { shutdown } = await import("@/src/utils/shutdown");
  prexit(async (signal) => {
    console.log("Signal: ", signal);
    return await shutdown(signal);
  });
}
