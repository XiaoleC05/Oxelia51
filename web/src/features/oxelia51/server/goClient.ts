import { TRPCError } from "@trpc/server";
import { env } from "@/src/env.mjs";

/** Oxelia51 Go 后端服务端代理客户端（凭证不下发浏览器）。 */

const API_BASE = "https://oxelia51.com";

// Go JWT 服务端缓存（单实例，按 expires_in 提前 60s 续期）
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getGoToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  const account = env.OXELIA51_ADMIN_ACCOUNT;
  const password = env.OXELIA51_ADMIN_PASSWORD;
  if (!account || !password) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "运维凭证未配置（OXELIA51_ADMIN_ACCOUNT/PASSWORD）",
    });
  }
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account, password }),
  });
  const data = (await res.json()) as { token?: string; expires_in?: number };
  if (!res.ok || !data.token) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `运维登录失败（HTTP ${res.status}）`,
    });
  }
  const ttl = (data.expires_in ?? 3600) * 1000;
  cachedToken = { token: data.token, expiresAt: Date.now() + ttl - 60_000 };
  return cachedToken.token;
}

/**
 * 提取浏览器真实出口 IP。
 * 优先取 nginx 设置的 X-Real-IP（$remote_addr，客户端不可伪造）；
 * 回退 X-Forwarded-For 首段仅供无 nginx 的开发环境，生产不依赖。
 * 注意：X-Forwarded-For 首段是客户端可写的，绝不能作为可信来源。
 */
export function clientIpFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string {
  const pick = (key: string): string => {
    const v = headers[key];
    const first = Array.isArray(v) ? v[0] : v;
    return first ? first.trim() : "";
  };
  const real = pick("x-real-ip");
  if (real) return real;
  const xff = pick("x-forwarded-for");
  return xff ? xff.split(",")[0].trim() : "";
}

export async function goFetch(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown,
  auth = true,
  clientIp?: string,
): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (auth) headers.Authorization = `Bearer ${await getGoToken()}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  // 转发浏览器真实出口 IP，Go 后端据此返回/校验 clientIP
  if (clientIp) headers["X-Oxelia51-Client-IP"] = clientIp;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new TRPCError({ code: "BAD_GATEWAY", message: msg });
  }
  return data;
}
