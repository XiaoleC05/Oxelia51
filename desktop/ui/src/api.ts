// 桌面 UI 与本地 sidecar（LOCAL_MODE 网关，默认 17800）的数据契约。

export type RowCount = { tokens: number; requests: number };
export type ModelStat = { model: string; tokens: number; requests: number };
export type ProjectStat = { projectId: string; tokens: number; requests: number };
export type SessionStat = {
  sessionId: string;
  tokens: number;
  requests: number;
  lastTs: string;
};
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

export const API_BASE = "http://127.0.0.1:17800";

export async function fetchOverview(): Promise<Overview> {
  const res = await fetch(`${API_BASE}/api/overview`);
  if (!res.ok) throw new Error(`overview HTTP ${res.status}`);
  return res.json();
}

export async function fetchHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// 千分位 + 缩写
export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
