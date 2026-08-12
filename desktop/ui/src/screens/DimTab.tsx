import { memo, useCallback, useEffect, useState } from "react";
import { fmtCost, fmtTokens, fmtDate, type DimDetailRow, type DimStat } from "../api";
import { EmptyState } from "../EmptyState";
import { DateRangePicker } from "./DateRangePicker";

/**
 * 供应商 / Agent 通用维度页：按 name 聚合 token / 请求 / 成本 / 模型数 / 最近时间。
 * provider = LLM 模型提供商（DeepSeek / Claude / OpenAI …）；agent = 用户使用的软件（Claude Code / Codex …）。
 * 顶部日期范围可切换（全部 / 近7日 / 近30日 / 近90日），下方统计联动刷新。
 * 点击条目可下钻交叉明细：Agent → 该 Agent 用到的各供应商×模型；Provider → 该供应商被哪些 Agent 使用。
 *
 * #问题 5：组件用 memo 包裹——父级（App）每 5s 轮询总览会重渲染，但只要
 * fetcher/detailFetcher 身份稳定（由调用方 useCallback 保证），memo 直接跳过本次
 * 重渲染，轮询 effect 不再反复拆建，杜绝异常自动刷新与下钻折叠闪烁。
 */
export const DimTab = memo(function DimTab({
  title,
  subtitle,
  emptyHint,
  fetcher,
  detailFetcher,
  detailLabel,
  dimLabel,
  displayNames,
  onRename,
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
  /** 显示名别名（原始名 → 自定义名）。列表与下钻标题用别名展示，#问题 4。 */
  displayNames?: Record<string, string>;
  /** 保存别名（原始名 → 新名；空值或同原始名视为删除别名）。 */
  onRename?: (original: string, display: string) => Promise<void>;
}) {
  const [rows, setRows] = useState<DimStat[]>([]);
  const [error, setError] = useState("");
  const [days, setDays] = useState<number | undefined>(undefined);
  const [selected, setSelected] = useState<DimStat | null>(null);
  const [detail, setDetail] = useState<DimDetailRow[] | null>(null);
  // 下钻内联重命名：是否正在编辑 + 当前输入值
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);

  // 展示名：别名优先，无别名用原始名。
  const displayOf = (name: string) => displayNames?.[name] || name;

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
          {dimLabel} · {displayOf(selected.name)}
        </h1>
        <p className="page-sub">
          {selected.models} 个模型 · 最近 {fmtDate(selected.lastTs)} · 该{dimLabel}接入的{detailLabel}与模型明细：
        </p>
        {/* 下钻内联重命名（#问题 4）：仅 Agent 维度（onRename 存在时）展示 */}
        {onRename && selected && (
          <div className="form-row rename-row" style={{ marginBottom: 8, gap: 8 }}>
            {renaming ? (
              <>
                <input
                  className="input grow"
                  value={renameValue}
                  placeholder="输入显示名（留空恢复原始名）"
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn primary"
                  disabled={renameSaving}
                  onClick={() => {
                    const original = selected.name;
                    const v = renameValue.trim();
                    setRenameSaving(true);
                    void onRename(original, v).finally(() => {
                      setRenameSaving(false);
                      setRenaming(false);
                      setRenameValue("");
                    });
                  }}
                >
                  {renameSaving ? "保存中…" : "保存"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setRenaming(false);
                    setRenameValue("");
                  }}
                >
                  取消
                </button>
              </>
            ) : (
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setRenameValue(displayNames?.[selected.name] ?? "");
                  setRenaming(true);
                }}
                title="自定义该 Agent 的显示名"
              >
                ✎ 重命名
              </button>
            )}
          </div>
        )}
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
              <span className="list-title">{displayOf(r.name) || "其他"}</span>
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
});
