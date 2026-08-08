import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAlerts,
  fetchSettings,
  fmtTokens,
  saveSetting,
  type AlertItem,
  type BudgetItem,
} from "../api";

// 已触发集合（跨轮询记忆，用于"首次触发时通知"）
let prevTriggered = new Set<string>();

function notifyBudgetTriggered(b: AlertItem) {
  const name = b.model === "*" ? "全局" : b.model;
  try {
    // 浏览器通知（Tauri webview 支持）；不可用时静默
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Oxelia51 预算告警", {
        body: `${name} 今日已用 ${fmtTokens(b.usedTokens)} tokens，超过预算 ${fmtTokens(b.dailyTokens)}。`,
      });
    }
  } catch {
    // ignore
  }
}

export function AlertsTab() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [model, setModel] = useState("*");
  const [daily, setDaily] = useState("100000");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const notified = useRef(false);

  // 请求通知权限（首次）
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([fetchAlerts(), fetchSettings()]);
      setAlerts(a.alerts);
      setBudgets(s.budgets ?? []);
      setError("");
      // 新触发 → 系统通知（同一条只通知一次）
      const now = new Set<string>();
      for (const b of a.alerts) {
        if (b.triggered) {
          const key = `${b.model}:${b.dailyTokens}`;
          now.add(key);
          if (!prevTriggered.has(key) && !notified.current) {
            notifyBudgetTriggered(b);
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
      notified.current = false; // 预算变化后允许重新通知
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const addBudget = () => {
    const n = Number(daily);
    if (!Number.isFinite(n) || n <= 0) return;
    const next = [...budgets.filter((b) => b.model !== model), { model, dailyTokens: n }];
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
          <p className="empty">还没有预算——在下方添加一个每日 Token 预算，超限时本地通知你。</p>
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

      <div className="card">
        <h2 className="card-title">添加预算</h2>
        <div className="form-row">
          <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="*">全局（所有模型）</option>
            <option value="claude-sonnet-5">claude-sonnet-5</option>
            <option value="gpt-5">gpt-5</option>
            <option value="deepseek-chat">deepseek-chat</option>
            <option value="other">其他模型（手填）</option>
          </select>
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
        <p className="empty">提醒：通知需要浏览器通知权限；Tauri 桌面端通过系统通知展示。</p>
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
