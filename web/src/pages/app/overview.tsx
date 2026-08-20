"use client";

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
import { Skeleton } from "@/src/components/ui/skeleton";
import Head from "next/head";

/** 个人工作台总览：跨项目今日/周/月 token、本月成本、时间趋势、模型/供应商排行。 */

function StatCard({
  label,
  value,
  hint,
  accent = false,
  loading = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <OxCard>
      <div className="text-xs text-(--ox-text-muted)">{label}</div>
      {loading ? (
        <Skeleton className="mt-1 h-7 w-20" />
      ) : (
        <div
          className="mt-1 text-xl font-bold tabular-nums"
          style={{ color: accent ? "var(--ox-accent)" : "var(--ox-text-h)" }}
        >
          {value}
        </div>
      )}
      {hint && !loading && (
        <div className="mt-1 text-xs text-(--ox-text-muted)">{hint}</div>
      )}
    </OxCard>
  );
}

export default function OverviewPage() {
  const overview = api.workspace.overview.useQuery();
  const trend = api.workspace.tokenTrend.useQuery({ granularity: "day" });
  const byModel = api.workspace.byModel.useQuery({ days: 30 });
  const byProvider = api.workspace.byProvider.useQuery({ days: 30 });
  const rateQuery = api.workspace.exchangeRate.useQuery();
  const { currency } = useCurrency();
  const rate = rateQuery.data?.rateCnyPerUsd ?? 7.2;
  const cost = (usd?: number) => formatCost(usd ?? 0, currency, rate);
  const tokens = (n?: number) => formatTokens(n ?? 0);

  // 聚合 trend 为按 bucket 总 token
  const trendByBucket = new Map<string, number>();
  for (const r of trend.data ?? []) {
    trendByBucket.set(r.bucket, (trendByBucket.get(r.bucket) ?? 0) + r.tokens);
  }
  const trendData = Array.from(trendByBucket.entries())
    .map(([bucket, tokens]) => ({ bucket, tokens }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));

  const o = overview.data;
  const failed = [overview, trend, byModel, byProvider].find((q) => q.isError);

  return (
    <>
      <Head>
        <title>总览 | Oxelia51</title>
      </Head>
      <WorkspaceLayout active="/app/overview">
        <h1 className="text-xl font-bold tracking-tight text-(--ox-text-h)">
          总览
        </h1>
        <p className="mt-1 text-sm text-(--ox-text-muted)">
          跨所有项目的 Token 消耗与成本。
        </p>

        {failed && (
          <div className="mt-6">
            <QueryError
              message={failed.error?.message}
              retrying={failed.isFetching}
              onRetry={() => {
                void overview.refetch();
                void trend.refetch();
                void byModel.refetch();
                void byProvider.refetch();
              }}
            />
          </div>
        )}

        {/* 统计卡 */}
        <div className="ox-stagger mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="今日 Token"
            value={tokens(o?.todayTokens)}
            hint={o ? `昨日 ${tokens(o.yesterdayTokens)}` : undefined}
            accent
            loading={overview.isLoading}
          />
          <StatCard
            label="本周 Token"
            value={tokens(o?.weekTokens)}
            hint={o ? `上周 ${tokens(o.prevWeekTokens)}` : undefined}
            loading={overview.isLoading}
          />
          <StatCard
            label="本月 Token"
            value={tokens(o?.monthTokens)}
            hint={o ? `上月 ${tokens(o.prevMonthTokens)}` : undefined}
            loading={overview.isLoading}
          />
          <StatCard
            label="本月成本"
            value={cost(o?.monthCostUsd)}
            hint={o ? `今日 ${cost(o.todayCostUsd)}` : undefined}
            accent
            loading={overview.isLoading}
          />
        </div>

        {/* 趋势 */}
        <OxCard className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-(--ox-text-h)">
              近 30 天 Token 趋势
            </h2>
            <span className="text-xs text-(--ox-text-muted)">按日</span>
          </div>
          <div className="mt-3">
            {trend.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <TokenTrendChart data={trendData} />
            )}
          </div>
        </OxCard>

        <div className="ox-stagger mt-6 grid gap-6 lg:grid-cols-2">
          {/* 模型排行 */}
          <OxCard className="p-0">
            <div
              className="border-b px-4 py-3 text-sm font-bold text-(--ox-text-h)"
              style={{ borderColor: "var(--ox-border)" }}
            >
              按模型（近 30 天）
            </div>
            <div
              className="flex flex-col divide-y"
              style={{ borderColor: "var(--ox-border)" }}
            >
              {(byModel.data ?? []).slice(0, 6).map((m) => (
                <div
                  key={m.model}
                  className="flex items-center justify-between px-4 py-2.5 text-sm"
                >
                  <span className="truncate text-(--ox-text-h)" title={m.model}>
                    {m.model}
                  </span>
                  <span className="shrink-0 pl-3 text-right tabular-nums">
                    <span className="text-(--ox-text-h)">
                      {formatTokens(m.tokens)}
                    </span>
                    <span className="ml-2 text-xs text-(--ox-text-muted)">
                      {cost(m.costUsd)}
                    </span>
                  </span>
                </div>
              ))}
              {!byModel.isLoading &&
                !byModel.isError &&
                (byModel.data ?? []).length === 0 && (
                  <EmptyState
                    className="m-3"
                    description="近 30 天暂无模型消耗。接入代理产生请求后，这里会按模型展示排行。"
                    action={{ href: "/docs", label: "查看接入文档" }}
                  />
                )}
            </div>
          </OxCard>

          {/* 供应商排行 */}
          <OxCard className="p-0">
            <div
              className="border-b px-4 py-3 text-sm font-bold text-(--ox-text-h)"
              style={{ borderColor: "var(--ox-border)" }}
            >
              按供应商（近 30 天）
            </div>
            <div
              className="flex flex-col divide-y"
              style={{ borderColor: "var(--ox-border)" }}
            >
              {(byProvider.data ?? []).slice(0, 6).map((p) => (
                <div
                  key={p.provider}
                  className="flex items-center justify-between px-4 py-2.5 text-sm"
                >
                  <span
                    className="truncate text-(--ox-text-h)"
                    title={p.provider}
                  >
                    {p.provider}
                  </span>
                  <span className="shrink-0 pl-3 text-right tabular-nums">
                    <span className="text-(--ox-text-h)">
                      {formatTokens(p.tokens)}
                    </span>
                    <span className="ml-2 text-xs text-(--ox-text-muted)">
                      {cost(p.costUsd)}
                    </span>
                  </span>
                </div>
              ))}
              {!byProvider.isLoading &&
                !byProvider.isError &&
                (byProvider.data ?? []).length === 0 && (
                  <EmptyState
                    className="m-3"
                    description="近 30 天暂无供应商消耗。接入代理产生请求后，这里会按平台展示排行。"
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

OverviewPage.skipAppLayout = true;
