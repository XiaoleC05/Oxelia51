"use client";

import { Button } from "@/src/components/ui/button";
import { OxCard } from "@/src/features/oxelia51/components/OxCard";

/** 查询失败卡片：错误信息 + 重试按钮（对齐管理台 errMsg + refetch 模式）。 */
export function QueryError({
  message,
  onRetry,
  retrying = false,
}: {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <OxCard className="flex flex-col items-start gap-2">
      <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
        {message ? `加载失败：${message}` : "加载失败，请检查网络后重试。"}
      </p>
      <Button size="sm" variant="outline" onClick={onRetry} loading={retrying}>
        重试
      </Button>
    </OxCard>
  );
}
