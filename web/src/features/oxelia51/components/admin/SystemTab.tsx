"use client";

import { api } from "@/src/utils/api";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import {
  AdminCard,
  LiveDot,
  StatCell,
  errMsg,
  formatUptime,
  gatewayQStatus,
  POLL_MS,
  type GatewayStats,
  type ServerStats,
} from "@/src/features/oxelia51/components/admin/shared";

/** 状态卡首次加载骨架：2 列 4 格指标 + 一行说明 */
function StatGridSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

/** 系统状态：阿里云 + 腾讯云服务器状态、代理网关状态（含供应商表） */
export function SystemTab() {
  const statsQ = api.oxelia51Admin.serverStats.useQuery(undefined, {
    refetchInterval: POLL_MS,
  });
  const localStatsQ = api.oxelia51Admin.localStats.useQuery(undefined, {
    refetchInterval: POLL_MS,
  });
  const gatewayStatsQ = api.oxelia51Admin.gatewayStats.useQuery(undefined, {
    refetchInterval: POLL_MS,
  });

  const stats = statsQ.data as ServerStats | undefined;
  const gateway = gatewayStatsQ.data as GatewayStats | undefined;
  const gw = gateway?.stats;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 服务器状态（阿里云） */}
      <AdminCard
        title="服务器状态（阿里云）"
        description="每 5 秒自动刷新"
        action={<LiveDot />}
      >
        {statsQ.error ? (
          <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
            {errMsg(statsQ.error)}
          </p>
        ) : !stats ? (
          <StatGridSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCell
                label="CPU"
                value={
                  stats?.cpu_percent != null
                    ? `${stats.cpu_percent.toFixed(1)}%`
                    : "—"
                }
              />
              <StatCell
                label="内存"
                value={
                  stats?.memory_used_mb != null
                    ? `${(stats.memory_used_mb / 1024).toFixed(1)} / ${((stats.memory_total_mb ?? 0) / 1024).toFixed(1)} GB`
                    : "—"
                }
              />
              <StatCell
                label="磁盘"
                value={
                  stats?.disk_used_percent != null
                    ? `${stats.disk_used_percent.toFixed(1)}%`
                    : "—"
                }
                sub={
                  stats?.disk_total_gb != null
                    ? `共 ${stats.disk_total_gb} GB`
                    : undefined
                }
                warn={(stats?.disk_used_percent ?? 0) > 85}
              />
              <StatCell
                label="主机运行时长"
                value={formatUptime(stats?.uptime_seconds)}
                sub={`服务运行 ${formatUptime(stats?.process_uptime_seconds)}`}
              />
            </div>
          </>
        )}
      </AdminCard>

      {/* 服务器状态（腾讯云，langfuse-web 所在主机） */}
      <AdminCard
        title="服务器状态（腾讯云）"
        description="每 5 秒自动刷新"
        action={<LiveDot />}
      >
        {localStatsQ.error ? (
          <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
            {errMsg(localStatsQ.error)}
          </p>
        ) : !localStatsQ.data ? (
          <StatGridSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCell
                label="CPU"
                value={
                  localStatsQ.data?.cpuPercent != null
                    ? `${localStatsQ.data.cpuPercent.toFixed(1)}%`
                    : "—"
                }
              />
              <StatCell
                label="内存"
                value={
                  localStatsQ.data?.memoryUsedMB != null
                    ? `${(localStatsQ.data.memoryUsedMB / 1024).toFixed(1)} / ${((localStatsQ.data.memoryTotalMB ?? 0) / 1024).toFixed(1)} GB`
                    : "—"
                }
              />
              <StatCell
                label="磁盘"
                value={
                  localStatsQ.data?.diskUsedPercent != null
                    ? `${localStatsQ.data.diskUsedPercent.toFixed(1)}%`
                    : "—"
                }
                sub={
                  localStatsQ.data?.diskTotalGB != null
                    ? `共 ${localStatsQ.data.diskTotalGB} GB`
                    : undefined
                }
                warn={(localStatsQ.data?.diskUsedPercent ?? 0) > 85}
              />
              <StatCell
                label="主机运行时长"
                value={formatUptime(localStatsQ.data?.uptimeSeconds)}
                sub={`服务运行 ${formatUptime(localStatsQ.data?.processUptimeSeconds)}`}
              />
            </div>
          </>
        )}
      </AdminCard>

      {/* 代理网关状态 */}
      <AdminCard
        title={`代理网关状态（近 ${gw?.windowSeconds ?? 5} 分钟）`}
        description="每 5 秒自动刷新"
        className="lg:col-span-2"
        action={
          <span
            className="text-xs"
            style={{
              color:
                gateway?.status === "ok" ? "var(--ox-ok)" : "var(--ox-warn)",
            }}
          >
            {gatewayQStatus(gateway)}
          </span>
        }
      >
        {gatewayStatsQ.error ? (
          <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
            {errMsg(gatewayStatsQ.error)}
          </p>
        ) : !gw ? (
          <StatGridSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              <StatCell
                label="总请求数"
                value={gw.totalRequests.toLocaleString()}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              运行时长：{formatUptime(gw.uptimeSeconds)}
            </p>
            {gw.byProvider.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">供应商</TableHead>
                    <TableHead className="h-8 text-right text-xs">
                      请求数
                    </TableHead>
                    <TableHead className="h-8 text-right text-xs">
                      失败
                    </TableHead>
                    <TableHead className="h-8 text-right text-xs">
                      平均延迟
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gw.byProvider.slice(0, 10).map((p) => (
                    <TableRow key={p.provider}>
                      <TableCell className="font-mono text-xs">
                        {p.provider}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.requests.toLocaleString()}
                      </TableCell>
                      <TableCell
                        className="text-right tabular-nums"
                        style={{
                          color: p.failures > 0 ? "var(--ox-warn)" : undefined,
                        }}
                      >
                        {p.failures}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.avgLatencyMs.toFixed(0)} ms
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </AdminCard>
    </div>
  );
}
