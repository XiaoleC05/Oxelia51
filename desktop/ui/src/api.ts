// 桌面 UI 与本地 sidecar（LOCAL_MODE 网关，默认 17800）的数据契约。
import { invoke } from "@tauri-apps/api/core";

export const API_BASE = "http://127.0.0.1:17800";

export type RowCount = { tokens: number; requests: number; cost: number };
export type ModelStat = {
  model: string;
  tokens: number;
  requests: number;
  cost: number;
};
/** custom 为后端扩展字段：/api/providers 作为真实路由清单时，自定义供应商带 custom:true。 */
export type DimStat = {
  name: string;
  tokens: number;
  requests: number;
  cost: number;
  models: number;
  lastTs: string;
  custom?: boolean;
};
export type DimDetailRow = {
  dim: string;
  model: string;
  tokens: number;
  requests: number;
  cost: number;
};
export type TrendPoint = { date: string; tokens: number; requests: number };

export type Overview = {
  today: RowCount;
  week: RowCount;
  month: RowCount;
  total: RowCount;
  byModel: ModelStat[];
  /** 今日 top-5 模型（悬浮卡片排名用） */
  todayByModel: ModelStat[];
  byProvider: DimStat[];
  byAgent: DimStat[];
  trend: TrendPoint[];
};

export type AlertItem = {
  dimension: string; // global / provider / agent / model
  target: string; // 具体名称（global 为空）
  dailyTokens: number;
  usedTokens: number;
  usedRatio: number;
  triggered: boolean;
};

export type BudgetItem = {
  dimension?: string;
  target?: string;
  model?: string; // 兼容旧格式
  dailyTokens: number;
};

export type PricedItem = { model: string; prompt: string; completion: string };

export type Settings = {
  theme: string;
  pricing: PricedItem[] | null;
  budgets: BudgetItem[] | null;
  sync: { enabled: boolean; account: string; lastSync: string };
  /** 悬浮卡片显示字段（tokens/cost/requests/week）；空 = 全部 */
  widgetFields: string[];
  /** 悬浮卡片窗口位置（拖动后持久化，重启恢复） */
  widgetPos?: { x: number; y: number };
  /** Agent 显示名别名（原始名 → 自定义名；如把「其他」重命名），#问题 4 */
  agentAliases?: Record<string, string>;
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
export const fetchProviders = (days?: number) =>
  j<{ providers: DimStat[]; anthropicVariants?: string[] }>(
    days ? `/api/providers?days=${days}` : "/api/providers",
  );
export const fetchAgents = (days?: number) =>
  j<{ agents: DimStat[] }>(days ? `/api/agents?days=${days}` : "/api/agents");
export const fetchProviderDetail = (name: string, days?: number) =>
  j<{ provider: string; rows: DimDetailRow[] }>(
    `/api/providers/${encodeURIComponent(name)}${days ? `?days=${days}` : ""}`,
  );
export const fetchAgentDetail = (name: string, days?: number) =>
  j<{ agent: string; rows: DimDetailRow[] }>(
    `/api/agents/${encodeURIComponent(name)}${days ? `?days=${days}` : ""}`,
  );
export const fetchModels = (days?: number) =>
  j<{ models: DimStat[] }>(days ? `/api/models?days=${days}` : "/api/models");
export const fetchAlerts = () =>
  j<{
    alerts: AlertItem[];
    globalToday: number;
    providers: string[];
    agents: string[];
  }>("/api/alerts");
export const fetchSettings = () => j<Settings>("/api/settings");
export const fetchPricing = () => j<{ pricing: PricedItem[] }>("/api/pricing");
export const fetchPricingDefaults = () =>
  j<{ pricing: PricedItem[] }>("/api/pricing/defaults");

export type PricingCatalogItem = {
  model: string;
  provider: string;
  prompt: number;
  completion: number;
};
export const fetchPricingCatalog = () =>
  j<{ catalog: PricingCatalogItem[] }>("/api/pricing/catalog");

/** USD→CNY 汇率（sidecar 每日从权威源更新；失败回退上次成功值 / 内置参考值）。 */
export type PricingRate = {
  usd_to_cny: number;
  source: string;
  updated_at: string;
};
export const fetchPricingRate = () => j<PricingRate>("/api/pricing/rate");
export const saveSetting = (key: string, value: string) =>
  j<{ ok: boolean }>("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });

// ---------- 独立后台代理（方案 C，走 Tauri 命令 manage_proxy） ----------
export type ProxyStatus = {
  enabled: boolean; // 开机自启已注册
  running: boolean; // 17800 有进程监听
  version: string; // 运行中代理版本（未运行则空）
};
/** 查询/开启/关闭独立后台代理。非 Tauri 环境（浏览器 dev）兜底返回关闭态。 */
export const proxyCtl = async (
  action: "status" | "install" | "uninstall",
): Promise<ProxyStatus> => {
  try {
    return await invoke<ProxyStatus>("manage_proxy", { action });
  } catch {
    return { enabled: false, running: false, version: "" };
  }
};

/** 清空本地账本（token_events 用量/成本统计）；保留 settings 配置。 */
export const clearData = () =>
  j<{ ok: boolean; deleted: number }>("/api/clear-data", { method: "POST" });

export type DetectedTool = { id: string; label: string; version: string };
/** 扫描本地已安装的 AI Agent 工具（只读探测，见 proxy-gateway detect.go）。 */
export const fetchDetectedTools = () =>
  j<{ detected: DetectedTool[] }>("/api/detect-tools");

export type SyncResult = {
  ok: boolean;
  action: string;
  uploaded?: number;
  downloaded?: number;
  conflicts?: number;
};
export const postSync = (action: "upload" | "download") =>
  j<SyncResult>("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });

// ---------- 自定义供应商（/api/custom-providers） ----------
// protocol: openai = OpenAI 兼容协议（OPENAI_BASE_URL）；anthropic = Anthropic 协议（ANTHROPIC_BASE_URL）。
export type CustomProvider = {
  slug: string;
  name: string;
  baseUrl: string;
  protocol: "openai" | "anthropic";
};

export const fetchCustomProviders = () =>
  j<{ items: CustomProvider[] }>("/api/custom-providers");

// 写操作失败时透传服务端 {error} 文案（400 校验失败 / 409 slug 冲突等），同 cloudLogin 模式
async function postCustomProvider<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status} ${url}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      // 非 JSON 响应，保留默认文案
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const upsertCustomProvider = (p: CustomProvider) =>
  postCustomProvider<{ ok: boolean }>("/api/custom-providers", p);
export const deleteCustomProvider = (slug: string) =>
  postCustomProvider<{ ok: boolean }>("/api/custom-providers/delete", { slug });

// 登录云同步账户（web 平台 /api/sync/login，长期 token oxs_...；账户 = 注册邮箱），返回 token
export async function cloudLogin(
  account: string,
  password: string,
): Promise<string> {
  const res = await fetch("https://oxelia51.com/api/sync/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account, password }),
  });
  if (!res.ok) {
    // 失败时尽量透传服务端 {error} 文案（如 401 凭证错误）
    let msg = `登录失败 HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      // 非 JSON 响应，保留默认文案
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

// 千分位 + 缩写
export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * CNY/USD 兜底汇率（#34）。总览排行的人民币换算走 /api/pricing/rate 实时汇率
 *（sidecar 每日更新），仅在汇率接口不可用时回退到本固定参考值，保持本地优先容错；
 * 悬浮卡片等轻量展示仍用本参考值，不额外拉取汇率。
 * 展示为「参考值」而非精确记账，避免伪精确。
 */
export const CNY_PER_USD = 7.2;

/**
 * 格式化成本。未配置定价的模型成本为 0，此时显示「未配置定价」而非「¥0」，
 * 避免用户误以为该模型免费（空定价表是全新安装的默认状态）。
 * rate 为 USD→CNY 汇率，缺省用兜底参考值 CNY_PER_USD。
 */
export function fmtCost(
  cost: number | null | undefined,
  rate: number = CNY_PER_USD,
): string {
  const c = Number(cost);
  if (!Number.isFinite(c) || c <= 0) return "未配置定价";
  return `≈¥${(c * rate).toFixed(2)} / $${c.toFixed(4)}`;
}

/** 币种（总览显示模式：美元 / 人民币）。 */
export type Currency = "usd" | "cny";

/** 按币种格式化成本：未配置定价或非正数返回「未配置定价」。rate 缺省用兜底参考值。 */
export function fmtCostByCurrency(
  cost: number | null | undefined,
  currency: Currency,
  rate: number = CNY_PER_USD,
): string {
  const c = Number(cost);
  if (!Number.isFinite(c) || c <= 0) return "未配置定价";
  return currency === "cny" ? `≈¥${(c * rate).toFixed(2)}` : `$${c.toFixed(4)}`;
}

export function fmtDate(ts: string): string {
  if (!ts) return "—";
  return ts.slice(5, 16).replace(" ", " ");
}
