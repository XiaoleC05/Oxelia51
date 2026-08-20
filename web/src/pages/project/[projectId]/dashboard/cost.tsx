import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import Page from "@/src/components/layouts/page";
import { api } from "@/src/utils/api";
import { ProxyAccessEmptyState } from "@/src/features/oxelia51/components/ProxyAccessEmptyState";
import { Card } from "@/src/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { EChart } from "@/src/features/dashboard/components/EChart";
import { useOxeliaChartTheme } from "@/src/features/dashboard/components/useOxeliaChartTheme";
import { SegmentedControl } from "@/src/features/oxelia51/components/SegmentedControl";
import {
  CurrencyProvider,
  altCost,
  formatCost,
  formatTokens,
  useCurrency,
  type Currency,
} from "@/src/features/oxelia51/components/currency";
import type { EChartsOption } from "echarts";

export default function CostPage() {
  const router = useRouter();
  const { projectId } = router.query as { projectId: string };

  return (
    <CurrencyProvider projectId={projectId}>
      <CostPageContent projectId={projectId} />
    </CurrencyProvider>
  );
}

function CostPageContent({ projectId }: { projectId: string }) {
  const { currency, setCurrency } = useCurrency();
  const overview = api.oxelia51.overview.useQuery({ projectId });
  const isEmpty =
    overview.data != null &&
    !overview.data.todayTokens &&
    !overview.data.weekTokens &&
    !overview.data.monthTokens &&
    !overview.data.todayCostUsd &&
    !overview.data.monthCostUsd;

  return (
    <Page
      scrollable
      headerProps={{
        title: "成本分析",
        help: {
          description: "Oxelia51 成本分析：总花费、模型占比、趋势与项目排行。",
        },
        actionButtonsRight: (
          <SegmentedControl<Currency>
            options={[
              { value: "CNY", label: "CNY" },
              { value: "USD", label: "USD" },
            ]}
            value={currency}
            onChange={setCurrency}
          />
        ),
      }}
    >
      <div className="flex flex-col gap-4 p-4 pb-8">
        {isEmpty && <ProxyAccessEmptyState projectId={projectId} />}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <MonthCostCard projectId={projectId} />
          <div className="lg:col-span-2">
            <TopModelsBar projectId={projectId} />
          </div>
        </div>
        <CostTrendChart projectId={projectId} />
        <ProjectRankingTable projectId={projectId} />
      </div>
    </Page>
  );
}

/** 本月总花费卡片 */
function MonthCostCard({ projectId }: { projectId: string }) {
  const overview = api.oxelia51.overview.useQuery({ projectId });
  const { currency, rate } = useCurrency();
  const costUsd = overview.data?.monthCostUsd ?? 0;

  return (
    <Card className="flex flex-col justify-center gap-1 p-6">
      <span className="text-muted-foreground text-xs">本月总花费</span>
      {overview.isLoading ? (
        <span className="text-muted-foreground text-3xl">…</span>
      ) : (
        <>
          <span
            className="text-3xl font-bold tabular-nums"
            style={{ color: "var(--ox-text-h)" }}
          >
            {formatCost(costUsd, currency, rate)}
          </span>
          <span className="text-muted-foreground text-xs">
            {altCost(costUsd, currency, rate)}
          </span>
        </>
      )}
    </Card>
  );
}

/** 模型 Top 5 柱状图（近 30 天花费） */
function TopModelsBar({ projectId }: { projectId: string }) {
  const costByModel = api.oxelia51.costByModel.useQuery({
    projectId,
    days: 30,
  });
  const { currency, rate } = useCurrency();
  const theme = useOxeliaChartTheme();

  const option = useMemo<EChartsOption>(() => {
    const top5 = (costByModel.data ?? []).slice(0, 5);
    const convert = (usd: number) => (currency === "CNY" ? usd * rate : usd);
    const symbol = currency === "CNY" ? "¥" : "$";

    return {
      color: [theme.accentColor],
      tooltip: {
        trigger: "axis",
        formatter: (params) => {
          const list = params as Array<{ name: string; value: number }>;
          const p = list[0];
          return p ? `${p.name}<br/>${symbol}${p.value.toFixed(2)}` : "";
        },
      },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: top5.map((r) => r.model),
        axisLabel: {
          color: theme.mutedColor,
          fontSize: 11,
          interval: 0,
          rotate: top5.length > 3 ? 20 : 0,
        },
        axisLine: { lineStyle: { color: theme.borderColor } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: theme.mutedColor, fontSize: 11 },
        splitLine: { lineStyle: { color: theme.borderColor, opacity: 0.5 } },
      },
      series: [
        {
          type: "bar" as const,
          barMaxWidth: 48,
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          data: top5.map((r) => Number(convert(r.costUsd).toFixed(4))),
        },
      ],
    };
  }, [costByModel.data, currency, rate, theme]);

  return (
    <Card className="flex h-full flex-col gap-2 p-4">
      <span className="text-sm font-bold">模型 Top 5（近 30 天花费）</span>
      {costByModel.isLoading ? (
        <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
          加载中…
        </div>
      ) : (costByModel.data?.length ?? 0) === 0 ? (
        <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
          暂无数据
        </div>
      ) : (
        <EChart option={option} height={256} />
      )}
    </Card>
  );
}

/** 近 30 天花费趋势（按模型，可堆叠 / 分离） */
function CostTrendChart({ projectId }: { projectId: string }) {
  const [mode, setMode] = useState<"stacked" | "split">("stacked");
  const costTrend = api.oxelia51.costTrend.useQuery({ projectId });
  const { currency, rate } = useCurrency();
  const theme = useOxeliaChartTheme();

  const option = useMemo<EChartsOption>(() => {
    const rows = costTrend.data ?? [];
    const dates = [...new Set(rows.map((r) => r.date))].sort();
    const models = [...new Set(rows.map((r) => r.model))];
    const convert = (usd: number) => (currency === "CNY" ? usd * rate : usd);
    // 货币符号与 y 轴/tooltip 保持一致，切换后全图统一
    const symbol = currency === "CNY" ? "¥" : "$";
    const money = (v: number) => `${symbol}${v.toFixed(2)}`;

    return {
      color: theme.palette,
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: unknown) => money(Number(value)),
      },
      legend: {
        bottom: 0,
        textStyle: { color: theme.mutedColor, fontSize: 11 },
      },
      grid: { left: 8, right: 16, top: 16, bottom: 40, containLabel: true },
      xAxis: {
        type: "category",
        data: dates,
        axisLabel: { color: theme.mutedColor, fontSize: 11 },
        axisLine: { lineStyle: { color: theme.borderColor } },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: theme.mutedColor,
          fontSize: 11,
          formatter: (value: number) => `${symbol}${value}`,
        },
        splitLine: { lineStyle: { color: theme.borderColor, opacity: 0.5 } },
      },
      series: models.map((model) => ({
        name: model,
        type: "line" as const,
        smooth: true,
        showSymbol: false,
        stack: mode === "stacked" ? "cost" : undefined,
        areaStyle: mode === "stacked" ? { opacity: 0.25 } : undefined,
        data: dates.map((date) => {
          const usd =
            rows.find((r) => r.date === date && r.model === model)?.costUsd ??
            0;
          return Number(convert(usd).toFixed(4));
        }),
      })),
    };
  }, [costTrend.data, currency, rate, mode, theme]);

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">近 30 天花费趋势</span>
        <SegmentedControl<"stacked" | "split">
          options={[
            { value: "stacked", label: "堆叠" },
            { value: "split", label: "分离" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>
      {costTrend.isLoading ? (
        <div className="text-muted-foreground flex h-72 items-center justify-center text-sm">
          加载中…
        </div>
      ) : (costTrend.data?.length ?? 0) === 0 ? (
        <div className="text-muted-foreground flex h-72 items-center justify-center text-sm">
          暂无数据
        </div>
      ) : (
        <EChart option={option} height={288} />
      )}
    </Card>
  );
}

/** 项目花费排行表（同组织，近 30 天） */
function ProjectRankingTable({ projectId }: { projectId: string }) {
  const ranking = api.oxelia51.projectCostRanking.useQuery({ projectId });
  const { currency, rate } = useCurrency();

  return (
    <Card className="flex flex-col gap-2 p-4">
      <span className="text-sm font-bold">项目花费排行（近 30 天）</span>
      {ranking.isLoading ? (
        <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
          加载中…
        </div>
      ) : (ranking.data?.length ?? 0) === 0 ? (
        <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
          暂无数据
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>项目名</TableHead>
              <TableHead className="text-right">Token</TableHead>
              <TableHead className="text-right">花费</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranking.data?.map((row) => (
              <TableRow key={row.projectId}>
                <TableCell>
                  {row.projectName}
                  {row.projectId === projectId && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      （当前项目）
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatTokens(row.tokens)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCost(row.costUsd, currency, rate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
