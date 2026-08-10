import { useEffect, useMemo, useState } from "react";
import { fetchPricingCatalog, fetchPricingRate, type PricingCatalogItem, type PricingRate } from "../api";
import { EmptyState } from "../EmptyState";
import { Dropdown } from "../components/Dropdown";

/**
 * 模型价格表：按 输入价 / 综合成本 排行，美元 / 人民币一键切换。
 * 综合成本 = 输出价 × 0.6 + 输入价 × 0.4（输出更贵、权重更高；值越小越划算）。
 * 价格为内置参考价（/api/pricing/catalog），标注为参考价，桌面离线可用；
 * 人民币按 sidecar 每日更新的汇率换算（/api/pricing/rate），汇率源标注在表格下方。
 */
type SortMode = "price" | "blended";
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
    if (sort === "blended") {
      // 综合成本：输出价 * 0.6 + 输入价 * 0.4（输出更贵、权重更高；越低越划算）
      list = [...list].sort(
        (a, b) =>
          (a.completion * 0.6 + a.prompt * 0.4 - (b.completion * 0.6 + b.prompt * 0.4)) * mul,
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
              className={`range-chip ${sort === "blended" ? "active" : ""}`}
              onClick={() => setSort("blended")}
            >
              按综合成本
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
          </div>
          {sorted.map((i) => (
            <div key={`${i.provider}-${i.model}`} className="price-row">
              <span className="price-model">{i.model}</span>
              <span className="price-provider">{i.provider}</span>
              <span className="num">{fmtPrice(i.prompt)}</span>
              <span className="num">{fmtPrice(i.completion)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="price-note">
        参考价 · 离线可用 · 综合成本 = 输出×0.6 + 输入×0.4
        {currency === "cny" && rate
          ? ` · 汇率 1 USD = ¥${rate.usd_to_cny.toFixed(4)}（${rate.source}${rate.updated_at ? ` · ${rate.updated_at}` : ""}，每日更新）`
          : ""}
      </p>
    </div>
  );
}
