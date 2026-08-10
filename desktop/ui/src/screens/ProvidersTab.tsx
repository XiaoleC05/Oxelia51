import { fetchProviderDetail, fetchProviders } from "../api";
import { DimTab } from "./DimTab";

/** 供应商消耗：按 LLM 模型提供商聚合。可下钻看各 Agent 用到的模型。 */
export function ProvidersTab() {
  return (
    <DimTab
      title="供应商消耗"
      subtitle="按提供大模型的平台聚合 Token 用量与成本。点击可查看被哪些 Agent 使用、各模型明细。"
      emptyHint="代理落账后按 provider 自动聚合。先配置模型工具指向本地代理。"
      fetcher={() => fetchProviders().then((r) => r.providers)}
      detailFetcher={(name) => fetchProviderDetail(name).then((r) => r.rows)}
      detailLabel="Agent"
      dimLabel="供应商"
    />
  );
}
