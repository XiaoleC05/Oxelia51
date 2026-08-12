import { useEffect, useMemo, useState } from "react";
import {
  fetchPricing,
  fetchPricingCatalog,
  fetchPricingRate,
  saveSetting,
  type PricedItem,
  type PricingCatalogItem,
  type PricingRate,
} from "../api";
import { EmptyState } from "../EmptyState";
import { Dropdown } from "../components/Dropdown";

/**
 * 模型价格表：按 输入价 / 输出价 排行，美元 / 人民币一键切换。
 * 价格为内置参考价（/api/pricing/catalog），标注为参考价，桌面离线可用；
 * 人民币按 sidecar 每日更新的汇率换算（/api/pricing/rate），汇率源标注在表格下方。
 * 点击模型条目可编辑其价格，保存到「模型定价」（pricing 设置，影响成本计算）。
 */
type SortMode = "price" | "output";
type SortDir = "asc" | "desc";
type Currency = "usd" | "cny";

export function ModelPriceTab() {
  const [items, setItems] = useState<PricingCatalogItem[]>([]);
  const [rate, setRate] = useState<PricingRate | null>(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortMode>("price");
  const [dir, setDir] = useState<SortDir>("asc");
  const [provider, setProvider] = useState("");
  const [currency, setCurrency] = useState<Currency>("usd");
  // 用户已保存的自定义定价（model → 输入/输出字符串）
  const [savedPricing, setSavedPricing] = useState<Map<string, { prompt: string; completion: string }>>(new Map());
  // 正在编辑的模型（null = 无）；价格以字符串编辑，保存时校验
  const [editing, setEditing] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editCompletion, setEditCompletion] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPricingCatalog()
      .then((r) => {
        if (!cancelled) setItems(r.catalog ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      });
    fetchPricingRate()
      .then((r) => {
        if (!cancelled) setRate(r);
      })
      .catch(() => {
        // 汇率拿不到时按内置参考值；价格表仍以美元展示
      });
    fetchPricing()
      .then((r) => {
        if (cancelled) return;
        const m = new Map<string, { prompt: string; completion: string }>();
        for (const p of r.pricing ?? []) m.set(p.model, { prompt: p.prompt, completion: p.completion });
        setSavedPricing(m);
      })
      .catch(() => {
        // 拿不到已保存定价不影响参考价展示
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const providers = useMemo(
    () => [...new Set(items.map((i) => i.provider))].sort(),
    [items],
  );

  const sorted = useMemo(() => {
    let list = provider ? items.filter((i) => i.provider === provider) : items;
    const mul = dir === "asc" ? 1 : -1;
    if (sort === "output") {
      list = [...list].sort(
        (a, b) =>
          ((a.completion - b.completion) || (a.prompt - b.prompt)) * mul,
      );
    } else {
      list = [...list].sort(
        (a, b) =>
          ((a.prompt - b.prompt) || (a.completion - b.completion)) * mul,
      );
    }
    return list;
  }, [items, provider, sort, dir]);

  const toggleDir = () => setDir((d) => (d === "asc" ? "desc" : "asc"));
  const toggleCurrency = () => setCurrency((c) => (c === "usd" ? "cny" : "usd"));

  // 按所选币种格式化价格：人民币 = 美元 × 当日汇率
  const fmtPrice = (usd: number) => {
    if (usd === 0) return "—";
    if (currency === "cny" && rate) return `≈¥${(usd * rate.usd_to_cny).toFixed(3)}`;
    return `$${usd.toFixed(3)}`;
  };
  const curMark = currency === "cny" ? "¥" : "$";

  const startEdit = (i: PricingCatalogItem) => {
    const saved = savedPricing.get(i.model);
    setEditing(i.model);
    setEditPrompt(saved?.prompt ?? String(i.prompt));
    setEditCompletion(saved?.completion ?? String(i.completion));
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async (model: string) => {
    const p = editPrompt.trim();
    const c = editCompletion.trim();
    if (p === "" || c === "" || Number.isNaN(Number(p)) || Number.isNaN(Number(c))) {
      setError("价格须为有效数字");
      return;
    }
    setSavingEdit(true);
    try {
      const next = new Map(savedPricing);
      next.set(model, { prompt: p, completion: c });
      const arr: PricedItem[] = [...next.entries()].map(([m, v]) => ({
        model: m,
        prompt: v.prompt,
        completion: v.completion,
      }));
      await saveSetting("pricing", JSON.stringify(arr));
      setSavedPricing(next);
      setEditing(null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="card">
      <div className="price-head">
        <h2 className="card-title">模型价格参考</h2>
        <div className="price-controls">
          <Dropdown
            options={providers.map((p) => ({ value: p, label: p }))}
            value={provider}
            onChange={setProvider}
            placeholder="全部供应商"
            ariaLabel="按供应商筛选"
          />
          <div className="date-range-picker">
            <button
              type="button"
              className={`range-chip ${sort === "price" ? "active" : ""}`}
              onClick={() => setSort("price")}
            >
              按输入价
            </button>
            <button
              type="button"
              className={`range-chip ${sort === "output" ? "active" : ""}`}
              onClick={() => setSort("output")}
            >
              按输出价
            </button>
            <button
              type="button"
              className="range-chip dir"
              onClick={toggleDir}
              title={dir === "asc" ? "当前升序，点击切换降序" : "当前降序，点击切换升序"}
            >
              {dir === "asc" ? "↑ 升序" : "↓ 降序"}
            </button>
            <button
              type="button"
              className={`range-chip ${currency === "cny" ? "active" : ""}`}
              onClick={toggleCurrency}
              title="美元 / 人民币 一键切换"
            >
              {currency === "cny" ? "¥ 人民币" : "$ 美元"}
            </button>
          </div>
        </div>
      </div>
      {error && <p className="empty">加载失败：{error}</p>}
      {items.length === 0 && !error ? (
        <EmptyState compact title="暂无价格数据" desc="内置参考价不可用。" />
      ) : (
        <div className="price-table">
          <div className="price-row price-head-row">
            <span>模型</span>
            <span>供应商</span>
            <span className="num">输入 {curMark}/1M</span>
            <span className="num">输出 {curMark}/1M</span>
            <span />
          </div>
          {sorted.map((i) =>
            editing === i.model ? (
              <div key={`${i.provider}-${i.model}`} className="price-row price-row-edit">
                <span className="price-model">{i.model}</span>
                <span className="price-provider">{i.provider}</span>
                <span className="num">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    aria-label={`${i.model} 输入价`}
                  />
                </span>
                <span className="num">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editCompletion}
                    onChange={(e) => setEditCompletion(e.target.value)}
                    aria-label={`${i.model} 输出价`}
                  />
                </span>
                <span className="price-edit-actions">
                  <button type="button" className="btn primary" disabled={savingEdit} onClick={() => void saveEdit(i.model)}>
                    保存
                  </button>
                  <button type="button" className="link-btn" onClick={cancelEdit}>取消</button>
                </span>
              </div>
            ) : (
              <div
                key={`${i.provider}-${i.model}`}
                className="price-row price-row-clickable"
                onClick={() => startEdit(i)}
                title="点击编辑该模型价格"
              >
                <span className="price-model">{i.model}</span>
                <span className="price-provider">{i.provider}</span>
                <span className="num">{fmtPrice(i.prompt)}</span>
                <span className="num">{fmtPrice(i.completion)}</span>
                <span className="price-edit-hint">{savedPricing.has(i.model) ? "已定价" : ""}</span>
              </div>
            ),
          )}
        </div>
      )}
      <p className="price-note">
        参考价 · 离线可用 · 按输入价 / 输出价排序 · 点击模型条目可编辑并保存到「模型定价」
        {currency === "cny" && rate
          ? ` · 汇率 1 USD = ¥${rate.usd_to_cny.toFixed(4)}（${rate.source}${rate.updated_at ? ` · ${rate.updated_at}` : ""}，每日更新）`
          : ""}
      </p>
    </div>
  );
}
