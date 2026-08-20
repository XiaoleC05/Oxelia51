"use client";

import { api } from "@/src/utils/api";
import { Card } from "@/src/components/ui/card";
import {
  altCost,
  formatCost,
  formatTokens,
  useCurrency,
} from "@/src/features/oxelia51/components/currency";

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0) {
    return <span className="text-muted-foreground text-xs">— 暂无对比</span>;
  }
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return (
    <span
      className="text-xs"
      style={{ color: up ? "var(--ox-ok)" : "var(--ox-danger)" }}
    >
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function StatCard(props: {
  title: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-muted-foreground text-xs">{props.title}</span>
      <span
        className="text-2xl font-bold tabular-nums"
        style={{ color: "var(--ox-text-h)" }}
      >
        {props.value}
      </span>
      {props.sub}
    </Card>
  );
}

/** Token 统计概览卡片：今日 / 本周 / 本月 Token 用量 + 本月花费。 */
export function TokenWidget({ projectId }: { projectId: string }) {
  const overview = api.oxelia51.overview.useQuery({ projectId });
  const { currency, rate } = useCurrency();

  if (overview.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-24 animate-pulse p-4" />
        ))}
      </div>
    );
  }

  const data = overview.data ?? {
    todayTokens: 0,
    yesterdayTokens: 0,
    weekTokens: 0,
    prevWeekTokens: 0,
    monthTokens: 0,
    prevMonthTokens: 0,
    monthCostUsd: 0,
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="今日 Token"
        value={formatTokens(data.todayTokens)}
        sub={
          <span className="flex items-center gap-1 text-xs">
            <Delta current={data.todayTokens} previous={data.yesterdayTokens} />
            <span className="text-muted-foreground">vs 昨日</span>
          </span>
        }
      />
      <StatCard
        title="本周 Token"
        value={formatTokens(data.weekTokens)}
        sub={
          <span className="flex items-center gap-1 text-xs">
            <Delta current={data.weekTokens} previous={data.prevWeekTokens} />
            <span className="text-muted-foreground">vs 上周</span>
          </span>
        }
      />
      <StatCard
        title="本月 Token"
        value={formatTokens(data.monthTokens)}
        sub={
          <span className="flex items-center gap-1 text-xs">
            <Delta current={data.monthTokens} previous={data.prevMonthTokens} />
            <span className="text-muted-foreground">vs 上月</span>
          </span>
        }
      />
      <StatCard
        title="本月花费"
        value={formatCost(data.monthCostUsd, currency, rate)}
        sub={
          <span className="text-muted-foreground text-xs">
            {altCost(data.monthCostUsd, currency, rate)}
          </span>
        }
      />
    </div>
  );
}
