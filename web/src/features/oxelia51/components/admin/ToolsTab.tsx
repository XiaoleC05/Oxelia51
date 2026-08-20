"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "@/src/utils/api";
import { Button } from "@/src/components/ui/button";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  AdminCard,
  PowerCell,
  errMsg,
  useIsSuperAdmin,
  type PowerRecord,
} from "@/src/features/oxelia51/components/admin/shared";

/** 工具：DormGuard 宿舍电费 + 手动拉取（拉取仅超级管理员可见） */
export function ToolsTab() {
  const isSuperAdmin = useIsSuperAdmin();
  const powerQ = api.oxelia51Admin.dormPower.useQuery();
  const power = powerQ.data as PowerRecord | undefined;

  const [powerMsg, setPowerMsg] = useState("");
  const [powerMsgOk, setPowerMsgOk] = useState(false);
  const refreshPowerMut = api.oxelia51Admin.dormPowerRefresh.useMutation({
    onSuccess: async (data) => {
      const ok =
        typeof data === "object" && data !== null && "success" in data
          ? Boolean((data as { success: unknown }).success)
          : false;
      setPowerMsgOk(ok);
      setPowerMsg(
        ok
          ? "抓取完成，数据已更新"
          : "抓取失败或无启用的规则，显示的是上一次数据",
      );
      // 给爬虫落库一点时间再刷新
      await new Promise((r) => setTimeout(r, 1500));
      void powerQ.refetch();
    },
    onError: (e) => {
      setPowerMsgOk(false);
      setPowerMsg(`抓取请求失败：${e.message}`);
    },
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AdminCard
        title="宿舍电费（DormGuard）"
        description="由 DormGuard 定时抓取，余量低于 10 度时高亮提醒"
        action={
          isSuperAdmin ? (
            <Button
              variant="outline"
              size="sm"
              disabled={refreshPowerMut.isPending}
              onClick={() => {
                setPowerMsg("");
                refreshPowerMut.mutate();
              }}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshPowerMut.isPending ? "animate-spin" : ""}`}
              />
              {refreshPowerMut.isPending ? "拉取中…" : "拉取"}
            </Button>
          ) : undefined
        }
      >
        {powerMsg && (
          <p
            className="text-sm"
            style={{ color: powerMsgOk ? "var(--ox-ok)" : "var(--ox-warn)" }}
          >
            {powerMsg}
          </p>
        )}
        {powerQ.error ? (
          <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
            {errMsg(powerQ.error)}
          </p>
        ) : powerQ.isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <PowerCell label="空调余量" value={power?.kbalance} />
            <PowerCell label="照明余量" value={power?.zbalance} />
          </div>
        )}
        {power?.record_time && (
          <p className="text-muted-foreground text-xs">
            数据时间：{new Date(power.record_time).toLocaleString("zh-CN")}
          </p>
        )}
      </AdminCard>
    </div>
  );
}
