"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Card } from "@/src/components/ui/card";

const DISMISS_KEY = "oxelia51-welcome-dismissed";

const FEATURES = (projectId: string) => [
  {
    title: "Token 统计",
    desc: "查看今日/本周/本月的 Token 用量与趋势",
    href: `/project/${projectId}/dashboard/tokens`,
  },
  {
    title: "成本分析",
    desc: "按模型拆解花费，支持 CNY/USD 切换",
    href: `/project/${projectId}/dashboard/cost`,
  },
  {
    title: "告警设置",
    desc: "配置预算告警与异常检测通知",
    href: `/project/${projectId}/settings/alerts`,
  },
  {
    title: "追踪",
    desc: "查看每次模型调用的完整链路",
    href: `/project/${projectId}/traces`,
  },
];

/** 首页引导卡片：向新用户说明平台用途与核心功能，可关闭（localStorage 记忆）。 */
export function Oxelia51WelcomeCard({ projectId }: { projectId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem(DISMISS_KEY) !== "1");
  }, []);

  if (!visible) return null;

  return (
    <Card className="relative mb-4 flex flex-col gap-3 border-[var(--ox-accent-border)] p-5">
      <button
        type="button"
        aria-label="关闭引导"
        className="text-muted-foreground hover:text-foreground absolute top-3 right-3"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setVisible(false);
        }}
      >
        <X className="h-4 w-4" />
      </button>
      <h2 className="font-heading text-lg font-bold">
        欢迎使用 Oxelia51 Token 监控平台
      </h2>
      <p className="text-muted-foreground text-sm">
        这里集中监控你的模型 API 调用：统计 Token
        用量、分析模型成本、配置预算告警，并保留每一次调用的完整追踪链路。
      </p>
      <p className="text-muted-foreground text-xs">
        提示：「组织」是 Langfuse
        的团队空间概念，本平台只有一个默认组织，日常使用无需理会；下方即为本项目的
        Token 实时监控。
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES(projectId).map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="rounded-md border p-3 transition-colors hover:border-[var(--ox-accent)]"
          >
            <div
              className="text-sm font-bold"
              style={{ color: "var(--ox-accent)" }}
            >
              {f.title}
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">{f.desc}</div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
