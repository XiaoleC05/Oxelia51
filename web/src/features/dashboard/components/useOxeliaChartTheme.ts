"use client";

import { useMemo } from "react";
import { useOxelia51Theme } from "@/src/features/theming/oxelia51-theme";

const FALLBACK_COLORS = ["#c8553d", "#e8956c", "#6b8e5a", "#c4943d", "#8b7355"];

function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/** ECharts 图表主题色：从 Cozy/Cosmos CSS 变量读取，主题切换时自动更新。 */
export function useOxeliaChartTheme() {
  const [theme] = useOxelia51Theme();

  return useMemo(
    () => ({
      palette: FALLBACK_COLORS.map((fallback, i) =>
        readCssVar(`--ox-chart-${i + 1}`, fallback),
      ),
      textColor: readCssVar("--ox-text", "#3d2e25"),
      mutedColor: readCssVar("--ox-text-muted", "#8b7355"),
      borderColor: readCssVar("--ox-border", "#e0d3c0"),
      accentColor: readCssVar("--ox-accent", FALLBACK_COLORS[0]!),
    }),
    // theme 变化时重新读取 CSS 变量（useMemo 体内不直接引用 theme，仅作重算触发器）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme],
  );
}
