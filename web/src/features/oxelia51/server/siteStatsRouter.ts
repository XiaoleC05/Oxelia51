import { createTRPCRouter, publicProcedure } from "@/src/server/api/trpc";

/**
 * 站点公开统计（下载量等外部数据源的服务端代理）。
 *
 * downloadStats：服务端拉取 GitHub Releases API（XiaoleC05/Oxelia51 最新语义化
 * 版本），汇总各资产下载量。客户端不直连 GitHub（匿名限额 60 次/小时/IP，
 * 浏览器侧极易被限流）。
 *
 * 缓存：模块级内存缓存 1 小时——单机口径，仅当前 Next.js 进程内生效；
 * 多实例部署时各实例各自缓存（可接受，GitHub 数据本非强一致）。
 *
 * 失败口径：GitHub 拉取失败时返回上一次成功缓存（stale: true）；
 * 从未成功过则返回 null——前端对 null 一律不渲染数字，不编造兜底值。
 */

const REPO = "XiaoleC05/Oxelia51";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 小时
const FETCH_TIMEOUT_MS = 10_000;

export type SiteDownloadStats = {
  /** 最新语义化 release 标签（如 v1.2.0） */
  version: string;
  /** release 发布时间（ISO），可能为 null */
  publishedAt: string | null;
  /** 该 release 全部资产下载量之和 */
  totalDownloads: number;
  assets: { name: string; downloads: number; url: string }[];
};

type CachedStats = { at: number; stats: SiteDownloadStats };

// 模块级缓存：见文件头注释（单机口径）
let cache: CachedStats | null = null;

async function fetchReleaseStats(): Promise<SiteDownloadStats | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "oxelia51-site",
  };
  // 可选：GITHUB_TOKEN（只读 PAT 即可）把限额从 60/h 提到 5000/h。
  // 属可选运维项，未在 env.mjs 声明，直接读 process.env；未配置时匿名调用。
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/releases?per_page=30`,
    { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
  );
  if (!res.ok) return null;

  const releases = (await res.json()) as {
    tag_name: string;
    draft: boolean;
    published_at: string | null;
    assets: {
      name: string;
      download_count: number;
      browser_download_url: string;
    }[];
  }[];
  // 只认语义化版本（v*），自动 release-* 是 CI commit 噪声（与前端口径一致）
  const rel = releases.find(
    (x) => !x.draft && /^v?\d+\.\d+\.\d+$/.test(x.tag_name),
  );
  if (!rel) return null;

  const assets = rel.assets.map((a) => ({
    name: a.name,
    downloads: a.download_count,
    url: a.browser_download_url,
  }));
  return {
    version: rel.tag_name,
    publishedAt: rel.published_at,
    totalDownloads: assets.reduce((sum, a) => sum + a.downloads, 0),
    assets,
  };
}

export const siteStatsRouter = createTRPCRouter({
  /** 桌面端 GitHub Release 下载量（公开；失败口径见文件头注释） */
  downloadStats: publicProcedure.query(async () => {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
      return { ...cache.stats, stale: false };
    }
    try {
      const stats = await fetchReleaseStats();
      if (stats) {
        cache = { at: Date.now(), stats };
        return { ...stats, stale: false };
      }
    } catch {
      // 拉取异常（网络/超时/限流）：走下方缓存兜底
    }
    // GitHub 失败：有旧缓存返回旧缓存；从未成功过返回 null（前端不渲染数字）
    return cache ? { ...cache.stats, stale: true } : null;
  }),
});
