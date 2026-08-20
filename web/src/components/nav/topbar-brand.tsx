import { cn } from "@/src/utils/tailwind";
import Link from "next/link";
import { env } from "@/src/env.mjs";
import { Oxelia51Icon } from "@/src/components/design-system/Oxelia51Icon/Oxelia51Icon";
import { useHasAppSidebar } from "@/src/components/nav/sidebar-presence";

/**
 * Compact brand mark for the top bar.
 *
 * The primary brand lives in the sidebar header. Once the sidebar goes
 * off-canvas (below `md`, where it collapses into a Sheet) nothing brands the
 * app, so the page header renders this compact mark instead — mirroring the
 * icon the sidebar itself shows when collapsed.
 *
 * `variant="icon"` (default) renders just the mark; `variant="wordmark"`
 * renders the full logotype, for the centered brand in the mobile top bar.
 */
export const TopbarBrand = ({
  className,
  variant = "icon",
}: {
  className?: string;
  variant?: "icon" | "wordmark";
}) => {
  const hasAppSidebar = useHasAppSidebar();

  // Only brand where a real sidebar exists to mirror. On the sidebar-less
  // MinimalLayout (public/shared trace & session views) the page supplies its
  // own "Sign in / Back to Langfuse" leadingControl, so an extra brand mark
  // here would be redundant.
  if (!hasAppSidebar) return null;

  return (
    <Link
      href="/"
      aria-label="Oxelia51 首页"
      className={cn("flex shrink-0 items-center gap-1", className)}
    >
      {variant === "wordmark" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="max-h-5 max-w-24 dark:hidden"
            src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/wordart-black.svg`}
            alt="Oxelia51 标志"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="hidden max-h-5 max-w-24 dark:block"
            src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/wordart-white.svg`}
            alt="Oxelia51 标志"
          />
        </>
      ) : (
        <Oxelia51Icon size={28} />
      )}
    </Link>
  );
};
