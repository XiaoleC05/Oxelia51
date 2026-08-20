"use client";

import { env } from "@/src/env.mjs";
import { cn } from "@/src/utils/tailwind";

/**
 * Oxelia51 站点 logo：伴星图标 + 「oxelia51」字标。
 * 字标使用大尺寸 wordart，保证「oxelia51」清晰可读。
 * 尺寸通过 Tailwind 高度类控制（响应式：移动端较小，桌面端放大）。
 * 浅色主题用黑字（wordart-black），深色主题用白字（wordart-white）。
 */
export function SiteLogo({
  wordartClassName = "h-8 sm:h-10",
  glyphClassName = "h-8 sm:h-10",
}: {
  /** 字标「oxelia51」高度类（如 "h-8 sm:h-10"） */
  wordartClassName?: string;
  /** 伴星图标尺寸类 */
  glyphClassName?: string;
}) {
  const basePath = env.NEXT_PUBLIC_BASE_PATH ?? "";
  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${basePath}/icon-glyph-64.png`}
        alt=""
        className={cn("shrink-0 dark:hidden", glyphClassName)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${basePath}/icon-glyph-64-dark.png`}
        alt=""
        className={cn("hidden shrink-0 dark:block", glyphClassName)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${basePath}/wordart-black.svg`}
        alt="oxelia51"
        className={cn("dark:hidden", wordartClassName)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${basePath}/wordart-white.svg`}
        alt="oxelia51"
        className={cn("hidden dark:block", wordartClassName)}
      />
    </span>
  );
}
