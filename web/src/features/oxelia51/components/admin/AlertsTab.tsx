"use client";

import { RefreshCw } from "lucide-react";
import { api } from "@/src/utils/api";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
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
  errMsg,
  type AlertLogItem,
} from "@/src/features/oxelia51/components/admin/shared";

const SEVERITY_VARIANT: Record<string, "secondary" | "error" | "outline"> = {
  critical: "error",
  warning: "secondary",
  info: "outline",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "严重",
  warning: "警告",
  info: "提示",
};

/** 发送状态枚举 → 中文（未识别的原样展示） */
const STATUS_LABEL: Record<string, string> = {
  sent: "已发送",
  pending: "待发送",
  failed: "发送失败",
  skipped: "已跳过",
};

/** 告警：跨项目最近告警记录（只读，最近 100 条） */
export function AlertsTab() {
  const alertsQ = api.oxelia51Admin.listAlertLogs.useQuery();
  const alerts = alertsQ.data?.items as AlertLogItem[] | undefined;

  return (
    <AdminCard
      title="告警记录（最近 100 条）"
      description="由分析引擎跨项目写入，只读"
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void alertsQ.refetch();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      }
    >
      {alertsQ.error ? (
        <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
          {errMsg(alertsQ.error)}
        </p>
      ) : alertsQ.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 w-24 text-xs">级别</TableHead>
              <TableHead className="h-8 w-32 text-xs">类型</TableHead>
              <TableHead className="h-8 w-40 text-xs">项目</TableHead>
              <TableHead className="h-8 text-xs">内容</TableHead>
              <TableHead className="h-8 w-24 text-xs">发送</TableHead>
              <TableHead className="h-8 w-36 text-xs">时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="ox-stagger">
            {(alerts ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Badge variant={SEVERITY_VARIANT[a.severity] ?? "outline"}>
                    {SEVERITY_LABEL[a.severity] ?? a.severity}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {a.alertType}
                </TableCell>
                <TableCell className="font-mono text-xs" title={a.projectId}>
                  {a.projectName ?? `${a.projectId.slice(0, 8)}…`}
                </TableCell>
                <TableCell className="max-w-md">
                  <span className="line-clamp-2 text-xs whitespace-pre-wrap">
                    {a.message}
                  </span>
                </TableCell>
                <TableCell className="text-xs">
                  {a.status === "sent" ? (
                    <span style={{ color: "var(--ox-ok)" }}>已发送</span>
                  ) : (
                    <span className="text-muted-foreground">
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {a.createdAt
                    ? new Date(a.createdAt).toLocaleString("zh-CN")
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
            {(alerts ?? []).length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground text-center text-sm"
                >
                  暂无告警记录
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </AdminCard>
  );
}
