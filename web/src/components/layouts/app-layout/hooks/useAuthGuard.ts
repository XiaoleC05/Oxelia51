/**
 * Authentication guard hook
 * Determines if user should be redirected, signed out, or allowed to proceed
 */

import { useRouter } from "next/router";
import { useMemo } from "react";
import { PATH_CONSTANTS } from "../utils/pathClassification";
import { getSafeRedirectPath, stripBasePath } from "@/src/utils/redirect";
import type { SessionContextValue } from "next-auth/react";

/** Actions the auth guard can request */
export type AuthGuardAction = "allow" | "loading" | "redirect" | "sign-out";

/** Result of auth guard evaluation */
export type AuthGuardResult =
  | { action: "allow" }
  | { action: "loading"; message: string }
  | { action: "redirect"; url: string; message: string }
  | { action: "sign-out"; message: string };

/**
 * Evaluates authentication state and determines appropriate action
 * Handles:
 * - Loading states
 * - Invalid users (session exists but user is null)
 * - Unauthenticated users on protected routes
 * - Authenticated users on auth pages (with redirect)
 *
 * @param session - Session object from useSession hook
 * @returns Guard state indicating what action to take
 */
export function useAuthGuard(
  session: SessionContextValue,
  _hideNavigation: boolean,
): AuthGuardResult {
  const router = useRouter();

  return useMemo(() => {
    const { pathname, query, asPath } = router;

    // Loading state
    if (session.status === "loading") {
      return { action: "loading", message: "正在加载账户" };
    }

    const isUnauthPath = PATH_CONSTANTS.unauthenticated.some((p) =>
      pathname.startsWith(p),
    );
    const isPublicPath = pathname.startsWith("/public/");
    // Oxelia51：`/` 对未登录用户展示品牌落地页，不强制跳转登录。
    // 仅精确匹配根路径，不影响其他受保护页面的重定向。
    const isLandingPath = pathname === "/";

    // Check if path is publishable (can be accessed without authentication)
    const isPublishable = PATH_CONSTANTS.publishable.some((path) => {
      // Case 1: Exact match (e.g., pathname === "/auth/reset-password")
      if (pathname === path) return true;

      // Case 2: Prefix match for dynamic routes
      // Example: path = "/project/[projectId]/traces/[traceId]"
      //   -> pathPrefix = "/project/[^/]+/traces" (last segment removed, params converted to regex)
      //   -> matches pathname like "/project/abc123/traces/xyz789"
      // This allows shared trace/session links to be accessed without authentication
      const pathPrefix = path
        .split("/")
        .slice(0, -1)
        .join("/")
        .replace(/\[([^\]]+)\]/g, "[^/]+");
      const prefixRegex = new RegExp(`^${pathPrefix}/`);
      return prefixRegex.test(pathname);
    });

    // Invalid user - has session but no DB user
    // This can happen if user was deleted from DB but still has valid JWT
    if (
      session.data &&
      session.data.user === null &&
      !isUnauthPath &&
      !isPublishable &&
      !isPublicPath
    ) {
      return { action: "sign-out", message: "正在退出登录" };
    }

    // Unauthenticated user trying to access protected route
    if (
      session.status === "unauthenticated" &&
      !isUnauthPath &&
      !isPublishable &&
      !isPublicPath &&
      !isLandingPath
    ) {
      // asPath already includes the base path when accessed via browser
      // Strip the base path if present to avoid double-prepending
      const rawPath = asPath || pathname || "/";
      const pathToStore = stripBasePath(rawPath);

      // Only include targetPath if it's not the root
      const targetPathQuery =
        pathToStore !== "/"
          ? `?targetPath=${encodeURIComponent(pathToStore)}`
          : "";

      return {
        action: "redirect",
        url: `/auth/sign-in${targetPathQuery}`,
        message: "正在跳转到登录页",
      };
    }

    // Authenticated user on authentication page - redirect to target or home
    // Oxelia51：/auth/admin 例外——已登录非管理员需停留在管理员登录页切换账户，
    // 是否已是管理员、是否跳转 /admin 由页面自身判定。
    if (
      session.status === "authenticated" &&
      isUnauthPath &&
      !pathname.startsWith("/auth/admin")
    ) {
      const queryTargetPath = query.targetPath as string | undefined;
      const redirectUrl = getSafeRedirectPath(queryTargetPath);
      const routerRedirectUrl = stripBasePath(redirectUrl);
      return {
        action: "redirect",
        url: routerRedirectUrl,
        message: "正在进入",
      };
    }

    // All checks passed - allow access
    return { action: "allow" };
  }, [session.status, session.data, router]);
}
