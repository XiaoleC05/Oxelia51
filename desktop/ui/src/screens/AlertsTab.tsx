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
import { Dropdown } from "../components/Dropdown";
// #27：系统通知走 Tauri 插件（WebView2 的 Web Notification API 不可靠）
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

// 已触发集合（跨轮询记忆，用于"首次触发时通知"）
let prevTriggered = new Set<string>();
// 通知权限状态（惰性请求一次，之后直接发）
let notifPermission: "granted" | "denied" | "unknown" = "unknown";

async function notifyBudgetTriggered(a: AlertItem) {
  const name = a.target || (a.dimension === "global" ? "全局" : a.target);
  const dimLabel =
    a.dimension === "provider" ? "供应商" : a.dimension === "agent" ? "Agent" : a.dimension === "model" ? "模型" : "全局";
  try {
    if (notifPermission === "unknown") {
      notifPermission = (await isPermissionGranted()) ? "granted" : "denied";
    }
    if (notifPermission === "denied") {
      notifPermission = (await requestPermission()) ? "granted" : "denied";
    }
    if (notifPermission === "granted") {
      sendNotification({
        title: "Oxelia51 预算告警",
        body: `${dimLabel}「${name}」今日已用 ${fmtTokens(a.usedTokens)} tokens，超过预算 ${fmtTokens(a.dailyTokens)}。`,
      });
    }
  } catch {
    // 插件不可用（浏览器 dev 模式）时静默
  }
}

const DIMENSIONS = [
  { value: "global", label: "全局（所有消耗）" },
  { value: "provider", label: "按供应商" },
  { value: "agent", label: "按 Agent" },
  { value: "model", label: "按模型" },
];

const dimLabel = (d: string) => DIMENSIONS.find((x) => x.value === d)?.label ?? d;
const targetLabel = (b: AlertItem) => {
  if (b.dimension === "global") return "全局";
  return b.target || "—";
};

export function AlertsTab() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [dimension, setDimension] = useState("global");
  const [target, setTarget] = useState("");
  const [providers, setProviders] = useState<string[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [daily, setDaily] = useState("100000");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const addCardRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, s, o] = await Promise.all([fetchAlerts(), fetchSettings(), fetchOverview()]);
      setAlerts(a.alerts);
      setBudgets(s.budgets ?? []);
      setProviders(a.providers ?? []);
      setAgents(a.agents ?? []);
      // 模型下拉只来自真实记录（幽灵数据清除：不硬编码任何模型名）
      setModels([...new Set((o?.byModel ?? []).map((m: { model: string }) => m.model).filter(Boolean))].sort());
      setError("");
      // 新触发 → 系统通知（同一条只通知一次：key=dim:target:dailyTokens，跨轮询记忆）
      const now = new Set<string>();
      for (const b of a.alerts) {
        if (b.triggered) {
          const key = `${b.dimension}:${b.target}:${b.dailyTokens}`;
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

  // 当前维度可选项
  const targetOptions =
    dimension === "provider" ? providers : dimension === "agent" ? agents : dimension === "model" ? models : [];

  const saveBudgets = async (next: BudgetItem[]) => {
    setSaving(true);
    try {
      await saveSetting("budgets", JSON.stringify(next));
      setBudgets(next);
      // 保存成功后立即刷新「今日预算使用」，不等下一轮 15s 轮询
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const addBudget = () => {
    const n = Number(daily);
    if (!Number.isFinite(n) || n <= 0) return;
    const t = dimension === "global" ? "" : target.trim();
    if (dimension !== "global" && !t) return;
    // 同维度同目标去重
    const next = [
      ...budgets.filter((b) => !(b.dimension === dimension && (b.target ?? "") === t)),
      { dimension, target: t, dailyTokens: n },
    ];
    void saveBudgets(next);
  };

  const removeBudget = (idx: number) => {
    void saveBudgets(budgets.filter((_, i) => i !== idx));
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
            desc="可为全局、某个供应商、某个 Agent 或某个模型分别设置每日预算，超限时本地通知你。"
            action={{
              label: "添加预算",
              onClick: () => addCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
            }}
          />
        ) : (
          <div className="budget-list">
            {alerts.map((b, i) => (
              <div key={i} className={`budget-row ${b.triggered ? "over" : ""}`}>
                <div className="budget-head">
                  <span className="budget-model">
                    <span className="budget-dim">{dimLabel(b.dimension)}</span>
                    {targetLabel(b)}
                  </span>
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
          <Dropdown
            options={DIMENSIONS.map((d) => ({ value: d.value, label: d.label }))}
            value={dimension}
            onChange={(v) => {
              setDimension(v);
              setTarget("");
            }}
            ariaLabel="告警维度"
          />
          {dimension !== "global" && (
            <Dropdown
              options={targetOptions.map((t) => ({ value: t, label: t }))}
              value={target}
              onChange={setTarget}
              placeholder="请选择…"
              ariaLabel="目标"
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
          目标列表来自本地账本的真实记录（供应商 / Agent / 模型）。
          每个供应商、Agent、模型都可以单独设置每日预算，互不影响。
        </p>
      </div>

      {budgets.length > 0 && (
        <div className="card">
          <h2 className="card-title">已配置预算</h2>
          <div className="budget-list">
            {budgets.map((b, i) => (
              <div key={i} className="budget-row">
                <span className="budget-model">
                  <span className="budget-dim">{dimLabel(b.dimension ?? (b.model === "*" ? "global" : "model"))}</span>
                  {(b.target || (b.dimension !== "global" ? b.model : "")) || "全局"}
                </span>
                <span className="budget-val tabular">{fmtTokens(b.dailyTokens)} / 日</span>
                <button type="button" className="link-btn danger" onClick={() => removeBudget(i)}>
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
