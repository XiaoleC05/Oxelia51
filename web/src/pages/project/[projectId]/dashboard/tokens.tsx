import { useRouter } from "next/router";
import Page from "@/src/components/layouts/page";
import { TokenWidget } from "@/src/features/dashboard/components/TokenWidget";
import { TokenChart } from "@/src/features/dashboard/components/TokenChart";
import { CostChart } from "@/src/features/dashboard/components/CostChart";
import { CurrencyProvider } from "@/src/features/oxelia51/components/currency";
import { ProxyAccessEmptyState } from "@/src/features/oxelia51/components/ProxyAccessEmptyState";
import { api } from "@/src/utils/api";

export default function TokensPage() {
  const router = useRouter();
  const { projectId } = router.query as { projectId: string };

  return (
    <CurrencyProvider projectId={projectId}>
      <TokensContent projectId={projectId} />
    </CurrencyProvider>
  );
}

function TokensContent({ projectId }: { projectId: string }) {
  const overview = api.oxelia51.overview.useQuery({ projectId });
  const isEmpty =
    overview.data != null &&
    !overview.data.todayTokens &&
    !overview.data.weekTokens &&
    !overview.data.monthTokens &&
    !overview.data.todayCostUsd &&
    !overview.data.monthCostUsd;

  return (
    <Page
      scrollable
      headerProps={{
        title: "Token 统计",
        help: {
          description:
            "Oxelia51 Token 用量概览：今日 / 本周 / 本月用量与花费趋势。",
        },
      }}
    >
      <div className="flex flex-col gap-4 p-4 pb-8">
        {isEmpty && <ProxyAccessEmptyState projectId={projectId} />}
        <TokenWidget projectId={projectId} />
        <TokenChart projectId={projectId} />
        <CostChart projectId={projectId} />
      </div>
    </Page>
  );
}
