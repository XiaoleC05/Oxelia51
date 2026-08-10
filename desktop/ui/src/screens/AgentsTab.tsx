import { fetchAgentDetail, fetchAgents } from "../api";
import { DimTab } from "./DimTab";

/** Agent 消耗：按用户使用的客户端软件聚合。可下钻看各供应商模型。 */
export function AgentsTab() {
  return (
    <DimTab
      title="Agent 消耗"
      subtitle="按你使用的客户端软件聚合 Token 用量与成本。点击可查看该 Agent 接入的供应商与模型明细。"
      emptyHint="代理落账后按 agent 自动聚合。先配置模型工具指向本地代理。"
      fetcher={() => fetchAgents().then((r) => r.agents)}
      detailFetcher={(name) => fetchAgentDetail(name).then((r) => r.rows)}
      detailLabel="供应商"
      dimLabel="Agent"
    />
  );
}
