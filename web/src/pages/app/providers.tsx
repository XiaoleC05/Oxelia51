"use client";

import { api } from "@/src/utils/api";
import { WorkspaceLayout } from "@/src/features/oxelia51/components/workspace/WorkspaceLayout";
import {
  formatCost,
  formatTokens,
  useCurrency,
} from "@/src/features/oxelia51/components/currency";
import { providerDisplayName } from "@/src/features/oxelia51/providerDisplay";
import { EmptyState } from "@/src/features/oxelia51/components/EmptyState";
import { QueryError } from "@/src/features/oxelia51/components/QueryError";
import Head from "next/head";

/** 供应商消耗：按提供大模型的平台（Claude / DeepSeek / OpenAI / 智谱 …）聚合。 */

export default function ProvidersPage() {
  const byProvider = api.workspace.byProvider.useQuery({ days: 30 });
  const rateQuery = api.workspace.exchangeRate.useQuery();
  const { currency } = useCurrency();
  const rate = rateQuery.data?.rateCnyPerUsd ?? 7.2;
  const cost = (usd?: number) => formatCost(usd ?? 0, currency, rate);
  const tokens = (n?: number) => formatTokens(n ?? 0);

  // 兜底过滤：空名或全零（无 token 无请求）的条目不渲染
  const providers = (byProvider.data ?? []).filter(
    (p) => p.provider.trim() !== "" && (p.tokens > 0 || p.requests > 0),
  );

  return (
    <>
      <Head>
        <title>供应商消耗 | Oxelia51</title>
      </Head>
      <WorkspaceLayout active="/app/providers">
        <h1 className="text-xl font-bold tracking-tight text-(--ox-text-h)">
          供应商消耗
        </h1>
        <p className="mt-1 text-sm text-(--ox-text-muted)">
          按提供大模型的平台（Claude / DeepSeek / OpenAI / 智谱 …）聚合近 30 天
          Token 用量与成本。
        </p>

        {byProvider.isError ? (
          <div className="mt-6">
            <QueryError
              message={byProvider.error?.message}
              retrying={byProvider.isFetching}
              onRetry={() => {
                void byProvider.refetch();
              }}
            />
          </div>
        ) : (
          <div className="ox-stagger mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {providers.map((p) => (
              <div
                key={p.provider}
                className="flex flex-col gap-3 rounded-lg border p-5"
                style={{ borderColor: "var(--ox-border)" }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="truncate text-sm font-bold text-(--ox-text-h)"
                    title={providerDisplayName(p.provider)}
                  >
                    {providerDisplayName(p.provider)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-(--ox-text-muted)">Token</span>
                  <span className="text-(--ox-text-h) tabular-nums">
                    {tokens(p.tokens)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-(--ox-text-muted)">请求</span>
                  <span className="text-(--ox-text-h) tabular-nums">
                    {p.requests} 次
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-(--ox-text-muted)">成本</span>
                  {/* 有消耗但定价表查无 → 成本并非真 0，提示未配置定价而非显示 ¥0.00 */}
                  {p.tokens > 0 && p.costUsd === 0 && p.hasUnpriced ? (
                    <span className="text-xs text-(--ox-text-muted)">
                      未配置定价
                    </span>
                  ) : (
                    <span className="text-(--ox-text-h) tabular-nums">
                      {cost(p.costUsd)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {!byProvider.isLoading && providers.length === 0 && (
              <EmptyState
                className="col-span-full"
                description="暂无供应商数据。接入代理产生请求后，这里会按提供大模型的平台展示 Token 消耗。"
                action={{ href: "/docs", label: "查看接入配置" }}
              />
            )}
          </div>
        )}
      </WorkspaceLayout>
    </>
  );
}

ProvidersPage.skipAppLayout = true;
