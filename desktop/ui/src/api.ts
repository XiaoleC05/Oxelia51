// 桌面 UI 与本地 sidecar（LOCAL_MODE 网关，默认 17800）的数据契约。

export const API_BASE = "http://127.0.0.1:17800";

export type RowCount = { tokens: number; requests: number; cost: number };
export type ModelStat = { model: string; tokens: number; requests: number; cost: number };
export type ProjectStat = { projectId: string; tokens: number; requests: number; cost: number; models: number; lastTs: string };
export type SessionStat = { sessionId: string; projectId: string; tokens: number; requests: number; cost: number; models: number; lastTs: string };
export type TrendPoint = { date: string; tokens: number; requests: number };

export type Overview = {
  today: RowCount;
  week: RowCount;
  month: RowCount;
  total: RowCount;
  byModel: ModelStat[];
  byProject: ProjectStat[];
  sessions: SessionStat[];
  trend: TrendPoint[];
};

export type SessionDetail = {
  session: SessionStat;
  models: ModelStat[];
  events: { model: string; tokens: number; durationMs: number; ts: string }[];
};

export type AlertItem = {
  model: string;
  dailyTokens: number;
  usedTokens: number;
  usedRatio: number;
  triggered: boolean;
};

export type BudgetItem = { model: string; dailyTokens: number };

export type PricedItem = { model: string; prompt: string; completion: string };

export type Settings = {
  port: number;
  theme: string;
  pricing: PricedItem[] | null;
  budgets: BudgetItem[] | null;
  sync: { enabled: boolean; account: string; lastSync: string };
};

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json() as Promise<T>;
}

export const fetchOverview = () => j<Overview>("/api/overview");
export const fetchHealth = async (): Promise<boolean> => {
  try {
    return (await fetch(`${API_BASE}/api/health`)).ok;
  } catch {
    return false;
  }
};
export const fetchProjects = () => j<{ projects: ProjectStat[] }>("/api/projects");
export const fetchSessions = () => j<{ sessions: SessionStat[] }>("/api/sessions");
export const fetchSessionDetail = (id: string) => j<SessionDetail>(`/api/sessions/${encodeURIComponent(id)}`);
export const fetchAlerts = () => j<{ alerts: AlertItem[]; globalToday: number }>("/api/alerts");
export const fetchSettings = () => j<Settings>("/api/settings");
export const fetchPricing = () => j<{ pricing: PricedItem[] }>("/api/pricing");
export const fetchPricingDefaults = () => j<{ pricing: PricedItem[] }>("/api/pricing/defaults");
export const saveSetting = (key: string, value: string) =>
  j<{ ok: boolean }>("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });

export type SyncResult = { ok: boolean; action: string; uploaded?: number; downloaded?: number };
export const postSync = (action: "upload" | "download") =>
  j<SyncResult>("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });

// 登录云账户（Go 后端 JWT），返回 token
export async function cloudLogin(account: string, password: string): Promise<string> {
  const res = await fetch("https://oxelia51.com/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account, password }),
  });
  if (!res.ok) throw new Error(`登录失败 HTTP ${res.status}`);
  const data = (await res.json()) as { token: string };
  return data.token;
}

// 千分位 + 缩写
export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function fmtCost(cost: number | null | undefined): string {
  const c = Number(cost);
  if (!Number.isFinite(c) || c <= 0) return "¥0 / $0";
  return `¥${(c * 7.2).toFixed(2)} / $${c.toFixed(4)}`;
}

export function fmtDate(ts: string): string {
  if (!ts) return "—";
  return ts.slice(5, 16).replace(" ", " ");
}
