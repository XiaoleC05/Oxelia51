"use client";

import { formatTokens } from "@/src/features/oxelia51/components/currency";
import { EmptyState } from "@/src/features/oxelia51/components/EmptyState";

/**
 * 时间趋势柱状图（总览 / 分析共用）。
 * 按 bucket 渲染每日/周/月 Token 柱，最后一根为品牌红强调；
 * 图下标注首/末日期与峰值。
 */
export function TokenTrendChart({
  data,
}: {
  data: { bucket: string; tokens: number }[];
}) {
  if (data.length === 0) {
    return (
      <EmptyState
        description="暂无消耗数据。接入代理产生请求后，这里会展示 Token 趋势。"
        action={{ href: "/docs", label: "查看接入文档" }}
      />
    );
  }
  const max = Math.max(...data.map((d) => d.tokens), 1);
  const peak = data.reduce((a, b) => (b.tokens > a.tokens ? b : a), data[0]!);
  const W = 720;
  const H = 140;
  const pad = 4;
  const step = W / data.length;
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ height: 160 }}
      >
        {data.map((d, i) => {
          const h = (d.tokens / max) * (H - 12);
          const x = i * step + pad;
          const w = Math.max(step - pad * 2, 1);
          return (
            <rect
              key={d.bucket}
              x={x}
              y={H - h}
              width={w}
              height={h}
              rx={2}
              fill={
                i === data.length - 1
                  ? "var(--ox-accent)"
                  : "var(--ox-border-light)"
              }
            >
              <title>{`${d.bucket}: ${formatTokens(d.tokens)}`}</title>
            </rect>
          );
        })}
      </svg>
      {/* 坐标标注：首/末日期 + 峰值 */}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-(--ox-text-muted) tabular-nums">
        <span>{data[0]!.bucket}</span>
        <span
          className="truncate"
          title={`峰值 ${peak.bucket} · ${formatTokens(peak.tokens)}`}
        >
          峰值 {peak.bucket} · {formatTokens(peak.tokens)}
        </span>
        <span>{data[data.length - 1]!.bucket}</span>
      </div>
    </div>
  );
}
