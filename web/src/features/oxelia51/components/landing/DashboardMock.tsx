"use client";

import { env } from "@/src/env.mjs";

/**
 * Hero 产品展示：真实桌面应用截图（干净安装空态，含首次接入引导）。
 * 非手绘 mock —— 正式版不使用假数据/假数字，直接展示产品真实界面。
 * 截图来源：Oxelia51 桌面端 v0.1.x 总览空态（web/public/ox-desktop-empty.png）。
 */
export function DashboardMock() {
  const basePath = env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <div
      className="overflow-hidden rounded-xl border text-left shadow-2xl shadow-black/10 dark:shadow-black/40"
      style={{
        borderColor: "var(--ox-border)",
        backgroundColor: "var(--ox-bg)",
      }}
    >
      {/* 浏览器窗框 */}
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{
          borderColor: "var(--ox-border)",
          backgroundColor: "var(--ox-bg-alt)",
        }}
      >
        {/* eslint-disable @repo/no-arbitrary-colors -- macOS 窗口红绿灯为 OS 固有品牌色，刻意不随主题变化 */}
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        {/* eslint-enable @repo/no-arbitrary-colors */}
        <span
          className="ml-3 flex-1 truncate rounded-md px-3 py-1 text-xs text-(--ox-text-muted)"
          style={{ backgroundColor: "var(--ox-bg)" }}
          title="Oxelia51 桌面应用 · 总览"
        >
          Oxelia51 桌面应用 · 总览
        </span>
      </div>

      {/* 真实桌面截图 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${basePath}/ox-desktop-empty.png`}
        alt="Oxelia51 桌面应用总览——真实产品界面，首次接入引导"
        className="block w-full"
        style={{ backgroundColor: "var(--ox-bg)" }}
      />
    </div>
  );
}
