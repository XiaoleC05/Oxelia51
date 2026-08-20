import { useCallback } from "react";
import { fetchProviderDetail, fetchProviders } from "../api";
import { DimTab } from "./DimTab";

/** 供应商消耗：按 LLM 模型提供商聚合。可下钻看各 Agent 用到的模型。 */
export function ProvidersTab() {
  // #问题 5：fetcher/detailFetcher 必须稳定引用（App 5s 总览轮询会重渲染本组件），
  // 否则 DimTab 轮询 effect 反复拆建 → 异常刷新 + 下钻折叠闪烁。
  // days 由 DimTab 作为参数传入（非闭包状态），故依赖数组仍为空、引用保持稳定。
  const fetcher = useCallback(
    (days?: number) => fetchProviders(days).then((r) => r.providers),
    [],
  );
  const detailFetcher = useCallback(
    (name: string, days?: number) =>
      fetchProviderDetail(name, days).then((r) => r.rows),
    [],
  );
  return (
    <DimTab
      title="供应商消耗"
      subtitle="按提供大模型的平台聚合 Token 用量与成本。点击可查看被哪些 Agent 使用、各模型明细。"
      emptyHint="代理落账后按 provider 自动聚合。先配置模型工具指向本地代理。"
      fetcher={fetcher}
      detailFetcher={detailFetcher}
      detailLabel="Agent"
      dimLabel="供应商"
    />
  );
}
