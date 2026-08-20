"use client";

import { Palette } from "lucide-react";
import {
  BG_PRESETS,
  TEXT_PRESETS,
  applyColorPresets,
  useOxelia51ColorPresets,
  type BgPresetName,
  type TextPresetName,
} from "@/src/features/theming/oxelia51-color-presets";
import { useOxelia51Theme } from "@/src/features/theming/oxelia51-theme";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { cn } from "@/src/utils/tailwind";

/**
 * Oxelia51 颜色设置：背景色 + 字体色预设。
 * 与主题切换器并列（侧栏底部），选择即持久化到 localStorage。
 */
export function Oxelia51ColorSettings() {
  const { bg, text } = useOxelia51ColorPresets();
  const [theme] = useOxelia51Theme();

  const bgOptions = BG_PRESETS.filter(
    (p) => p.name === "default" || p.themes.includes(theme),
  );

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="颜色设置"
              className="flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 hover:rotate-[20deg]"
              style={{
                borderColor: "var(--ox-border)",
                color: "var(--ox-text-muted)",
                background: "var(--ox-bg)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--ox-accent)";
                e.currentTarget.style.color = "var(--ox-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--ox-border)";
                e.currentTarget.style.color = "var(--ox-text-muted)";
              }}
            >
              <Palette className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">颜色设置 · 背景与字体</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel>背景颜色</DropdownMenuLabel>
        <div className="flex flex-wrap gap-2 px-2 pb-2">
          {bgOptions.map((p) => (
            <button
              key={p.name}
              type="button"
              title={p.label}
              aria-label={`背景色 ${p.label}`}
              onClick={() =>
                applyColorPresets(p.name as BgPresetName, text ?? "default")
              }
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                bg === p.name
                  ? "border-[var(--ox-accent)]"
                  : "border-[var(--ox-border)]",
              )}
              style={{ backgroundColor: p.swatch }}
            />
          ))}
        </div>
        <DropdownMenuLabel>字体颜色</DropdownMenuLabel>
        <div className="flex flex-wrap gap-2 px-2 pb-3">
          {TEXT_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              title={p.label}
              aria-label={`字体色 ${p.label}`}
              onClick={() =>
                applyColorPresets(bg ?? "default", p.name as TextPresetName)
              }
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] transition-transform hover:scale-110",
                text === p.name
                  ? "border-[var(--ox-accent)]"
                  : "border-[var(--ox-border)]",
              )}
              style={{
                backgroundColor: theme === "cozy" ? "#fdf6ee" : "#0a0e17",
                color: p.swatch,
              }}
            >
              {p.name === "default" ? "默" : "字"}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
