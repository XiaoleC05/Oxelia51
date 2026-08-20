"use client";

import { useEffect, useState } from "react";
import { api } from "@/src/utils/api";
import Header from "@/src/components/layouts/header";
import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";
import { showErrorToast } from "@/src/features/notifications/showErrorToast";

const checkboxClassName = "h-4 w-4 accent-[var(--ox-accent)]";

const ALERT_TYPE_LABEL: Record<string, string> = {
  budget: "预算",
  anomaly: "异常",
};
const SEVERITY_LABEL: Record<string, string> = {
  warning: "警告",
  critical: "严重",
  info: "提示",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "待发送",
  sent: "已发送",
  acknowledged: "已确认",
};

/** Oxelia51 告警设置：预算告警、异常检测、通知通道与告警历史。 */
export function AlertsSettings({ projectId }: { projectId: string }) {
  const utils = api.useUtils();
  const config = api.oxelia51.getAlertConfig.useQuery({ projectId });
  const channels = api.oxelia51.getAlertChannels.useQuery({ projectId });
  const logs = api.oxelia51.alertLogs.useQuery({ projectId, limit: 50 });

  const [budgetUsd, setBudgetUsd] = useState("");
  const [thresholdPct, setThresholdPct] = useState("80");
  const [budgetEnabled, setBudgetEnabled] = useState(false);
  const [anomalyMultiplier, setAnomalyMultiplier] = useState("3");
  const [anomalyEnabled, setAnomalyEnabled] = useState(false);

  useEffect(() => {
    if (!config.data) return;
    setBudgetUsd(
      config.data.hasBudgetConfig ? String(config.data.budgetUsd) : "",
    );
    setThresholdPct(String(Math.round(config.data.threshold * 100)));
    setBudgetEnabled(config.data.budgetEnabled);
    setAnomalyMultiplier(String(config.data.anomalyMultiplier));
    setAnomalyEnabled(config.data.anomalyEnabled);
  }, [config.data]);

  const saveConfig = api.oxelia51.saveAlertConfig.useMutation({
    onSuccess: () => {
      showSuccessToast({ title: "已保存", description: "告警配置已更新。" });
      void utils.oxelia51.getAlertConfig.invalidate({ projectId });
    },
    onError: (error) => showErrorToast("保存失败", error.message),
  });

  const emailChannel = channels.data?.find((c) => c.type === "email");
  const [email, setEmail] = useState("");
  const [webhook, setWebhook] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  useEffect(() => {
    if (!channels.data) return;
    setEmail(channels.data.find((c) => c.type === "email")?.address ?? "");
    setWebhook(channels.data.find((c) => c.type === "webhook")?.address ?? "");
  }, [channels.data]);

  const saveChannels = api.oxelia51.saveAlertChannels.useMutation({
    onSuccess: (data) => {
      showSuccessToast({
        title: "已保存",
        description: data.emailVerificationSent
          ? "通知通道已更新，验证邮件已发送，请输入邮件中的 6 位验证码完成验证。"
          : "通知通道已更新。",
      });
      void utils.oxelia51.getAlertChannels.invalidate({ projectId });
    },
    onError: (error) => showErrorToast("保存失败", error.message),
  });

  const verifyChannel = api.oxelia51.verifyAlertChannel.useMutation({
    onSuccess: () => {
      showSuccessToast({
        title: "验证成功",
        description: "邮件通道已启用，告警将投递到该邮箱。",
      });
      setVerificationCode("");
      void utils.oxelia51.getAlertChannels.invalidate({ projectId });
    },
    onError: (error) => showErrorToast("验证失败", error.message),
  });

  const resendVerification =
    api.oxelia51.resendAlertChannelVerification.useMutation({
      onSuccess: () => {
        showSuccessToast({
          title: "已重发",
          description: "验证码已重新发送，请查收邮件（10 分钟内有效）。",
        });
      },
      onError: (error) => showErrorToast("重发失败", error.message),
    });

  const onSaveConfig = () => {
    const budget = Number(budgetUsd);
    const threshold = Number(thresholdPct) / 100;
    const multiplier = Number(anomalyMultiplier);
    if (budgetEnabled && (!Number.isFinite(budget) || budget <= 0)) {
      showErrorToast("无法保存", "请输入有效的月预算金额。");
      return;
    }
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
      showErrorToast("无法保存", "阈值需在 1-100% 之间。");
      return;
    }
    saveConfig.mutate({
      projectId,
      budgetUsd: Number.isFinite(budget) ? budget : 0,
      threshold,
      budgetEnabled,
      anomalyMultiplier: Number.isFinite(multiplier) ? multiplier : 3,
      anomalyEnabled,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 配置/通道加载失败：显式错误 + 重试，不静默 */}
      {(config.isError || channels.isError) && (
        <Card className="flex flex-col items-start gap-2 p-4">
          <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
            加载失败：{config.error?.message ?? channels.error?.message}
          </p>
          <Button
            size="sm"
            variant="outline"
            loading={config.isFetching || channels.isFetching}
            onClick={() => {
              void config.refetch();
              void channels.refetch();
            }}
          >
            重试
          </Button>
        </Card>
      )}
      <div>
        <Header title="预算告警" />
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-muted-foreground text-sm">月预算:</label>
            <Input
              type="number"
              min={0}
              value={budgetUsd}
              onChange={(e) => setBudgetUsd(e.target.value)}
              placeholder="例如 100"
              className="w-32"
            />
            <span className="text-muted-foreground text-sm">USD</span>
            <label className="text-muted-foreground ml-4 text-sm">阈值:</label>
            <Input
              type="number"
              min={1}
              max={100}
              value={thresholdPct}
              onChange={(e) => setThresholdPct(e.target.value)}
              className="w-20"
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className={checkboxClassName}
              checked={budgetEnabled}
              onChange={(e) => setBudgetEnabled(e.target.checked)}
            />
            启用
          </label>
        </Card>
      </div>

      <div>
        <Header title="异常检测" />
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-muted-foreground text-sm">同比飙升:</label>
            <Input
              type="number"
              min={1}
              value={anomalyMultiplier}
              onChange={(e) => setAnomalyMultiplier(e.target.value)}
              className="w-20"
            />
            <span className="text-muted-foreground text-sm">倍 触发告警</span>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className={checkboxClassName}
              checked={anomalyEnabled}
              onChange={(e) => setAnomalyEnabled(e.target.checked)}
            />
            启用
          </label>
        </Card>
        <div className="mt-3 flex justify-end">
          <Button
            onClick={onSaveConfig}
            disabled={saveConfig.isPending || config.isLoading}
          >
            {saveConfig.isPending ? "保存中…" : "保存告警配置"}
          </Button>
        </div>
      </div>

      <div>
        <Header title="通知通道" />
        <Card className="flex flex-col gap-3 p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className={checkboxClassName}
              checked
              disabled
            />
            站内通知
            <span className="text-muted-foreground text-xs">
              （始终开启，告警写入本平台历史记录）
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="checkbox"
              className={checkboxClassName}
              checked={email !== ""}
              onChange={(e) => {
                if (!e.target.checked) setEmail("");
              }}
            />
            <span>邮件</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-64"
            />
            {emailChannel && (
              <span
                className="text-xs"
                style={{
                  color: emailChannel.verified
                    ? "var(--ox-ok)"
                    : "var(--ox-warn)",
                }}
              >
                {emailChannel.verified ? "已验证" : "待验证"}
              </span>
            )}
          </div>
          {emailChannel && !emailChannel.verified && (
            <div className="ml-6 flex flex-wrap items-center gap-2 text-sm">
              <Input
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="6 位验证码"
                className="w-32"
                maxLength={6}
                inputMode="numeric"
              />
              <Button
                size="sm"
                onClick={() =>
                  verifyChannel.mutate({
                    projectId,
                    code: verificationCode.trim(),
                  })
                }
                disabled={
                  verifyChannel.isPending ||
                  verificationCode.trim().length !== 6
                }
              >
                {verifyChannel.isPending ? "验证中…" : "验证"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resendVerification.mutate({ projectId })}
                disabled={resendVerification.isPending}
              >
                {resendVerification.isPending ? "发送中…" : "重发验证码"}
              </Button>
              <span className="text-muted-foreground text-xs">
                验证邮件已发送至 {emailChannel.address}，10 分钟内有效
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="checkbox"
              className={checkboxClassName}
              checked={webhook !== ""}
              onChange={(e) => {
                if (!e.target.checked) setWebhook("");
              }}
            />
            <span>Webhook</span>
            <Input
              type="url"
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder="https://example.com/hook"
              className="w-96"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => saveChannels.mutate({ projectId, email, webhook })}
              disabled={saveChannels.isPending || channels.isLoading}
            >
              {saveChannels.isPending ? "保存中…" : "保存通知通道"}
            </Button>
          </div>
        </Card>
      </div>

      <div>
        <Header title="告警历史" />
        <Card className="p-4">
          {logs.isError ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
                加载失败：{logs.error?.message}
              </p>
              <Button
                size="sm"
                variant="outline"
                loading={logs.isFetching}
                onClick={() => {
                  void logs.refetch();
                }}
              >
                重试
              </Button>
            </div>
          ) : logs.isLoading ? (
            <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
              加载中…
            </div>
          ) : (logs.data?.length ?? 0) === 0 ? (
            <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
              暂无告警记录
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>严重度</TableHead>
                  <TableHead>消息</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {new Date(log.createdAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      {ALERT_TYPE_LABEL[log.alertType] ?? log.alertType}
                    </TableCell>
                    <TableCell>
                      <span
                        style={{
                          color:
                            log.severity === "critical"
                              ? "var(--ox-danger)"
                              : log.severity === "warning"
                                ? "var(--ox-warn)"
                                : "var(--ox-text-muted)",
                        }}
                      >
                        {SEVERITY_LABEL[log.severity] ?? log.severity}
                      </span>
                    </TableCell>
                    <TableCell
                      className="max-w-md truncate"
                      title={log.message}
                    >
                      {log.message}
                    </TableCell>
                    <TableCell>
                      {STATUS_LABEL[log.status] ?? log.status}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
