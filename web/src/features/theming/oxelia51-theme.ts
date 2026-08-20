"use client";

import { useSyncExternalStore } from "react";

/**
 * Oxelia51 双主题（Cozy 暖色 / Cosmos 深色）状态管理。
 * 通过 document.documentElement 的 data-theme 属性驱动 CSS 变量，
 * 并与 next-themes 同步（cozy → light，cosmos → dark，见 ThemeProvider）。
 */

export type Oxelia51Theme = "cozy" | "cosmos";

export const OXELIA51_THEME_STORAGE_KEY = "oxelia51-theme";
export const OXELIA51_THEME_EVENT = "oxelia51-theme-change";

const DEFAULT_THEME: Oxelia51Theme = "cozy";

export function getOxelia51Theme(): Oxelia51Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  return window.localStorage.getItem(OXELIA51_THEME_STORAGE_KEY) === "cosmos"
    ? "cosmos"
    : "cozy";
}

export function setOxelia51Theme(theme: Oxelia51Theme) {
  window.localStorage.setItem(OXELIA51_THEME_STORAGE_KEY, theme);
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(OXELIA51_THEME_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(OXELIA51_THEME_EVENT, callback);
  return () => window.removeEventListener(OXELIA51_THEME_EVENT, callback);
}

/** 当前 Oxelia51 主题；切换时持久化到 localStorage 并广播事件。 */
export function useOxelia51Theme(): [
  Oxelia51Theme,
  (t: Oxelia51Theme) => void,
] {
  const theme = useSyncExternalStore(
    subscribe,
    getOxelia51Theme,
    () => DEFAULT_THEME,
  );
  return [theme, setOxelia51Theme];
}
