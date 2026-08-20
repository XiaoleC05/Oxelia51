"use client";

import Link from "next/link";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PlugZap } from "lucide-react";

/** 空态引导：项目暂无 Token 数据时提示如何接入代理网关。 */
export function ProxyAccessEmptyState({ projectId }: { projectId: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 p-6 text-center">
      <span className="text-(--ox-accent)">
        <PlugZap className="h-6 w-6" />
      </span>
      <span className="font-heading text-sm font-bold">还没有 Token 数据</span>
      <p className="text-muted-foreground max-w-md text-xs leading-5">
        把你的模型工具（Claude Code、Cursor 等）指向 Oxelia51 代理地址， Token
        消耗与成本就会自动统计到这里。配置只需一行环境变量。
      </p>
      <Button asChild>
        <Link href={`/project/${projectId}/settings/proxy`}>查看接入配置</Link>
      </Button>
    </Card>
  );
}
