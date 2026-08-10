import { useCallback, useEffect, useState } from "react";
import { fmtCost, fmtTokens, fmtDate, type DimDetailRow, type DimStat } from "../api";
import { EmptyState } from "../EmptyState";
import { DateRangePicker } from "./DateRangePicker";

/**
 * 供应商 / Agent 通用维度页：按 name 聚合 token / 请求 / 成本 / 模型数 / 最近时间。
 * provider = LLM 模型提供商（DeepSeek / Claude / OpenAI …）；agent = 用户使用的软件（Claude Code / Codex …）。
 * 顶部日期范围可切换（全部 / 近7日 / 近30日 / 近90日），下方统计联动刷新。
 * 点击条目可下钻交叉明细：Agent → 该 Agent 用到的各供应商×模型；Provider → 该供应商被哪些 Agent 使用。
 */
export function DimTab({
  title,
  subtitle,
  emptyHint,
  fetcher,
  detailFetcher,
  detailLabel,
  dimLabel,
}: {
  title: string;
  subtitle: string;
  emptyHint: string;
  fetcher: (days?: number) => Promise<DimStat[]>;
  /** 下钻明细加载器：输入条目名 + 日期范围，返回交叉明细行。 */
  detailFetcher?: (name: string, days?: number) => Promise<DimDetailRow[]>;
  /** 明细列标签：如「供应商」/「Agent」。 */
  detailLabel: string;
  /** 主维度标签：如「供应商」/「Agent」。 */
  dimLabel: string;
}) {
  const [rows, setRows] = useState<DimStat[]>([]);
  const [error, setError] = useState("");
  const [days, setDays] = useState<number | undefined>(undefined);
  const [selected, setSelected] = useState<DimStat | null>(null);
  const [detail, setDetail] = useState<DimDetailRow[] | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await fetcher(days));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, [fetcher, days]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  // 下钻明细（跟随日期范围）
  useEffect(() => {
    if (!selected || !detailFetcher) return;
    let cancelled = false;
    setDetail(null);
    void detailFetcher(selected.name, days).then((d) => {
      if (!cancelled) setDetail(d);
    });
    return () => {
      cancelled = true;
    };
  }, [selected, detailFetcher, days]);

  // 明细视图
  if (selected) {
    const onBack = () => {
      setSelected(null);
      setDetail(null);
    };
    return (
      <>
        <div className="tab-head">
          <button type="button" className="link-btn" onClick={onBack}>
            ← 返回{title}列表
          </button>
          <DateRangePicker value={days} onChange={setDays} />
        </div>
        <h1 className="page-title">
          {dimLabel} · {selected.name}
        </h1>
        <p className="page-sub">
          {selected.models} 个模型 · 最近 {fmtDate(selected.lastTs)} · 该{dimLabel}接入的{detailLabel}与模型明细：
        </p>
        {detail === null ? (
          <p className="empty">加载中…</p>
        ) : detail.length === 0 ? (
          <EmptyState compact title="暂无明细" desc="该日期范围内无按模型拆解的数据。" />
        ) : (
          <div className="card-list">
            {detail.map((d, i) => (
              <div key={`${d.dim}-${d.model}-${i}`} className="card list-row">
                <div className="list-main">
                  <span className="list-title">
                    {d.model} <span className="dim-tag">{d.dim}</span>
                  </span>
                  <span className="list-sub">
                    {detailLabel}：{d.dim} · {d.requests} 次
                  </span>
                </div>
                <div className="list-stats tabular">
                  <span>{fmtTokens(d.tokens)}</span>
                  <span>{d.requests} 次</span>
                  <span>{fmtCost(d.cost)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="tab-head">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-sub">{subtitle}</p>
        </div>
        <DateRangePicker value={days} onChange={setDays} />
      </div>
      {error && <p className="empty">加载失败：{error}</p>}
      {rows.length === 0 && !error && (
        <EmptyState compact title={`暂无${title}`} desc={emptyHint} />
      )}
      <div className="card-list">
        {rows.map((r) => (
          <button
            key={r.name}
            type="button"
            className={`card list-row ${detailFetcher ? "clickable" : ""}`}
            onClick={() => detailFetcher && setSelected(r)}
          >
            <div className="list-main">
              <span className="list-title">{r.name || "其他"}</span>
              <span className="list-sub">
                {r.models} 个模型 · 最近 {fmtDate(r.lastTs)}
              </span>
            </div>
            <div className="list-stats tabular">
              <span>{fmtTokens(r.tokens)}</span>
              <span>{r.requests} 次</span>
              <span>{fmtCost(r.cost)}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
