"use client";

import Link from "next/link";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/utils/tailwind";

/**
 * 空态（§4.10）：虚线描边 + --ox-bg-alt 底，说明文字 + 一个行动按钮。
 * 禁止裸「暂无数据」——必须说明原因并给出行动路径。
 */
export function EmptyState({
  description,
  action,
  className,
}: {
  description: string;
  /** 行动按钮（跳工作台内页或文档站 /docs） */
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center",
        className,
      )}
      style={{
        borderColor: "var(--ox-border)",
        backgroundColor: "var(--ox-bg-alt)",
      }}
    >
      <p className="text-sm leading-6 text-(--ox-text-muted)">{description}</p>
      {action && (
        // 默认尺寸 h-8（32px）：空态行动按钮作为页面主按钮，需满足移动端触控目标
        <Button asChild variant="outline">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
