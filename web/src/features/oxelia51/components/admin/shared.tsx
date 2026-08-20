"use client";

import { type ReactNode } from "react";
import { Card } from "@/src/components/ui/card";
import { api } from "@/src/utils/api";

/**
 * Oxelia51 管理台共享类型与展示组件。
 * 由各 Tab（总览/反馈/用户/系统状态/安全/工具/告警）复用，
 * 数据全部经 tRPC oxelia51Admin router 服务端代理获取。
 */

export type ServerStats = {
  cpu_percent?: number;
  memory_used_mb?: number;
  memory_total_mb?: number;
  disk_used_percent?: number;
  disk_total_gb?: number;
  /** 主机运行时长（容器内为宿主机时长） */
  uptime_seconds?: number;
  /** 服务进程运行时长（容器重启归零） */
  process_uptime_seconds?: number;
  go_goroutines?: number;
};

export type PowerRecord = {
  kbalance?: number | null;
  zbalance?: number | null;
  record_time?: string;
};

export type GatewayStats = {
  status?: string;
  uptimeSec?: number;
  stats?: {
    uptimeSeconds: number;
    totalRequests: number;
    successRate: number;
    qps: number;
    avgLatencyMs: number;
    windowSeconds: number;
    byProvider: Array<{
      provider: string;
      requests: number;
      failures: number;
      avgLatencyMs: number;
    }>;
  };
};

export type WhitelistItem = {
  id: number;
  ip: string;
  label: string;
  created_at?: string;
};

export type UserItem = {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
  /** 邮箱制管理员判定（adminAuth.ts）——不再展示 langfuse 组织/角色残留 */
  isPlatformAdmin: boolean;
  isPlatformSuperAdmin: boolean;
};

export type FeedbackItem = {
  id: number;
  email: string;
  category: string;
  message: string;
  projectId: string | null;
  /** 关联 projects 表取到的项目名（项目已删除时为 null，前端回落截断 ID） */
  projectName?: string | null;
  status: string;
  createdAt: string;
};

export type AlertLogItem = {
  id: number;
  projectId: string;
  /** 关联 projects 表取到的项目名（取不到时前端回落截断 ID） */
  projectName?: string | null;
  alertType: string;
  severity: string;
  message: string;
  status: string;
  createdAt: string;
};

/** 轮询间隔（系统状态类卡片） */
export const POLL_MS = 5000;

/** 当前登录用户是否为超级管理员（非超级管理员的管理员只读，操作按钮应隐藏） */
export function useIsSuperAdmin(): boolean {
  const whoami = api.oxelia51Admin.whoami.useQuery(undefined, {
    staleTime: Infinity,
  });
  return Boolean(whoami.data?.isSuperAdmin);
}

export const FEEDBACK_CATEGORY_LABEL: Record<string, string> = {
  feature: "功能建议",
  bug: "Bug 反馈",
  other: "其他",
};

export const FEEDBACK_CATEGORY_VARIANT: Record<
  string,
  "secondary" | "error" | "outline"
> = {
  feature: "secondary",
  bug: "error",
  other: "outline",
};

export const FEEDBACK_STATUS_LABEL: Record<string, string> = {
  new: "新反馈",
  processing: "处理中",
  done: "已完成",
};

export const FEEDBACK_STATUS_VARIANT: Record<
  string,
  "secondary" | "error" | "outline"
> = {
  new: "error",
  processing: "secondary",
  done: "outline",
};

export function formatUptime(seconds?: number) {
  if (!seconds) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d} 天 ${h} 小时` : `${h} 小时 ${m} 分`;
}

export function LiveDot() {
  return (
    <span
      className="flex items-center gap-1.5 text-xs"
      style={{ color: "var(--ox-ok)" }}
    >
      <span className="relative flex h-2 w-2">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ backgroundColor: "var(--ox-ok)" }}
        />
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--ox-ok)" }}
        />
      </span>
      实时
    </span>
  );
}

/**
 * 把 tRPC / 网络错误映射为中文友好文案。
 * 服务端已中文化的 message 原样保留；原始英文（tRPC 错误码、网络异常等）
 * 映射为常见中文，未识别的英文兜底「操作失败，请重试」并 console 留原文。
 */
export function errMsg(e: { message?: string } | null | undefined) {
  const raw = e?.message ?? "";
  if (!raw) return "";
  if (/UNAUTHORIZED/i.test(raw)) return "未登录或会话已过期，请重新登录";
  if (/FORBIDDEN/i.test(raw)) return "没有权限执行此操作";
  if (
    /failed to fetch|network ?error|fetch failed|ECONNREFUSED|ETIMEDOUT/i.test(
      raw,
    )
  )
    return "网络异常，请重试";
  // 含中文的 message 视为服务端友好文案，直接展示
  if (/[一-龥]/.test(raw)) return raw;
  // 纯英文原文不上界面，留 console 便于排查
  console.warn("[admin] 未映射的错误信息:", raw);
  return "操作失败，请重试";
}

export function gatewayQStatus(g: GatewayStats | undefined): string {
  if (!g) return "状态未知";
  if (g.status === "ok") return "正常";
  if (g.status === "degraded") return "降级";
  return "异常";
}

/** 管理台卡片：标题行（可选副标题说明 + 右侧操作区）+ 内容 */
export function AdminCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: ReactNode;
  /** 标题下方的一行 muted 功能说明（xs） */
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`flex flex-col gap-3 p-4 sm:p-5 ${className ?? ""}`}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <span className="font-heading text-sm leading-7 font-bold">
          {title}
        </span>
        {action}
      </div>
      {description && (
        <p className="text-muted-foreground -mt-2 text-xs">{description}</p>
      )}
      {children}
    </Card>
  );
}

export function StatCell({
  label,
  value,
  sub,
  warn = false,
}: {
  label: string;
  /** 主数值，单行 nowrap 展示，不允许中间断行 */
  value: string;
  /** 主数值下方一行 xs muted 辅助信息（如磁盘总量），替代括号拼接 */
  sub?: string;
  /** 达到阈值时高亮（如磁盘 >85%） */
  warn?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span
        className="text-xl font-bold whitespace-nowrap tabular-nums"
        style={{ color: warn ? "var(--ox-danger)" : undefined }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {sub}
        </span>
      )}
    </div>
  );
}

export function PowerCell({
  label,
  value,
}: {
  label: string;
  value?: number | null;
}) {
  const low = value != null && value < 10;
  return (
    <div className="flex flex-col gap-0.5 rounded-md border p-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span
        className="text-2xl font-bold tabular-nums"
        style={{ color: low ? "var(--ox-warn)" : "var(--ox-text-h)" }}
      >
        {value != null ? value.toFixed(2) : "—"}
        <span className="text-muted-foreground ml-1 text-sm font-normal">
          度
        </span>
      </span>
      {low && (
        <span className="text-xs" style={{ color: "var(--ox-warn)" }}>
          余量偏低，请及时充值
        </span>
      )}
    </div>
  );
}
