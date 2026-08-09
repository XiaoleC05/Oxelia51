import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAlerts,
  fetchOverview,
  fetchSettings,
  fmtTokens,
  saveSetting,
  type AlertItem,
  type BudgetItem,
} from "../api";
import { EmptyState } from "../EmptyState";
// #27：系统通知走 Tauri 插件（WebView2 的 Web Notification API 不可靠）
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

// 已触发集合（跨轮询记忆，用于"首次触发时通知"）
let prevTriggered = new Set<string>();
// 通知权限状态（惰性请求一次，之后直接发）
let notifPermission: "granted" | "denied" | "unknown" = "unknown";

async function notifyBudgetTriggered(b: AlertItem) {
  const name = b.model === "*" ? "全局" : b.model;
  try {
    if (notifPermission === "unknown") {
      notifPermission = (await isPermissionGranted()) ? "granted" : "denied";
    }
    if (notifPermission === "denied") {
      // 首次被拒：尝试请求权限（用户此前没授权过时弹系统授权）
      notifPermission = (await requestPermission()) ? "granted" : "denied";
    }
    if (notifPermission === "granted") {
      sendNotification({
        title: "Oxelia51 预算告警",
        body: `${name} 今日已用 ${fmtTokens(b.usedTokens)} tokens，超过预算 ${fmtTokens(b.dailyTokens)}。`,
      });
    }
  } catch {
    // 插件不可用（浏览器 dev 模式）时静默
  }
}

export function AlertsTab() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [model, setModel] = useState("*");
  const [customModel, setCustomModel] = useState("");
  const [realModels, setRealModels] = useState<string[]>([]);
  const [daily, setDaily] = useState("100000");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const addCardRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, s, o] = await Promise.all([fetchAlerts(), fetchSettings(), fetchOverview()]);
      setAlerts(a.alerts);
      setBudgets(s.budgets ?? []);
      // 模型下拉只来自真实记录（幽灵数据清除：不硬编码任何模型名）
      const models = [...new Set((o?.byModel ?? []).map((m) => m.model).filter(Boolean))].sort();
      setRealModels(models);
      setError("");
      // 新触发 → 系统通知（同一条只通知一次：key=model:dailyTokens，跨轮询记忆）
      const now = new Set<string>();
      for (const b of a.alerts) {
        if (b.triggered) {
          const key = `${b.model}:${b.dailyTokens}`;
          now.add(key);
          if (!prevTriggered.has(key)) {
            void notifyBudgetTriggered(b);
          }
        }
      }
      prevTriggered = now;
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const saveBudgets = async (next: BudgetItem[]) => {
    setSaving(true);
    try {
      await saveSetting("budgets", JSON.stringify(next));
      setBudgets(next);
      // 预算变化 → key(model:dailyTokens) 或触发状态变化，prevTriggered 会重新学习，无需额外复位
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const addBudget = () => {
    const n = Number(daily);
    if (!Number.isFinite(n) || n <= 0) return;
    const target = model === "other" ? customModel.trim() : model;
    if (!target) return;
    const next = [...budgets.filter((b) => b.model !== target), { model: target, dailyTokens: n }];
    void saveBudgets(next);
  };

  const removeBudget = (m: string) => {
    void saveBudgets(budgets.filter((b) => b.model !== m));
  };

  return (
    <>
      <h1 className="page-title">预算告警</h1>
      {error && <p className="empty">加载失败：{error}</p>}

      <div className="card">
        <h2 className="card-title">今日预算使用</h2>
        {alerts.length === 0 ? (
          <EmptyState
            compact
            title="还没有预算"
            desc="在下方添加一个每日 Token 预算，超限时本地通知你。"
            action={{
              label: "添加预算",
              onClick: () => addCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
            }}
          />
        ) : (
          <div className="budget-list">
            {alerts.map((b) => (
              <div key={b.model} className={`budget-row ${b.triggered ? "over" : ""}`}>
                <div className="budget-head">
                  <span className="budget-model">{b.model === "*" ? "全局" : b.model}</span>
                  <span className="budget-val tabular">
                    {fmtTokens(b.usedTokens)} / {fmtTokens(b.dailyTokens)}
                    {b.triggered && <b className="budget-tag">已超限</b>}
                  </span>
                </div>
                <div className="rank-track">
                  <div
                    className={`rank-fill ${b.triggered ? "over" : ""}`}
                    style={{ width: `${Math.min(100, b.usedRatio * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" ref={addCardRef}>
        <h2 className="card-title">添加预算</h2>
        <div className="form-row">
          <select
            className="input"
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              if (e.target.value !== "other") setCustomModel("");
            }}
          >
            <option value="*">全局（所有模型）</option>
            {realModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value="other">其他模型（手填）</option>
          </select>
          {model === "other" && (
            <input
              className="input"
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="输入模型名，如 my-model"
            />
          )}
          <input
            className="input"
            type="number"
            min="1"
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
            placeholder="每日 token 上限"
          />
          <button type="button" className="btn primary" onClick={addBudget} disabled={saving}>
            添加
          </button>
        </div>
        <p className="empty">
          模型列表来自本地账本的真实记录{realModels.length === 0 ? "（暂无记录，先让代理落账）" : ""}。
        </p>
      </div>

      {budgets.length > 0 && (
        <div className="card">
          <h2 className="card-title">已配置预算</h2>
          <div className="budget-list">
            {budgets.map((b) => (
              <div key={b.model} className="budget-row">
                <span className="budget-model">{b.model === "*" ? "全局" : b.model}</span>
                <span className="budget-val tabular">{fmtTokens(b.dailyTokens)} / 日</span>
                <button type="button" className="link-btn danger" onClick={() => removeBudget(b.model)}>
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
