"use client";

import { useSyncExternalStore } from "react";

/**
 * Oxelia51 颜色自定义：背景色预设 + 字体色预设。
 * 通过 document.documentElement 的 data-bg-preset / data-text-preset 属性
 * 驱动 CSS 变量覆盖（见 oxelia51-theme.css），与双主题（cozy/cosmos）正交。
 *
 * 背景预设按主题分组（浅色主题 = 浅背景，深色主题 = 深背景），
 * 字体色预设仅对浅色背景有意义，深色背景自动用浅色文字保证对比度。
 */

export type BgPresetName =
  | "default"
  | "white"
  | "mist"
  | "cream"
  | "black"
  | "navy";
export type TextPresetName = "default" | "brown" | "ink" | "forest" | "navy";

export const BG_PRESETS: Array<{
  name: BgPresetName;
  label: string;
  swatch: string;
  themes: Array<"cozy" | "cosmos">;
}> = [
  {
    name: "default",
    label: "默认",
    swatch: "var(--ox-bg)",
    themes: ["cozy", "cosmos"],
  },
  { name: "white", label: "纯白", swatch: "#ffffff", themes: ["cozy"] },
  { name: "mist", label: "雾蓝", swatch: "#eef2f7", themes: ["cozy"] },
  { name: "cream", label: "米黄", swatch: "#f6f0e3", themes: ["cozy"] },
  { name: "black", label: "墨黑", swatch: "#050505", themes: ["cosmos"] },
  { name: "navy", label: "深蓝", swatch: "#10151f", themes: ["cosmos"] },
];

export const TEXT_PRESETS: Array<{
  name: TextPresetName;
  label: string;
  swatch: string;
}> = [
  { name: "default", label: "默认", swatch: "var(--ox-text)" },
  { name: "brown", label: "暖棕", swatch: "#3a332d" },
  { name: "ink", label: "墨灰", swatch: "#1f2937" },
  { name: "forest", label: "墨绿", swatch: "#243b2a" },
  { name: "navy", label: "深蓝", swatch: "#1e3a5f" },
];

const BG_KEY = "oxelia51-bg-preset";
const TEXT_KEY = "oxelia51-text-preset";
const COLOR_EVENT = "oxelia51-color-change";

function read<T extends string>(key: string, valid: T[]): T | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(key) as T | null;
  return v && valid.includes(v) ? v : null;
}

/** 应用配色：设置 data 属性驱动 CSS 变量覆盖。 */
export function applyColorPresets(bg: BgPresetName, text: TextPresetName) {
  const root = document.documentElement;
  root.dataset.bgPreset = bg;
  root.dataset.textPreset = text;
  window.localStorage.setItem(BG_KEY, bg);
  window.localStorage.setItem(TEXT_KEY, text);
  window.dispatchEvent(new Event(COLOR_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(COLOR_EVENT, callback);
  return () => window.removeEventListener(COLOR_EVENT, callback);
}

const bgNames = BG_PRESETS.map((p) => p.name);
const textNames = TEXT_PRESETS.map((p) => p.name);

/** 当前背景/字体预设；null = 未自定义（用主题默认）。 */
export function useOxelia51ColorPresets(): {
  bg: BgPresetName | null;
  text: TextPresetName | null;
} {
  const bg = useSyncExternalStore(
    subscribe,
    () => read(BG_KEY, bgNames),
    () => null,
  );
  const text = useSyncExternalStore(
    subscribe,
    () => read(TEXT_KEY, textNames),
    () => null,
  );
  return { bg, text };
}
