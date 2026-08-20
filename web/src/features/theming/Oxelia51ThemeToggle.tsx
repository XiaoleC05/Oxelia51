"use client";

import { Moon, Sun } from "lucide-react";
import { useOxelia51Theme } from "@/src/features/theming/oxelia51-theme";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";

/**
 * Oxelia51 主题切换（Cozy 暖色 / Cosmos 深色）。
 * 单圆形图标按钮：当前主题的"目标"图标——Cozy 显示 Moon（切深色），
 * Cosmos 显示 Sun（切浅色）。
 */
export function Oxelia51ThemeToggle() {
  const [theme, setTheme] = useOxelia51Theme();
  const isCozy = theme === "cozy";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={isCozy ? "切换到 Cosmos 深色" : "切换到 Cozy 暖色"}
          onClick={() => setTheme(isCozy ? "cosmos" : "cozy")}
          className="flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 hover:rotate-[20deg]"
          style={{
            borderColor: "var(--ox-border)",
            color: "var(--ox-text-muted)",
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
          {isCozy ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {isCozy ? "Cozy 暖色 · 点击切换深色" : "Cosmos 深色 · 点击切换暖色"}
      </TooltipContent>
    </Tooltip>
  );
}
