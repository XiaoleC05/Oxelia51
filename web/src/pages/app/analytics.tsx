"use client";

import { useState } from "react";
import { api } from "@/src/utils/api";
import { WorkspaceLayout } from "@/src/features/oxelia51/components/workspace/WorkspaceLayout";
import {
  formatCost,
  formatTokens,
  useCurrency,
} from "@/src/features/oxelia51/components/currency";
import { TokenTrendChart } from "@/src/features/oxelia51/components/TokenTrendChart";
import { OxCard } from "@/src/features/oxelia51/components/OxCard";
import { EmptyState } from "@/src/features/oxelia51/components/EmptyState";
import { QueryError } from "@/src/features/oxelia51/components/QueryError";
import { SegmentedControl } from "@/src/features/oxelia51/components/SegmentedControl";
import { Skeleton } from "@/src/components/ui/skeleton";
import Head from "next/head";

/** 个人工作台多维分析：纵（时间趋势）/ 横（模型·项目对比）/ 时（日历热力图）。 */

const GRANULARITY_LABEL = { day: "按日", week: "按周", month: "按月" } as const;
const GRANULARITY_OPTIONS = (
  Object.keys(GRANULARITY_LABEL) as (keyof typeof GRANULARITY_LABEL)[]
).map((value) => ({ value, label: GRANULARITY_LABEL[value] }));

/** §4.9 排行：前三名品牌红由深到浅，第 4 名起回主题色 */
const RANK_BAR_COLORS = ["#c03a3f", "#d44b50", "#e5484d"];
const rankBarColor = (i: number) =>
  i < RANK_BAR_COLORS.length ? RANK_BAR_COLORS[i] : "var(--ox-text-muted)";

function CalendarHeatmap({
  data,
}: {
  data: { date: string; tokens: number }[];
}) {
  const map = new Map(data.map((d) => [d.date, d.tokens]));
  const max = Math.max(...data.map((d) => d.tokens), 1);
  // 最近 35 天，起始日截齐到当周周一；列=周，行=周一~周日（7 行）
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 34);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // toMonday（getDay 周日=0）
  const cells: { key: string; val: number }[] = [];
  for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    cells.push({ key, val: map.get(key) ?? 0 });
  }
  const cellSize = 26;
  const gap = 4;
  const weeks = Math.ceil(cells.length / 7);
  const cellFill = (val: number) =>
    val === 0
      ? "var(--ox-border-light)"
      : `color-mix(in srgb, var(--ox-accent) ${Math.round((0.25 + 0.75 * (val / max)) * 100)}%, var(--ox-bg-alt))`;
  return (
    <div className="overflow-x-auto">
      <svg
        width={weeks * cellSize + (weeks - 1) * gap}
        height={7 * cellSize + 6 * gap}
        className="mx-auto"
      >
        {cells.map((c, i) => {
          const col = Math.floor(i / 7);
          const row = i % 7;
          const x = col * (cellSize + gap);
          const y = row * (cellSize + gap);
          return (
            <rect
              key={c.key}
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              rx={4}
              fill={cellFill(c.val)}
            >
              <title>{`${c.key}: ${formatTokens(c.val)}`}</title>
            </rect>
          );
        })}
      </svg>
      {/* 图例：少 → 多 */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-(--ox-text-muted)">
        <span>少</span>
        <span
          className="inline-block h-3 w-3 rounded-sm"
          style={{ backgroundColor: "var(--ox-border-light)" }}
        />
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <span
            key={t}
            className="inline-block h-3 w-3 rounded-sm"
            style={{
              backgroundColor: `color-mix(in srgb, var(--ox-accent) ${Math.round(t * 100)}%, var(--ox-bg-alt))`,
            }}
          />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [granularity, setGranularity] = useState<"day" | "week" | "month">(
    "day",
  );
  const trend = api.workspace.tokenTrend.useQuery({ granularity });
  const byModel = api.workspace.byModel.useQuery({ days: 30 });
  const byProvider = api.workspace.byProvider.useQuery({ days: 30 });
  const calendar = api.workspace.calendarHeatmap.useQuery({ days: 35 });
  const rateQuery = api.workspace.exchangeRate.useQuery();
  const { currency } = useCurrency();
  const rate = rateQuery.data?.rateCnyPerUsd ?? 7.2;
  const cost = (usd?: number) => formatCost(usd ?? 0, currency, rate);
  const tokens = (n?: number) => formatTokens(n ?? 0);

  const trendByBucket = new Map<string, number>();
  for (const r of trend.data ?? [])
    trendByBucket.set(r.bucket, (trendByBucket.get(r.bucket) ?? 0) + r.tokens);
  const trendData = Array.from(trendByBucket.entries())
    .map(([bucket, v]) => ({ bucket, tokens: v }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));

  const totalModelTokens =
    (byModel.data ?? []).reduce((s, m) => s + m.tokens, 0) || 1;
  const totalProviderCost =
    (byProvider.data ?? []).reduce((s, p) => s + p.costUsd, 0) || 1;
  const failed = [trend, byModel, byProvider, calendar].find((q) => q.isError);

  return (
    <>
      <Head>
        <title>分析 | Oxelia51</title>
      </Head>
      <WorkspaceLayout active="/app/analytics">
        <h1 className="text-xl font-bold tracking-tight text-(--ox-text-h)">
          分析
        </h1>
        <p className="mt-1 text-sm text-(--ox-text-muted)">
          纵 · 横 · 时，多维度看懂 Token 花在哪。
        </p>

        {failed && (
          <div className="mt-6">
            <QueryError
              message={failed.error?.message}
              retrying={failed.isFetching}
              onRetry={() => {
                void trend.refetch();
                void byModel.refetch();
                void byProvider.refetch();
                void calendar.refetch();
              }}
            />
          </div>
        )}

        {/* 纵：时间趋势 */}
        <OxCard className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-(--ox-text-h)">时间趋势</h2>
            <SegmentedControl
              options={GRANULARITY_OPTIONS}
              value={granularity}
              onChange={setGranularity}
            />
          </div>
          <div className="mt-3">
            {trend.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <TokenTrendChart data={trendData} />
            )}
          </div>
        </OxCard>

        {/* 时：日历热力图 */}
        <OxCard className="mt-6">
          <h2 className="text-sm font-bold text-(--ox-text-h)">近 35 天日历</h2>
          <div className="mt-3">
            {calendar.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <CalendarHeatmap data={calendar.data ?? []} />
            )}
          </div>
        </OxCard>

        {/* 横：模型 / 供应商对比 */}
        <div className="ox-stagger mt-6 grid gap-6 lg:grid-cols-2">
          <OxCard>
            <h2 className="text-sm font-bold text-(--ox-text-h)">
              按模型占比（近 30 天）
            </h2>
            <div className="mt-3 flex flex-col gap-2.5">
              {(byModel.data ?? []).slice(0, 5).map((m, i) => (
                <div key={m.model}>
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className="truncate text-(--ox-text-h)"
                      title={m.model}
                    >
                      {m.model}
                    </span>
                    <span className="shrink-0 pl-2 text-(--ox-text-muted) tabular-nums">
                      {Math.round((m.tokens / totalModelTokens) * 100)}% ·{" "}
                      {tokens(m.tokens)} · {cost(m.costUsd)}
                    </span>
                  </div>
                  <div
                    className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: "var(--ox-border-light)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max((m.tokens / totalModelTokens) * 100, 2)}%`,
                        backgroundColor: rankBarColor(i),
                      }}
                    />
                  </div>
                </div>
              ))}
              {!byModel.isLoading &&
                !byModel.isError &&
                (byModel.data ?? []).length === 0 && (
                  <EmptyState
                    description="近 30 天暂无模型消耗。接入代理产生请求后，这里会按模型展示占比。"
                    action={{ href: "/docs", label: "查看接入文档" }}
                  />
                )}
            </div>
          </OxCard>

          <OxCard>
            <h2 className="text-sm font-bold text-(--ox-text-h)">
              按供应商成本占比（近 30 天）
            </h2>
            <div className="mt-3 flex flex-col gap-2.5">
              {(byProvider.data ?? []).slice(0, 5).map((p, i) => (
                <div key={p.provider}>
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className="truncate text-(--ox-text-h)"
                      title={p.provider}
                    >
                      {p.provider}
                    </span>
                    <span className="shrink-0 pl-2 text-(--ox-text-muted) tabular-nums">
                      {Math.round((p.costUsd / totalProviderCost) * 100)}% ·{" "}
                      {cost(p.costUsd)}
                    </span>
                  </div>
                  <div
                    className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: "var(--ox-border-light)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max((p.costUsd / totalProviderCost) * 100, 2)}%`,
                        backgroundColor: rankBarColor(i),
                      }}
                    />
                  </div>
                </div>
              ))}
              {!byProvider.isLoading &&
                !byProvider.isError &&
                (byProvider.data ?? []).length === 0 && (
                  <EmptyState
                    description="近 30 天暂无供应商消耗。接入代理产生请求后，这里会按平台展示成本占比。"
                    action={{ href: "/docs", label: "查看接入文档" }}
                  />
                )}
            </div>
          </OxCard>
        </div>
      </WorkspaceLayout>
    </>
  );
}

AnalyticsPage.skipAppLayout = true;
