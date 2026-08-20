"use client";

import type { ReactNode } from "react";
import { cn } from "@/src/utils/tailwind";

/** 空态提示：居中 muted 小字。默认 flex 居中，可传 className 覆盖布局。 */
export function EmptyText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center py-6 text-sm text-(--ox-text-muted)",
        className,
      )}
    >
      {children}
    </div>
  );
}
