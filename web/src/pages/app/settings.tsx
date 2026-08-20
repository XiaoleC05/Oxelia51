"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { api } from "@/src/utils/api";
import { WorkspaceLayout } from "@/src/features/oxelia51/components/workspace/WorkspaceLayout";
import { OxCard } from "@/src/features/oxelia51/components/OxCard";
import { EmptyText } from "@/src/features/oxelia51/components/EmptyText";
import {
  formatCost,
  formatTokens,
  useCurrency,
} from "@/src/features/oxelia51/components/currency";
import { Button } from "@/src/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";
import Head from "next/head";

/** 个人工作台设置：账户信息、同步账本与同步密钥管理。 */

const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("zh-CN") : "—";

/** 同步账本：桌面端多设备同步的设备/汇总/密钥管理。数据来自 /api/sync/* 落库的 synced_events。 */
function SyncLedgerSection() {
  const utils = api.useUtils();
  const status = api.sync.status.useQuery();
  const rateQuery = api.workspace.exchangeRate.useQuery();
  const { currency } = useCurrency();
  const rate = rateQuery.data?.rateCnyPerUsd ?? 7.2;
  const revoke = api.sync.revokeToken.useMutation({
    onSuccess: () => {
      void utils.sync.status.invalidate();
      showSuccessToast({
        title: "已断开",
        description: "该设备的同步密钥已失效，需重新登录才能继续同步。",
      });
    },
  });
  const [revokeTarget, setRevokeTarget] = useState<{
    id: number;
    label: string;
  } | null>(null);

  const s = status.data;

  return (
    <div className="mt-8">
      <h2 className="text-sm font-bold text-(--ox-text-h)">同步账本</h2>
      <p className="mt-1 text-xs leading-5 text-(--ox-text-muted)">
        桌面端在「设置 →
        多设备同步」用注册邮箱+密码登录后，会自动签发同步密钥并上传账本；此处查看同步状态、管理密钥。
      </p>

      {/* 近 30 日同步汇总 */}
      {/* 移动端单列，避免数值在窄卡片里折行 */}
      <div className="ox-stagger mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <OxCard>
          <div className="text-xs text-(--ox-text-muted)">
            近 30 日同步 Token
          </div>
          <div className="mt-1 text-xl font-bold text-(--ox-text-h) tabular-nums">
            {formatTokens(s?.last30dTokens ?? 0)}
          </div>
          <div className="mt-1 text-xs text-(--ox-text-muted)">
            累计 {formatTokens(s?.totalEvents ?? 0)} 条事件
          </div>
        </OxCard>
        <OxCard>
          <div className="text-xs text-(--ox-text-muted)">近 30 日估算成本</div>
          <div className="mt-1 text-xl font-bold text-(--ox-text-h) tabular-nums">
            {formatCost(s?.last30dCostUsd ?? 0, currency, rate)}
          </div>
          <div className="mt-1 text-xs text-(--ox-text-muted)">
            按模型参考价估算，无定价的模型计 0
          </div>
        </OxCard>
      </div>

      {/* 已同步设备 */}
      <OxCard className="mt-4 p-0">
        <div
          className="border-b px-4 py-3 text-sm font-bold text-(--ox-text-h)"
          style={{ borderColor: "var(--ox-border)" }}
        >
          已同步设备
        </div>
        <div
          className="flex flex-col divide-y"
          style={{ borderColor: "var(--ox-border)" }}
        >
          {(s?.devices ?? []).map((d) => (
            <div
              key={d.deviceId}
              className="flex flex-col gap-1 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span
                className="truncate font-mono text-xs text-(--ox-text-h)"
                title={d.deviceId}
              >
                {d.deviceId}
              </span>
              <span className="shrink-0 tabular-nums sm:pl-3 sm:text-right">
                <span className="text-(--ox-text-h)">
                  {formatTokens(d.events)} 条
                </span>
                <span className="ml-2 text-xs text-(--ox-text-muted)">
                  最近同步 {fmtTime(d.lastSyncedAt)}
                </span>
              </span>
            </div>
          ))}
          {(s?.devices ?? []).length === 0 && (
            <EmptyText className="px-4">
              暂无已同步设备。在桌面端「设置 →
              多设备同步」登录同一账户即可上传账本。
            </EmptyText>
          )}
        </div>
      </OxCard>

      {/* 同步密钥管理 */}
      <OxCard className="mt-4 p-0">
        <div
          className="border-b px-4 py-3 text-sm font-bold text-(--ox-text-h)"
          style={{ borderColor: "var(--ox-border)" }}
        >
          同步密钥
        </div>
        <div
          className="flex flex-col divide-y"
          style={{ borderColor: "var(--ox-border)" }}
        >
          {(s?.tokens ?? []).map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div
                  className="truncate text-(--ox-text-h)"
                  title={t.deviceLabel || "未命名设备"}
                >
                  {t.deviceLabel || "未命名设备"}
                </div>
                <div className="mt-0.5 text-xs text-(--ox-text-muted)">
                  签发 {fmtTime(t.createdAt)} · 最近使用 {fmtTime(t.lastUsedAt)}
                </div>
              </div>
              {/* 默认尺寸 h-8（32px），保证移动端触控目标 */}
              <Button
                variant="ghost"
                className="self-end sm:self-auto"
                disabled={revoke.isPending}
                onClick={() =>
                  setRevokeTarget({
                    id: t.id,
                    label: t.deviceLabel || "未命名设备",
                  })
                }
              >
                <span className="text-xs" style={{ color: "var(--ox-danger)" }}>
                  断开
                </span>
              </Button>
            </div>
          ))}
          {(s?.tokens ?? []).length === 0 && (
            <EmptyText className="px-4">
              暂无同步密钥。桌面端登录同一账户后自动签发。
            </EmptyText>
          )}
        </div>
      </OxCard>

      {/* 断开密钥：二次确认 */}
      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        {/* 移动端留出 16px 屏幕边距并补圆角（核心组件默认 w-full 贴边、sm 以下无圆角） */}
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>断开同步密钥</AlertDialogTitle>
            <AlertDialogDescription>
              断开后，<b>{revokeTarget?.label}</b>{" "}
              上的桌面端将立即停止上传与下载账本，需重新登录才能继续同步。已同步的数据保留。确认继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={revoke.isPending}
              onClick={() => {
                if (revokeTarget) revoke.mutate({ id: revokeTarget.id });
              }}
            >
              {revoke.isPending ? "断开中…" : "确认断开"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();

  const rows: { label: string; value?: string }[] = [
    { label: "邮箱", value: session?.user?.email ?? "—" },
    { label: "名称", value: session?.user?.name ?? "—" },
    {
      label: "组织",
      value: session?.user?.organizations.map((o) => o.name).join("、") || "—",
    },
  ];

  return (
    <>
      <Head>
        <title>设置 | Oxelia51</title>
      </Head>
      <WorkspaceLayout active="/app/settings">
        <h1 className="text-xl font-bold tracking-tight text-(--ox-text-h)">
          设置
        </h1>
        <p className="mt-1 text-sm text-(--ox-text-muted)">个人工作台设置。</p>

        <div
          className="mt-6 rounded-lg border"
          style={{ borderColor: "var(--ox-border)" }}
        >
          <div
            className="flex flex-col divide-y"
            style={{ borderColor: "var(--ox-border)" }}
          >
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="text-(--ox-text-muted)">{r.label}</span>
                <span
                  className="max-w-[60%] truncate text-(--ox-text-h)"
                  title={r.value}
                >
                  {r.value}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-(--ox-text-muted)">账户</span>
              <Link
                href="/account/settings"
                className="shrink-0 text-(--ox-accent) hover:underline"
              >
                修改姓名与密码 →
              </Link>
            </div>
          </div>
        </div>

        <SyncLedgerSection />

        <div className="mt-6 flex flex-col gap-3">
          <p className="text-xs leading-5 text-(--ox-text-muted)">
            Token 消耗按「供应商消耗」与「Agent
            消耗」两个维度统计；多设备账本经桌面端登录同步后汇总到本页。
          </p>
        </div>
      </WorkspaceLayout>
    </>
  );
}

SettingsPage.skipAppLayout = true;
