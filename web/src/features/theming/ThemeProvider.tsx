"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import {
  getOxelia51Theme,
  OXELIA51_THEME_EVENT,
} from "@/src/features/theming/oxelia51-theme";

/**
 * 将 Oxelia51 双主题（data-theme="cozy|cosmos"）注入 :root，
 * 并与 Langfuse 的 light/dark 模式保持同步：
 * cozy → light，cosmos → dark。
 */
function Oxelia51ThemeSync() {
  const { setTheme } = useTheme();

  React.useEffect(() => {
    const apply = () => {
      const oxeliaTheme = getOxelia51Theme();
      document.documentElement.dataset.theme = oxeliaTheme;
      setTheme(oxeliaTheme === "cosmos" ? "dark" : "light");
    };
    apply();
    window.addEventListener(OXELIA51_THEME_EVENT, apply);
    return () => window.removeEventListener(OXELIA51_THEME_EVENT, apply);
  }, [setTheme]);

  return null;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <Oxelia51ThemeSync />
      {children}
    </NextThemesProvider>
  );
}
