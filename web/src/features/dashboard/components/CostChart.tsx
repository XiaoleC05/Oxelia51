"use client";

import { useMemo } from "react";
import { api } from "@/src/utils/api";
import { Card } from "@/src/components/ui/card";
import { EChart } from "@/src/features/dashboard/components/EChart";
import { useOxeliaChartTheme } from "@/src/features/dashboard/components/useOxeliaChartTheme";
import { SegmentedControl } from "@/src/features/oxelia51/components/SegmentedControl";
import {
  useCurrency,
  type Currency,
} from "@/src/features/oxelia51/components/currency";
import type { EChartsOption } from "echarts";

/** 成本饼图：近 30 天按模型成本占比，支持 CNY/USD 切换。 */
export function CostChart({ projectId }: { projectId: string }) {
  const costByModel = api.oxelia51.costByModel.useQuery({
    projectId,
    days: 30,
  });
  const { currency, setCurrency, rate } = useCurrency();
  const theme = useOxeliaChartTheme();

  const option = useMemo<EChartsOption>(() => {
    const rows = costByModel.data ?? [];
    const symbol = currency === "CNY" ? "¥" : "$";
    const convert = (usd: number) => (currency === "CNY" ? usd * rate : usd);

    return {
      color: theme.palette,
      tooltip: {
        trigger: "item",
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number; percent: number };
          return `${p.name}<br/>${symbol}${p.value.toFixed(2)} (${p.percent}%)`;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: theme.mutedColor, fontSize: 11 },
      },
      series: [
        {
          type: "pie" as const,
          radius: ["40%", "70%"],
          center: ["50%", "45%"],
          label: {
            color: theme.textColor,
            fontSize: 11,
            formatter: (params: unknown) => {
              const p = params as { name: string; percent: number };
              return `${p.name} ${p.percent}%`;
            },
          },
          data: rows.map((r) => ({
            name: r.model,
            value: Number(convert(r.costUsd).toFixed(4)),
          })),
        },
      ],
    };
  }, [costByModel.data, currency, rate, theme]);

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">成本占比（近 30 天）</span>
        <SegmentedControl<Currency>
          options={[
            { value: "CNY", label: "CNY" },
            { value: "USD", label: "USD" },
          ]}
          value={currency}
          onChange={setCurrency}
        />
      </div>
      {costByModel.isLoading ? (
        <div className="text-muted-foreground flex h-80 items-center justify-center text-sm">
          加载中…
        </div>
      ) : (costByModel.data?.length ?? 0) === 0 ? (
        <div className="text-muted-foreground flex h-80 items-center justify-center text-sm">
          暂无数据
        </div>
      ) : (
        <EChart option={option} height={320} />
      )}
    </Card>
  );
}
