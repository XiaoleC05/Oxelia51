import { useCallback, useEffect, useState } from "react";
import {
  CNY_PER_USD,
  fetchAgents,
  fetchModels,
  fetchPricingRate,
  fetchProviders,
  fmtCost,
  fmtCostByCurrency,
  fmtTokens,
  type Currency,
  type DimStat,
  type Overview,
  type TrendPoint,
} from "../api";
import { EmptyState } from "../EmptyState";
import { Dropdown } from "../components/Dropdown";
import { DateRangePicker } from "./DateRangePicker";
import {
  copyText,
  PROVIDER_COMMANDS,
  PROVIDER_GROUPS,
  providerCmd,
  proxyUrl,
} from "../clipboard";

/** 排行显示模式：#总览——全部（token+成本）/ 仅 Token / 仅成本（美元·人民币切换）。 */
type RankMode = "all" | "tokens" | "cost";

function StatCard({
  label,
  tokens,
  requests,
  cost,
  rate,
}: {
  label: string;
  tokens: number;
  requests: number;
  cost: number;
  rate: number;
}) {
  return (
    <div className="card stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value tabular">{fmtTokens(tokens)}</span>
      <span className="stat-sub tabular">
        请求 {requests} · {fmtCost(cost, rate)}
      </span>
    </div>
  );
}

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  const max = Math.max(1, ...trend.map((t) => t.tokens));
  return (
    <div className="card">
      <h2 className="card-title">近 14 天用量趋势</h2>
      {trend.length === 0 ? (
        <EmptyState
          compact
          title="趋势待有数据后展示"
          desc="代理落账后按天自动聚合。"
        />
      ) : (
        <div className="trend">
          {trend.map((t) => (
            <div
              key={t.date}
              className="trend-col"
              title={`${t.date} · ${fmtTokens(t.tokens)}`}
            >
              <div
                className="trend-bar"
                style={{ height: `${Math.max(3, (t.tokens / max) * 100)}%` }}
              />
              <span className="trend-label">{t.date.slice(5)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Ranking({
  title,
  rows,
  mode,
  currency,
  rate,
}: {
  title: string;
  rows: { name: string; tokens: number; requests: number; cost: number }[];
  mode: RankMode;
  currency: Currency;
  rate: number;
}) {
  // 排行只展示有实际用量的条目：/api/providers 会为未用过的内置供应商补零值条目
  //（供设置页「已接入」核验用），这些不该出现在用量排行里（#0 token 排行问题）。
  const used = rows.filter((r) => r.tokens > 0);
  const max = Math.max(1, ...used.map((r) => r.tokens));
  const fmtVal = (r: { tokens: number; cost: number }) => {
    if (mode === "tokens") return fmtTokens(r.tokens);
    if (mode === "cost") return fmtCostByCurrency(r.cost, currency, rate);
    return `${fmtTokens(r.tokens)} · ${fmtCost(r.cost, rate)}`;
  };
  return (
    <div className="card">
      <h2 className="card-title">{title}</h2>
      {used.length === 0 ? (
        <EmptyState
          compact
          title="暂无排行数据"
          desc="落账后按维度自动聚合。"
        />
      ) : (
        <div className="rank">
          {used.slice(0, 8).map((r, i) => (
            <div key={r.name} className="rank-row">
              <span className={`rank-index ${i < 3 ? `top top-${i + 1}` : ""}`}>
                {i + 1}
              </span>
              <span className="rank-name">{r.name}</span>
              <div className="rank-track">
                <div
                  className={`rank-fill ${i < 3 ? `fill-top fill-top-${i + 1}` : ""}`}
                  style={{ width: `${Math.max(2, (r.tokens / max) * 100)}%` }}
                />
              </div>
              <span className="rank-val tabular">{fmtVal(r)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 首次接入空态：先选 LLM 供应商 → 复制对应代理地址。 */
function SetupEmptyState({ online }: { online: boolean }) {
  const [slug, setSlug] = useState(PROVIDER_COMMANDS[0].slug);
  const [copied, setCopied] = useState<"url" | "cmd" | null>(null);
  const sel =
    PROVIDER_COMMANDS.find((p) => p.slug === slug) ?? PROVIDER_COMMANDS[0];

  const copy = async (kind: "url" | "cmd") => {
    const text =
      kind === "url"
        ? proxyUrl(sel.slug)
        : providerCmd(sel.slug, sel.anthropic);
    if (await copyText(text)) {
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  return (
    <div className="empty-state">
      <svg className="empty-icon" viewBox="0 0 512 512" aria-hidden="true">
        <circle
          cx="228"
          cy="228"
          r="140"
          fill="none"
          stroke="currentColor"
          strokeWidth="52"
        />
        <circle cx="412" cy="412" r="34" fill="#E5484D" />
      </svg>
      <p className="empty-title">还没有 Token 记录</p>
      <p className="empty-desc">
        选择你使用的 LLM 供应商，把模型工具的 Base URL
        指向本地代理即可开始记账。
      </p>
      <div className="setup-card">
        <div className="form-row">
          <Dropdown
            grow
            groups={PROVIDER_GROUPS.map((g) => ({
              group: g.group,
              options: g.providers.map((p) => ({
                value: p.slug,
                label: p.label,
              })),
            }))}
            value={slug}
            onChange={setSlug}
            ariaLabel="LLM 供应商"
          />
        </div>
        {/* 代理地址：自定义 Base URL 的界面直接填这个 */}
        <div className="setup-cmd-row">
          <pre className="setup-cmd">
            <code>{proxyUrl(sel.slug)}</code>
          </pre>
          <button
            type="button"
            className="btn"
            onClick={() => void copy("url")}
            title="适用于在工具的自定义 Base URL 输入框直接填写"
          >
            {copied === "url" ? "已复制 ✓" : "复制地址"}
          </button>
        </div>
        {/* export 命令：支持环境变量的工具用这个 */}
        <div className="setup-cmd-row">
          <pre className="setup-cmd">
            <code>{providerCmd(sel.slug, sel.anthropic)}</code>
          </pre>
          <button
            type="button"
            className="btn"
            onClick={() => void copy("cmd")}
            title="适用于通过 export 环境变量配置的工具"
          >
            {copied === "cmd" ? "已复制 ✓" : "复制命令"}
          </button>
        </div>
        <p className="empty">
          {sel.anthropic
            ? "适用于使用 Anthropic 协议的工具。"
            : "适用于使用 OpenAI 兼容协议的工具。"}
          {!online && "（当前代理未运行，配置完成后请先启动）"}
        </p>
      </div>
    </div>
  );
}

export function OverviewTab({
  data,
  online,
}: {
  data: Overview | null;
  online: boolean;
}) {
  const [days, setDays] = useState<number | undefined>(undefined);
  const [mode, setMode] = useState<RankMode>("all");
  const [currency, setCurrency] = useState<Currency>("usd");
  const [byProvider, setByProvider] = useState<DimStat[]>([]);
  const [byAgent, setByAgent] = useState<DimStat[]>([]);
  const [byModel, setByModel] = useState<DimStat[]>([]);
  // USD→CNY 汇率：与价格表同源（/api/pricing/rate 实时值），加载失败回退兜底参考值 7.2
  const [rate, setRate] = useState<number>(CNY_PER_USD);

  useEffect(() => {
    fetchPricingRate()
      .then((r) => {
        if (Number.isFinite(r.usd_to_cny) && r.usd_to_cny > 0)
          setRate(r.usd_to_cny);
      })
      .catch(() => {
        // 静默：回退兜底参考值，排行仍可读
      });
  }, []);

  // 日期范围变化时刷新供应商 / Agent / 模型排行（联动下方统计，三个卡片同一日期口径）
  const loadDims = useCallback(async () => {
    try {
      const [pv, ag, md] = await Promise.all([
        fetchProviders(days),
        fetchAgents(days),
        fetchModels(days),
      ]);
      setByProvider(pv.providers);
      setByAgent(ag.agents);
      setByModel(md.models);
    } catch {
      // 静默：排行区保持上一帧
    }
  }, [days]);

  useEffect(() => {
    void loadDims();
  }, [loadDims]);

  // 全新安装零数据：整屏引导空态，不展示空卡片/占位
  const isEmpty = online && data != null && data.total.tokens === 0;

  if (isEmpty) {
    return <SetupEmptyState online={online} />;
  }

  return (
    <>
      {!online && (
        <div className="offline-banner">
          sidecar 未运行。请先把模型工具的 Base URL
          指向本地代理（见设置页），再启动代理。
        </div>
      )}
      {/* 页头：仅标题；日期选择器移到趋势图下方（联动其下三个排行卡片） */}
      <div className="tab-head">
        <div>
          <h1 className="page-title">总览</h1>
          <p className="page-sub">
            按供应商 / Agent / 模型聚合的 Token
            用量与成本，日期范围联动下方统计。
          </p>
        </div>
      </div>
      <section className="stats">
        <StatCard
          label="今日"
          tokens={data?.today.tokens ?? 0}
          requests={data?.today.requests ?? 0}
          cost={data?.today.cost ?? 0}
          rate={rate}
        />
        <StatCard
          label="近 7 日"
          tokens={data?.week.tokens ?? 0}
          requests={data?.week.requests ?? 0}
          cost={data?.week.cost ?? 0}
          rate={rate}
        />
        <StatCard
          label="近 30 日"
          tokens={data?.month.tokens ?? 0}
          requests={data?.month.requests ?? 0}
          cost={data?.month.cost ?? 0}
          rate={rate}
        />
        <StatCard
          label="累计"
          tokens={data?.total.tokens ?? 0}
          requests={data?.total.requests ?? 0}
          cost={data?.total.cost ?? 0}
          rate={rate}
        />
      </section>
      <TrendChart trend={data?.trend ?? []} />
      {/* 日期范围选择 + 显示模式：同一行，位于趋势图下方，共同控制其下三个排行卡片 */}
      <div className="tab-head range-under-trend">
        <DateRangePicker value={days} onChange={setDays} />
        <div className="rank-mode" role="group" aria-label="排行显示模式">
          <button
            type="button"
            className={`range-chip ${mode === "all" ? "active" : ""}`}
            onClick={() => setMode("all")}
          >
            全部
          </button>
          <button
            type="button"
            className={`range-chip ${mode === "tokens" ? "active" : ""}`}
            onClick={() => setMode("tokens")}
          >
            Token
          </button>
          <button
            type="button"
            className={`range-chip ${mode === "cost" ? "active" : ""}`}
            onClick={() => {
              // 点击成本模式：首次进入默认美元，再点切换币种
              if (mode === "cost") {
                setCurrency((c) => (c === "usd" ? "cny" : "usd"));
              } else {
                setMode("cost");
              }
            }}
            title={
              mode === "cost"
                ? `切换币种（当前 ${currency === "usd" ? "美元" : "人民币"}）`
                : "仅显示成本"
            }
          >
            {mode === "cost"
              ? currency === "usd"
                ? "$ 美元"
                : "¥ 人民币"
              : "成本"}
          </button>
        </div>
      </div>
      <section className="grid-2">
        <Ranking
          title="按供应商"
          rows={byProvider.map((d: DimStat) => ({
            name: d.name,
            tokens: d.tokens,
            requests: d.requests,
            cost: d.cost,
          }))}
          mode={mode}
          currency={currency}
          rate={rate}
        />
        <Ranking
          title="按 Agent"
          rows={byAgent.map((d: DimStat) => ({
            name: d.name,
            tokens: d.tokens,
            requests: d.requests,
            cost: d.cost,
          }))}
          mode={mode}
          currency={currency}
          rate={rate}
        />
      </section>
      <section>
        <Ranking
          title="按模型"
          rows={byModel.map((d: DimStat) => ({
            name: d.name,
            tokens: d.tokens,
            requests: d.requests,
            cost: d.cost,
          }))}
          mode={mode}
          currency={currency}
          rate={rate}
        />
      </section>
    </>
  );
}
