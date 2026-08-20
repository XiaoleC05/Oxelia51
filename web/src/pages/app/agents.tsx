"use client";

import { api } from "@/src/utils/api";
import { WorkspaceLayout } from "@/src/features/oxelia51/components/workspace/WorkspaceLayout";
import {
  formatCost,
  formatTokens,
  useCurrency,
} from "@/src/features/oxelia51/components/currency";
import { EmptyState } from "@/src/features/oxelia51/components/EmptyState";
import { QueryError } from "@/src/features/oxelia51/components/QueryError";
import Head from "next/head";

/** Agent 消耗：按用户使用的软件（Claude Code / Codex / Cursor / CC Switch …）聚合。 */

export default function AgentsPage() {
  const byAgent = api.workspace.byAgent.useQuery({ days: 30 });
  const rateQuery = api.workspace.exchangeRate.useQuery();
  const { currency } = useCurrency();
  const rate = rateQuery.data?.rateCnyPerUsd ?? 7.2;
  const cost = (usd?: number) => formatCost(usd ?? 0, currency, rate);
  const tokens = (n?: number) => formatTokens(n ?? 0);

  // 兜底过滤：空名或全零（无 token 无请求）的条目不渲染
  const agents = (byAgent.data ?? []).filter(
    (a) => a.agent.trim() !== "" && (a.tokens > 0 || a.requests > 0),
  );

  return (
    <>
      <Head>
        <title>Agent 消耗 | Oxelia51</title>
      </Head>
      <WorkspaceLayout active="/app/agents">
        <h1 className="text-xl font-bold tracking-tight text-(--ox-text-h)">
          Agent 消耗
        </h1>
        <p className="mt-1 text-sm text-(--ox-text-muted)">
          按你使用的客户端软件（Claude Code / Codex / Cursor / CC Switch
          …）聚合近 30 天 Token 用量与成本。
        </p>

        {byAgent.isError ? (
          <div className="mt-6">
            <QueryError
              message={byAgent.error?.message}
              retrying={byAgent.isFetching}
              onRetry={() => {
                void byAgent.refetch();
              }}
            />
          </div>
        ) : (
          <div className="ox-stagger mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <div
                key={a.agent}
                className="flex flex-col gap-3 rounded-lg border p-5"
                style={{ borderColor: "var(--ox-border)" }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="truncate text-sm font-bold text-(--ox-text-h)"
                    title={a.agent}
                  >
                    {a.agent}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-(--ox-text-muted)">Token</span>
                  <span className="text-(--ox-text-h) tabular-nums">
                    {tokens(a.tokens)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-(--ox-text-muted)">请求</span>
                  <span className="text-(--ox-text-h) tabular-nums">
                    {a.requests} 次
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-(--ox-text-muted)">成本</span>
                  {/* 有消耗但定价表查无 → 成本并非真 0，提示未配置定价而非显示 ¥0.00 */}
                  {a.tokens > 0 && a.costUsd === 0 && a.hasUnpriced ? (
                    <span className="text-xs text-(--ox-text-muted)">
                      未配置定价
                    </span>
                  ) : (
                    <span className="text-(--ox-text-h) tabular-nums">
                      {cost(a.costUsd)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {!byAgent.isLoading && agents.length === 0 && (
              <EmptyState
                className="col-span-full"
                description="暂无 Agent 数据。接入代理产生请求后，这里会按使用工具展示 Token 消耗。"
                action={{ href: "/docs", label: "查看接入配置" }}
              />
            )}
          </div>
        )}
      </WorkspaceLayout>
    </>
  );
}

AgentsPage.skipAppLayout = true;
