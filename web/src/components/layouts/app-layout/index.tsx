/**
 * App Layout
 *
 * Improved maintainability through:
 * - Separation of concerns via custom hooks
 * - Composable navigation filters
 * - Layout variant components
 * - Memoization for performance
 *
 */

import { type PropsWithChildren, useEffect } from "react";
import { useRouter } from "next/router";
import { signOut } from "next-auth/react";
import { signOutCleanly } from "@/src/features/auth/lib/signOut";

// Layout variants
import { LoadingLayout } from "./variants/LoadingLayout";
import { UnauthenticatedLayout } from "./variants/UnauthenticatedLayout";
import { MinimalLayout } from "./variants/MinimalLayout";
import { AuthenticatedLayout } from "./variants/AuthenticatedLayout";

// Custom hooks
import { useAuthSession } from "./hooks/useAuthSession";
import { useLayoutConfiguration } from "./hooks/useLayoutConfiguration";
import { useAuthGuard } from "./hooks/useAuthGuard";
import { useFilteredNavigation } from "./hooks/useFilteredNavigation";
import { useLayoutMetadata } from "./hooks/useLayoutMetadata";

/**
 * Main layout component
 * Determines which layout variant to render based on:
 * - Authentication state
 * - Current route
 * - User permissions
 */
export function AppLayout(props: PropsWithChildren) {
  const router = useRouter();
  const session = useAuthSession();

  // Determine layout configuration
  const { variant, hideNavigation, isPublishable } = useLayoutConfiguration(
    session.data ?? null,
  );

  // Check authentication and redirects
  const authGuard = useAuthGuard(session, hideNavigation);

  // IMPORTANT: Call all hooks before any conditional returns
  // Load navigation and metadata (even if not used in all render paths)
  const navigation = useFilteredNavigation(session.data ?? null);
  const activePathName = navigation.navigation.find(
    (item) => item.isActive,
  )?.title;
  const metadata = useLayoutMetadata(activePathName, navigation.navigation);

  // Handle auth guard actions (redirect or sign-out)
  useEffect(() => {
    if (authGuard.action === "redirect") {
      router.replace(authGuard.url);
    } else if (authGuard.action === "sign-out") {
      signOut({ redirect: false });
    }
  }, [authGuard, router]);

  // Loading or redirecting state
  if (
    authGuard.action === "loading" ||
    authGuard.action === "redirect" ||
    authGuard.action === "sign-out"
  ) {
    return <LoadingLayout message={authGuard.message} />;
  }

  // Unauthenticated layout (sign-in, sign-up)
  // Must check variant BEFORE hideNavigation since auth pages set hideNavigation=true
  if (variant === "unauthenticated") {
    return <UnauthenticatedLayout>{props.children}</UnauthenticatedLayout>;
  }

  // Publishable paths (traces, sessions) when unauthenticated
  // Render minimal layout without navigation/sidebar
  if (isPublishable && session.status === "unauthenticated") {
    return <MinimalLayout>{props.children}</MinimalLayout>;
  }

  // Render minimal layout (onboarding, public routes)
  if (hideNavigation) {
    return <MinimalLayout>{props.children}</MinimalLayout>;
  }

  // Authenticated layout
  // At this point, all auth guards have passed and session.data is guaranteed to exist
  // The authGuard hook ensures we don't reach here without a valid session
  if (!session.data) {
    // This should never happen due to guards above, but TypeScript needs this
    return <LoadingLayout message="加载中" />;
  }

  return (
    <AuthenticatedLayout
      session={session.data}
      navigation={navigation}
      metadata={metadata}
      onSignOut={signOutCleanly}
    >
      {props.children}
    </AuthenticatedLayout>
  );
}
