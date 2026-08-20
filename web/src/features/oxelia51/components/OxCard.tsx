import type { HTMLAttributes } from "react";
import { cn } from "@/src/utils/tailwind";

/** 工作台卡片：圆角 + 品牌描边。默认带 p-4，可传 className 覆盖（如 p-0）。 */
export function OxCard({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border p-4", className)}
      style={{ borderColor: "var(--ox-border)" }}
      {...props}
    >
      {children}
    </div>
  );
}
