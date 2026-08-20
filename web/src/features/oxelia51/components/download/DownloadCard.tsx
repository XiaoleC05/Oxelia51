"use client";

import { Apple, Download, Monitor, RotateCw, Terminal } from "lucide-react";
import { api } from "@/src/utils/api";

/**
 * 下载区：通过服务端 tRPC 代理拉取 GitHub Releases（不走客户端直连，
 * 避免浏览器侧 GitHub 匿名限额 60 次/小时/IP 被共享 IP 耗尽）。
 * 服务端有 1 小时内存缓存 + 可选 GITHUB_TOKEN 提至 5000 次/小时。
 *
 * 尚无 v* 版本时各平台显示「即将推出」，不虚构下载项；
 * 拉取失败（限流/网络）显示「获取失败」+ 重试，不伪装成未发布。
 */

type PlatformMethod = {
  key: string;
  label: string;
  hint: string;
  match: (name: string) => boolean;
};

const PLATFORMS: {
  id: string;
  name: string;
  icon: "windows" | "macos" | "linux";
  methods: PlatformMethod[];
}[] = [
  {
    id: "windows",
    name: "Windows",
    icon: "windows",
    methods: [
      {
        key: "installer",
        label: "安装包 (.exe)",
        hint: "日常使用，开始菜单/桌面快捷方式",
        match: (n) => n.endsWith(".exe"),
      },
      {
        key: "portable",
        label: "便携版 (.zip)",
        hint: "免安装，U 盘 / 绿色使用",
        match: (n) => n.endsWith(".zip"),
      },
    ],
  },
  {
    id: "macos",
    name: "macOS",
    icon: "macos",
    methods: [
      {
        key: "dmg",
        label: ".dmg",
        hint: "Apple Silicon / Intel 安装包",
        match: (n) => n.endsWith(".dmg"),
      },
    ],
  },
  {
    id: "linux",
    name: "Linux",
    icon: "linux",
    methods: [
      {
        key: "appimage",
        label: ".AppImage",
        hint: "通用发行版，免安装",
        match: (n) => n.endsWith(".AppImage"),
      },
      {
        key: "deb",
        label: ".deb",
        hint: "Debian / Ubuntu 包管理",
        match: (n) => n.endsWith(".deb"),
      },
      {
        key: "rpm",
        label: ".rpm",
        hint: "Fedora / RHEL 包管理",
        match: (n) => n.endsWith(".rpm"),
      },
    ],
  },
];

const ICONS = {
  windows: <Monitor className="h-5 w-5" />,
  macos: <Apple className="h-5 w-5" />,
  linux: <Terminal className="h-5 w-5" />,
};

export function DownloadCard() {
  // 全部数据走服务端代理（有缓存 + 可选 GITHUB_TOKEN），不再客户端直连 GitHub
  const statsQ = api.siteStats.downloadStats.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const stats = statsQ.data ?? null;

  // 派生状态
  const isLoading = statsQ.isLoading;
  const isError = statsQ.isError || (statsQ.isFetched && stats === null);
  const version = stats?.version ?? null;
  const assets = stats?.assets ?? [];
  const hasRelease = version !== null && assets.length > 0;

  return (
    <>
      {/* 汇总行 */}
      <div className="mt-8 flex min-h-6 items-center justify-center gap-3 text-xs text-(--ox-text-muted)">
        {stats && stats.totalDownloads > 0 && (
          <span>
            累计下载 {stats.totalDownloads.toLocaleString("zh-CN")} 次
          </span>
        )}
        {stats?.stale && (
          <span className="text-(--ox-text-muted)/60">（缓存数据）</span>
        )}
        {isError && (
          <>
            <span style={{ color: "var(--ox-warn)" }}>
              发布信息获取失败，可能是 GitHub 访问受限
            </span>
            <button
              type="button"
              onClick={() => statsQ.refetch()}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition-colors hover:border-(--ox-accent)/60 hover:text-(--ox-accent)"
              style={{ borderColor: "var(--ox-border)" }}
            >
              <RotateCw className="h-3 w-3" />
              重试
            </button>
          </>
        )}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {PLATFORMS.map((p) => {
          return (
            <div
              key={p.id}
              id={p.id}
              className="h-full scroll-mt-28 rounded-xl border p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              style={{
                borderColor: "var(--ox-border)",
                backgroundColor: "var(--ox-bg)",
                boxShadow: "0 0 0 0 transparent",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-(--ox-text-h)">
                  <span className="text-(--ox-accent)">{ICONS[p.icon]}</span>
                  {p.name}
                </span>
                {hasRelease ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-bold text-(--ox-ok)"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--ox-ok) 12%, transparent)",
                    }}
                  >
                    v{version?.replace(/^v/, "")}
                  </span>
                ) : (
                  <span
                    className="rounded-full border px-2 py-0.5 text-xs text-(--ox-text-muted)"
                    style={{ borderColor: "var(--ox-border)" }}
                  >
                    {isError ? "获取失败" : isLoading ? "检查中…" : "即将推出"}
                  </span>
                )}
              </div>
              <ul className="mt-4 flex flex-col gap-2.5">
                {p.methods.map((m) => {
                  const hit = hasRelease
                    ? assets.find((a) => m.match(a.name))
                    : undefined;
                  return (
                    <li key={m.key}>
                      {hit ? (
                        <a
                          href={hit.url}
                          download
                          className="group flex items-start gap-2 rounded-lg border px-3 py-2 transition-colors hover:border-(--ox-accent)/60"
                          style={{
                            borderColor: "var(--ox-border)",
                            backgroundColor: "var(--ox-bg-alt)",
                          }}
                        >
                          <Download className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--ox-accent)" />
                          <span className="text-xs">
                            <span className="block font-bold text-(--ox-text-h)">
                              {m.label}
                            </span>
                            <span className="text-(--ox-text-muted)">
                              {hit.name}
                            </span>
                          </span>
                        </a>
                      ) : (
                        <span
                          className="flex items-start gap-2 rounded-lg border px-3 py-2"
                          style={{
                            borderColor: "var(--ox-border)",
                            backgroundColor: "var(--ox-bg-alt)",
                          }}
                        >
                          <Download className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--ox-text-muted)/40" />
                          <span className="text-xs">
                            <span className="block font-bold text-(--ox-text-h)">
                              {m.label}
                            </span>
                            <span className="text-(--ox-text-muted)">
                              {m.hint}
                            </span>
                          </span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
