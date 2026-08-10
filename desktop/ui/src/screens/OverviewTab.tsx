import { useCallback, useEffect, useState } from "react";
import { fetchAgents, fetchProviders, fmtCost, fmtTokens, type DimStat, type ModelStat, type Overview, type TrendPoint } from "../api";
import { EmptyState } from "../EmptyState";
import { Dropdown } from "../components/Dropdown";
import { DateRangePicker } from "./DateRangePicker";
import { copyText, PROVIDER_COMMANDS, PROVIDER_GROUPS, providerCmd, proxyUrl } from "../clipboard";

function StatCard({ label, tokens, requests, cost }: { label: string; tokens: number; requests: number; cost: number }) {
  return (
    <div className="card stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value tabular">{fmtTokens(tokens)}</span>
      <span className="stat-sub tabular">请求 {requests} · {fmtCost(cost)}</span>
    </div>
  );
}

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  const max = Math.max(1, ...trend.map((t) => t.tokens));
  return (
    <div className="card">
      <h2 className="card-title">近 14 天用量趋势</h2>
      {trend.length === 0 ? (
        <EmptyState compact title="趋势待有数据后展示" desc="代理落账后按天自动聚合。" />
      ) : (
        <div className="trend">
          {trend.map((t) => (
            <div key={t.date} className="trend-col" title={`${t.date} · ${fmtTokens(t.tokens)}`}>
              <div className="trend-bar" style={{ height: `${Math.max(3, (t.tokens / max) * 100)}%` }} />
              <span className="trend-label">{t.date.slice(5)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Ranking({ title, rows }: { title: string; rows: { name: string; tokens: number; requests: number; cost: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.tokens));
  return (
    <div className="card">
      <h2 className="card-title">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState compact title="暂无排行数据" desc="落账后按维度自动聚合。" />
      ) : (
        <div className="rank">
          {rows.slice(0, 8).map((r, i) => (
            <div key={r.name} className="rank-row">
              <span className={`rank-index ${i < 3 ? `top top-${i + 1}` : ""}`}>{i + 1}</span>
              <span className="rank-name">{r.name}</span>
              <div className="rank-track">
                <div className={`rank-fill ${i < 3 ? `fill-top fill-top-${i + 1}` : ""}`} style={{ width: `${Math.max(2, (r.tokens / max) * 100)}%` }} />
              </div>
              <span className="rank-val tabular">
                {fmtTokens(r.tokens)} · {fmtCost(r.cost)}
              </span>
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
  const sel = PROVIDER_COMMANDS.find((p) => p.slug === slug) ?? PROVIDER_COMMANDS[0];

  const copy = async (kind: "url" | "cmd") => {
    const text = kind === "url" ? proxyUrl(sel.slug) : providerCmd(sel.slug, sel.anthropic);
    if (await copyText(text)) {
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  return (
    <div className="empty-state">
      <svg className="empty-icon" viewBox="0 0 512 512" aria-hidden="true">
        <circle cx="228" cy="228" r="140" fill="none" stroke="currentColor" strokeWidth="52" />
        <circle cx="412" cy="412" r="34" fill="#E5484D" />
      </svg>
      <p className="empty-title">还没有 Token 记录</p>
      <p className="empty-desc">
        选择你使用的 LLM 供应商，把模型工具的 Base URL 指向本地代理即可开始记账。
      </p>
      <div className="setup-card">
        <div className="form-row">
          <Dropdown
            grow
            groups={PROVIDER_GROUPS.map((g) => ({
              group: g.group,
              options: g.providers.map((p) => ({ value: p.slug, label: p.label })),
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

export function OverviewTab({ data, online }: { data: Overview | null; online: boolean }) {
  const [days, setDays] = useState<number | undefined>(undefined);
  const [byProvider, setByProvider] = useState<DimStat[]>([]);
  const [byAgent, setByAgent] = useState<DimStat[]>([]);

  // 日期范围变化时刷新供应商/Agent 排行（联动下方统计）
  const loadDims = useCallback(async () => {
    try {
      const [pv, ag] = await Promise.all([fetchProviders(days), fetchAgents(days)]);
      setByProvider(pv.providers);
      setByAgent(ag.agents);
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
          sidecar 未运行。请先把模型工具的 Base URL 指向本地代理（见设置页），再启动代理。
        </div>
      )}
      {/* 页头：标题 + 日期范围在页面顶部，统计区随之联动 */}
      <div className="tab-head">
        <div>
          <h1 className="page-title">总览</h1>
          <p className="page-sub">按供应商 / Agent / 模型聚合的 Token 用量与成本，日期范围联动下方统计。</p>
        </div>
        <DateRangePicker value={days} onChange={setDays} />
      </div>
      <section className="stats">
        <StatCard label="今日" tokens={data?.today.tokens ?? 0} requests={data?.today.requests ?? 0} cost={data?.today.cost ?? 0} />
        <StatCard label="近 7 日" tokens={data?.week.tokens ?? 0} requests={data?.week.requests ?? 0} cost={data?.week.cost ?? 0} />
        <StatCard label="近 30 日" tokens={data?.month.tokens ?? 0} requests={data?.month.requests ?? 0} cost={data?.month.cost ?? 0} />
        <StatCard label="累计" tokens={data?.total.tokens ?? 0} requests={data?.total.requests ?? 0} cost={data?.total.cost ?? 0} />
      </section>
      <TrendChart trend={data?.trend ?? []} />
      <section className="grid-2">
        <Ranking
          title="按供应商"
          rows={byProvider.map((d: DimStat) => ({ name: d.name, tokens: d.tokens, requests: d.requests, cost: d.cost }))}
        />
        <Ranking
          title="按 Agent"
          rows={byAgent.map((d: DimStat) => ({ name: d.name, tokens: d.tokens, requests: d.requests, cost: d.cost }))}
        />
      </section>
      <section className="grid-2">
        <Ranking
          title="按模型"
          rows={(data?.byModel ?? []).map((m: ModelStat) => ({ name: m.model, tokens: m.tokens, requests: m.requests, cost: m.cost }))}
        />
      </section>
    </>
  );
}
