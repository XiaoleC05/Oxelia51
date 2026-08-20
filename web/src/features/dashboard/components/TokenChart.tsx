"use client";

import { useMemo, useState } from "react";
import { api } from "@/src/utils/api";
import { Card } from "@/src/components/ui/card";
import { EChart } from "@/src/features/dashboard/components/EChart";
import { useOxeliaChartTheme } from "@/src/features/dashboard/components/useOxeliaChartTheme";
import { SegmentedControl } from "@/src/features/oxelia51/components/SegmentedControl";
import type { EChartsOption } from "echarts";

type Granularity = "day" | "week" | "month";

/** Token 趋势折线图：按模型分色，支持日 / 周 / 月粒度切换。 */
export function TokenChart({ projectId }: { projectId: string }) {
  const [granularity, setGranularity] = useState<Granularity>("day");
  const trend = api.oxelia51.tokenTrend.useQuery({ projectId, granularity });
  const theme = useOxeliaChartTheme();

  const option = useMemo<EChartsOption>(() => {
    const rows = trend.data ?? [];
    const buckets = [...new Set(rows.map((r) => r.bucket))].sort();
    const models = [...new Set(rows.map((r) => r.model))];

    return {
      color: theme.palette,
      tooltip: { trigger: "axis" },
      legend: {
        bottom: 0,
        textStyle: { color: theme.mutedColor, fontSize: 11 },
      },
      grid: { left: 8, right: 16, top: 16, bottom: 40, containLabel: true },
      xAxis: {
        type: "category",
        data: buckets,
        axisLabel: { color: theme.mutedColor, fontSize: 11 },
        axisLine: { lineStyle: { color: theme.borderColor } },
      },
      yAxis: {
        type: "value",
        name: "Token 用量",
        nameTextStyle: { color: theme.mutedColor },
        axisLabel: { color: theme.mutedColor, fontSize: 11 },
        splitLine: { lineStyle: { color: theme.borderColor, opacity: 0.5 } },
      },
      series: models.map((model) => ({
        name: model,
        type: "line" as const,
        smooth: true,
        showSymbol: false,
        data: buckets.map(
          (bucket) =>
            rows.find((r) => r.bucket === bucket && r.model === model)
              ?.tokens ?? 0,
        ),
      })),
    };
  }, [trend.data, theme]);

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">Token 趋势</span>
        <SegmentedControl<Granularity>
          options={[
            { value: "day", label: "日" },
            { value: "week", label: "周" },
            { value: "month", label: "月" },
          ]}
          value={granularity}
          onChange={setGranularity}
        />
      </div>
      {trend.isLoading ? (
        <div className="text-muted-foreground flex h-80 items-center justify-center text-sm">
          加载中…
        </div>
      ) : (trend.data?.length ?? 0) === 0 ? (
        <div className="text-muted-foreground flex h-80 items-center justify-center text-sm">
          暂无数据
        </div>
      ) : (
        <EChart option={option} height={320} />
      )}
    </Card>
  );
}
