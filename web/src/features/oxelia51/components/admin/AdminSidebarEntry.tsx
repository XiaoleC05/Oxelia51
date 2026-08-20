"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { api } from "@/src/utils/api";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";

/**
 * 侧栏 footer「管理台」入口：仅管理员（whoami.isAdmin）可见，
 * 点击跳转独立管理台 /admin。样式与主题切换/反馈按钮一致。
 */
export function AdminSidebarEntry() {
  const whoami = api.oxelia51Admin.whoami.useQuery(undefined, {
    staleTime: Infinity,
  });
  if (!whoami.data?.isAdmin) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/admin"
          aria-label="管理台"
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
          <ShieldCheck className="h-4 w-4" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">管理台</TooltipContent>
    </Tooltip>
  );
}
