"use client";

import { useMemo } from "react";
import { api } from "@/src/utils/api";
import { Card } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { EChart } from "@/src/features/dashboard/components/EChart";
import { useOxeliaChartTheme } from "@/src/features/dashboard/components/useOxeliaChartTheme";
import type { EChartsOption } from "echarts";
import {
  AdminCard,
  LiveDot,
  StatCell,
  errMsg,
  formatUptime,
  gatewayQStatus,
  POLL_MS,
  type GatewayStats,
} from "@/src/features/oxelia51/components/admin/shared";

/** 大数字紧凑格式：1.2k / 3.4M / 5.6B（图表轴与 tooltip 用） */
function compactNumber(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return String(v);
}

/** 单张指标卡：标签 / 数值 / 次要说明 三级层级；加载中显示骨架 */
function MetricCard({
  label,
  value,
  sub,
  warn = false,
  loading = false,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
  loading?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      {loading ? (
        <Skeleton className="my-0.5 h-7 w-20" />
      ) : (
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ color: warn ? "var(--ox-warn)" : "var(--ox-text-h)" }}
        >
          {value}
        </span>
      )}
      {sub && <span className="text-muted-foreground text-xs">{sub}</span>}
    </Card>
  );
}

/** 近 14 天平台用量：token 柱状 + 费用副轴折线（oxelia51.daily_stats 平台级汇总） */
function PlatformDailyTrendCard() {
  const trendQ = api.oxelia51Admin.platformDailyTrend.useQuery();
  const theme = useOxeliaChartTheme();

  const rows = useMemo(() => trendQ.data ?? [], [trendQ.data]);
  const hasData = rows.some((r) => r.tokens > 0 || r.costUsd > 0);

  const option = useMemo<EChartsOption>(
    () => ({
      color: [theme.palette[0] ?? theme.accentColor, theme.accentColor],
      tooltip: {
        trigger: "axis",
        textStyle: { fontSize: 12 },
        formatter: (params) => {
          const items = Array.isArray(params) ? params : [params];
          const day =
            (items[0] as { axisValue?: string } | undefined)?.axisValue ?? "";
          const lines = items.map((p) => {
            const value = typeof p.value === "number" ? p.value : 0;
            const text =
              p.seriesName === "费用"
                ? `$${value.toFixed(2)}`
                : `${compactNumber(value)} tokens`;
            return `${p.marker} ${p.seriesName}：${text}`;
          });
          return [day, ...lines].join("<br/>");
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: theme.mutedColor, fontSize: 11 },
      },
      grid: { left: 8, right: 8, top: 24, bottom: 36, containLabel: true },
      xAxis: {
        type: "category",
        data: rows.map((r) => r.day.slice(5)), // YYYY-MM-DD → MM-DD
        axisLabel: { color: theme.mutedColor, fontSize: 11 },
        axisLine: { lineStyle: { color: theme.borderColor } },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: "value",
          axisLabel: {
            color: theme.mutedColor,
            fontSize: 11,
            formatter: (v: number) => compactNumber(v),
          },
          splitLine: {
            lineStyle: { color: theme.borderColor, opacity: 0.5 },
          },
        },
        {
          type: "value",
          axisLabel: {
            color: theme.mutedColor,
            fontSize: 11,
            formatter: (v: number) => `$${v}`,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "Tokens",
          type: "bar",
          barMaxWidth: 18,
          itemStyle: { borderRadius: [3, 3, 0, 0], opacity: 0.85 },
          data: rows.map((r) => r.tokens),
        },
        {
          name: "费用",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2 },
          data: rows.map((r) => r.costUsd),
        },
      ],
    }),
    [rows, theme],
  );

  return (
    <AdminCard
      title="近 14 天平台用量"
      description="全部项目的 Token 用量与费用（USD）按日汇总"
    >
      {trendQ.error ? (
        <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
          {errMsg(trendQ.error)}
        </p>
      ) : trendQ.isLoading ? (
        <Skeleton className="h-60 w-full" />
      ) : !hasData ? (
        <div className="text-muted-foreground flex h-60 items-center justify-center text-sm">
          暂无数据
        </div>
      ) : (
        <EChart option={option} height={240} />
      )}
    </AdminCard>
  );
}

/** 桌面端 GitHub Release 下载量（服务端 siteStats.downloadStats，内存缓存 1h） */
function DesktopDownloadCard() {
  const statsQ = api.siteStats.downloadStats.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const stats = statsQ.data;

  return (
    <AdminCard
      title="桌面端下载"
      description="GitHub Releases 真实下载量，服务端每小时刷新一次"
    >
      {statsQ.error ? (
        <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
          {errMsg(statsQ.error)}
        </p>
      ) : statsQ.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !stats ? (
        <div className="text-muted-foreground text-sm">
          暂无数据（GitHub 拉取失败或尚无正式发布版本）
        </div>
      ) : (
        <>
          <StatCell
            label="总下载量"
            value={stats.totalDownloads.toLocaleString()}
            sub={`${stats.version}${stats.publishedAt ? ` · 发布于 ${stats.publishedAt.slice(0, 10)}` : ""}${stats.stale ? " · 缓存数据" : ""}`}
          />
          <ul className="flex flex-col gap-1.5">
            {stats.assets.map((a) => (
              <li
                key={a.name}
                className="flex items-center justify-between gap-4 text-xs"
              >
                <span
                  className="truncate"
                  style={{ color: "var(--ox-text-h)" }}
                  title={a.name}
                >
                  {a.name}
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {a.downloads.toLocaleString()} 次
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminCard>
  );
}

/** 总览：平台核心指标（4 卡一排）+ 近 14 天平台用量 + 代理网关实时摘要 */
export function OverviewTab() {
  const overviewQ = api.oxelia51Admin.platformOverview.useQuery();
  const gatewayStatsQ = api.oxelia51Admin.gatewayStats.useQuery(undefined, {
    refetchInterval: POLL_MS,
  });

  const overview = overviewQ.data;
  const gateway = gatewayStatsQ.data as GatewayStats | undefined;
  const gw = gateway?.stats;

  return (
    <div className="flex flex-col gap-4">
      {overviewQ.error ? (
        <AdminCard title="平台指标">
          <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
            {errMsg(overviewQ.error)}
          </p>
        </AdminCard>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MetricCard
            label="注册用户数"
            value={overview ? overview.userCount.toLocaleString() : "…"}
            sub="平台累计"
            loading={overviewQ.isLoading}
          />
          <MetricCard
            label="项目数"
            value={overview ? overview.projectCount.toLocaleString() : "…"}
            sub="全部组织"
            loading={overviewQ.isLoading}
          />
          <MetricCard
            label="待处理反馈"
            value={
              overview ? overview.pendingFeedbackCount.toLocaleString() : "…"
            }
            sub="状态为「新反馈」"
            warn={(overview?.pendingFeedbackCount ?? 0) > 0}
            loading={overviewQ.isLoading}
          />
          <MetricCard
            label="近 24h 告警"
            value={
              overview ? overview.alertsLast24hCount.toLocaleString() : "…"
            }
            sub="跨项目告警记录"
            warn={(overview?.alertsLast24hCount ?? 0) > 0}
            loading={overviewQ.isLoading}
          />
        </div>
      )}

      <PlatformDailyTrendCard />

      <DesktopDownloadCard />

      <AdminCard
        title={`代理网关摘要（近 ${gw?.windowSeconds ?? 5} 分钟）`}
        description="每 5 秒自动刷新"
        action={<LiveDot />}
      >
        {gatewayStatsQ.error ? (
          <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
            {errMsg(gatewayStatsQ.error)}
          </p>
        ) : !gw ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
            <Skeleton className="h-3 w-48" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCell
                label="QPS"
                value={gw.qps > 0 ? gw.qps.toFixed(2) : "0.00"}
              />
              <StatCell
                label="平均延迟"
                value={`${gw.avgLatencyMs.toFixed(0)} ms`}
              />
              <StatCell
                label="成功率"
                value={`${gw.successRate.toFixed(1)}%`}
                warn={gw.successRate < 90 && gw.totalRequests > 0}
              />
              <StatCell label="网关状态" value={gatewayQStatus(gateway)} />
            </div>
            <p className="text-muted-foreground text-xs">
              运行时长：{formatUptime(gw.uptimeSeconds)} · 总请求数：
              {gw.totalRequests.toLocaleString()}
            </p>
          </>
        )}
      </AdminCard>
    </div>
  );
}
