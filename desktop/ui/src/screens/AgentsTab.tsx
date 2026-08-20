import { useCallback, useEffect, useState } from "react";
import {
  fetchAgentDetail,
  fetchAgents,
  fetchSettings,
  saveSetting,
} from "../api";
import { DimTab } from "./DimTab";

/**
 * Agent 消耗：按用户使用的客户端软件聚合。可下钻看各供应商模型。
 * 显示名别名（agent_aliases）在此管理：下钻进详情页后点「✎ 重命名」即可为
 * 该 Agent（含「其他」）设置自定义显示名（#问题 4）。别名存 settings 表，
 * 后端在 /api/agents 与供应商下钻统一应用，此处负责读写。
 */
export function AgentsTab() {
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetchSettings()
      .then((s) => {
        if (!cancelled) setDisplayNames(s.agentAliases ?? {});
      })
      .catch(() => {
        // 静默：别名读不到时用原始名
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onRename = useCallback(
    async (original: string, display: string) => {
      const next = { ...displayNames };
      if (display === "" || display === original) {
        delete next[original];
      } else {
        next[original] = display;
      }
      setDisplayNames(next);
      await saveSetting("agent_aliases", JSON.stringify(next));
    },
    [displayNames],
  );

  // #问题 5：fetcher/detailFetcher 必须稳定引用。App 每 5s 轮询总览会重渲染本组件，
  // 若在此内联新函数，DimTab 的轮询 effect 依赖其身份会反复拆建 → 异常自动刷新 +
  // 下钻明细反复折叠。useCallback 保证函数身份跨渲染稳定。
  // days 由 DimTab 作为参数传入（非闭包状态），故依赖数组仍为空、引用保持稳定。
  const fetcher = useCallback(
    (days?: number) => fetchAgents(days).then((r) => r.agents),
    [],
  );
  const detailFetcher = useCallback(
    (name: string, days?: number) =>
      fetchAgentDetail(name, days).then((r) => r.rows),
    [],
  );
  return (
    <DimTab
      title="Agent 消耗"
      subtitle="按你使用的客户端软件聚合 Token 用量与成本。点击可查看该 Agent 接入的供应商与模型明细，进入后可为 Agent 重命名。"
      emptyHint="代理落账后按 agent 自动聚合。先配置模型工具指向本地代理。"
      fetcher={fetcher}
      detailFetcher={detailFetcher}
      detailLabel="供应商"
      dimLabel="Agent"
      displayNames={displayNames}
      onRename={onRename}
    />
  );
}
