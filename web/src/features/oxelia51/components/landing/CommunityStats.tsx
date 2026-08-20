"use client";

import { useEffect, useState } from "react";
import { Star, GitFork, Download } from "lucide-react";
import { ContributorMarquee } from "./ContributorMarquee";

/**
 * 社区区块的 GitHub 真实数据：Star / Fork / 贡献者。
 * 数据来自 GitHub 公开 API，sessionStorage 缓存避免反复请求；
 * 拉取失败或超限时降级为「—」，不展示虚构数字。
 */

type RepoInfo = {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
};

type Contributor = {
  login: string;
  avatar_url: string;
};

const REPO = "XiaoleC05/Oxelia51";
const CACHE_KEY = "oxelia51-github-stats";

function loadCache(): { repo?: RepoInfo; contributors?: Contributor[] } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      repo?: RepoInfo;
      contributors?: Contributor[];
    };
    if (parsed.repo && Array.isArray(parsed.contributors)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveCache(repo: RepoInfo, contributors: Contributor[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ repo, contributors }));
  } catch {
    // ignore quota/private-mode errors
  }
}

export function CommunityStats() {
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [contributors, setContributors] = useState<Contributor[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const cached = loadCache();
    if (cached) {
      if (cached.repo) setRepo(cached.repo);
      if (cached.contributors) setContributors(cached.contributors);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    // 两个请求独立加载，互不拖累：仓库统计被限流/失败时，贡献者数据仍正常展示。
    const load = async () => {
      const [repoJson, contribJson] = await Promise.all([
        fetch(`https://api.github.com/repos/${REPO}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(`https://api.github.com/repos/${REPO}/contributors?per_page=30`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      if (cancelled) return;
      const repo = repoJson as RepoInfo | null;
      const contributors = Array.isArray(contribJson)
        ? (contribJson as Contributor[])
        : [];
      setRepo(repo);
      setContributors(contributors);
      if (repo && contributors.length) {
        saveCache(repo, contributors);
      }
      setLoaded(true);
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const fmt = (n: number | undefined | null) =>
    n == null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 统计行 */}
      <div className="flex items-center gap-8 text-sm text-(--ox-text-muted)">
        <span className="flex items-center gap-1.5">
          <Star className="h-4 w-4 text-(--ox-accent)" />
          <b className="text-(--ox-text-h) tabular-nums">
            {fmt(repo?.stargazers_count)}
          </b>
          Star
        </span>
        <span className="flex items-center gap-1.5">
          <GitFork className="h-4 w-4 text-(--ox-accent)" />
          <b className="text-(--ox-text-h) tabular-nums">
            {fmt(repo?.forks_count)}
          </b>
          Fork
        </span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <Download className="h-4 w-4 text-(--ox-accent)" />
          <b className="text-(--ox-text-h) tabular-nums">—</b>
          下载
        </span>
      </div>

      {/* 贡献者：数量少静态堆叠，数量多双轨对向滚动 */}
      {loaded &&
        (contributors?.length ? (
          <ContributorMarquee contributors={contributors} />
        ) : (
          <span className="text-xs text-(--ox-text-muted)">
            等你的第一行贡献
          </span>
        ))}
    </div>
  );
}
