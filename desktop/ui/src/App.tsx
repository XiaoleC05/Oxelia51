import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { fetchHealth, fetchOverview, fetchSettings, saveSetting, type Overview } from "./api";
import { APP_VERSION, checkForUpdate, type UpdateInfo } from "./version";
import { OverviewTab } from "./screens/OverviewTab";
import { ProjectsTab } from "./screens/ProjectsTab";
import { SessionsTab } from "./screens/SessionsTab";
import { AlertsTab } from "./screens/AlertsTab";
import { SettingsTab } from "./screens/SettingsTab";
import glyphLight from "./assets/brand-glyph-light.png";
import glyphDark from "./assets/brand-glyph-dark.png";
import wordLight from "./assets/wordart-light.svg";
import wordDark from "./assets/wordart-dark.svg";
import "./app.css";

/**
 * 用系统浏览器打开外链（#29）。
 * Tauri 内走 opener 插件；浏览器 dev 模式回退 window.open。
 */
async function openExternal(url: string) {
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank");
  }
}

/** 是否运行在 Tauri 壳内（浏览器 dev 模式下无窗口 API，自绘控件需隐藏）。 */
const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
/** macOS 保留原生红黄绿交通灯，不自绘窗口按钮。 */
const isMac = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.userAgent);

/**
 * 自绘窗口控制（Windows/Linux，无边框标题栏）：最小化 / 最大化还原 / 关闭。
 * 最大化图标随窗口状态切换；Aero Snap / 拖到顶部最大化后同步状态。
 */
function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    let alive = true;
    let unlisten: (() => void) | undefined;
    void win.isMaximized().then((m) => alive && setMaximized(m));
    void win
      .onResized(() => {
        void win.isMaximized().then((m) => alive && setMaximized(m));
      })
      .then((fn) => (unlisten = fn));
    return () => {
      alive = false;
      unlisten?.();
    };
  }, []);

  return (
    <div className="win-controls">
      <button
        type="button"
        className="win-btn"
        onClick={() => void getCurrentWindow().minimize()}
        title="最小化"
        aria-label="最小化"
      >
        <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
          <path d="M0 5h10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button
        type="button"
        className="win-btn"
        onClick={() => void getCurrentWindow().toggleMaximize()}
        title={maximized ? "还原" : "最大化"}
        aria-label={maximized ? "还原" : "最大化"}
      >
        {maximized ? (
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
            <path
              d="M2.5 0.5v2H0.5v7h7V7.5h2v-7z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
            <rect
              x="0.5"
              y="0.5"
              width="9"
              height="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="win-btn win-close"
        onClick={() => void getCurrentWindow().close()}
        title="关闭"
        aria-label="关闭"
      >
        <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
          <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Oxelia51 桌面端（P3.2）。
 * 顶部标签导航：总览 / 项目 / 会话 / 告警 / 设置。
 * 数据源：本地 sidecar 只读统计接口；总览由 App 轮询，其余屏各自轮询。
 */

type TabKey = "overview" | "projects" | "sessions" | "alerts" | "settings";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "总览" },
  { key: "projects", label: "项目" },
  { key: "sessions", label: "会话" },
  { key: "alerts", label: "告警" },
  { key: "settings", label: "设置" },
];

export default function App() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [data, setData] = useState<Overview | null>(null);
  const [online, setOnline] = useState(false);
  const [theme, setTheme] = useState<"cosmos" | "cozy">("cosmos");
  const [update, setUpdate] = useState<UpdateInfo>({ available: false });

  // 启动时检查一次新版本
  useEffect(() => {
    void checkForUpdate().then(setUpdate);
  }, []);

  // 启动时读取已保存的主题（设置页/顶栏切换会持久化）
  useEffect(() => {
    void fetchSettings()
      .then((s) => {
        if (s.theme === "cosmos" || s.theme === "cozy") setTheme(s.theme);
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === "cosmos" ? "cozy" : "cosmos";
      void saveSetting("theme", next).catch(() => {});
      return next;
    });
  };

  const refresh = useCallback(async () => {
    const [overview, health] = await Promise.all([
      fetchOverview().catch(() => null),
      fetchHealth(),
    ]);
    setData(overview);
    setOnline(health);
  }, []);

  // 轮询 sidecar（总览数据由 App 持有，其他屏各自轮询）
  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="app" data-platform={isMac ? "mac" : "win"}>
      {/* 无边框标题栏：整条顶栏为拖曳区（deep：子元素空白也可拖，按钮仍点击），
          空白处双击切换最大化；右上为自绘窗口三键（macOS 保留原生交通灯，不渲染）。 */}
      <header
        className="topbar"
        data-tauri-drag-region="deep"
        onDoubleClick={(e) => {
          if (!isTauri) return;
          const t = e.target as HTMLElement;
          if (t.closest(".tab, .win-btn, .theme-toggle, .status")) return;
          void getCurrentWindow().toggleMaximize();
        }}
      >
        <div className="brand">
          <img
            className="brand-glyph"
            src={theme === "cosmos" ? glyphDark : glyphLight}
            alt=""
            draggable={false}
          />
          <img
            className="brand-wordmark"
            src={theme === "cosmos" ? wordDark : wordLight}
            alt="oxelia51"
            draggable={false}
          />
        </div>

        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          {online ? (
            <span className="status ok">
              <span className="dot" />
              代理在线 · :17800
            </span>
          ) : (
            <button
              type="button"
              className="status down clickable"
              onClick={() => {
                setTab("settings");
                setTimeout(() => {
                  document
                    .getElementById("proxy-section")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 120);
              }}
            >
              <span className="dot" />
              代理离线 · 点击排查
            </button>
          )}
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            title="切换主题"
          >
            {theme === "cosmos" ? "☀" : "☾"}
          </button>
          {isTauri && !isMac && <WindowControls />}
        </div>
      </header>

      <main className="content">
        {update.available && update.url && (() => {
          // 闭包内 TS 不窄化 update.url，取局部变量保证类型非空
          const url = update.url;
          return (
            <a
              className="update-banner"
              href={url}
              onClick={(e) => {
                // #29：外链交给系统浏览器（webview 内 window.open 不可靠）
                e.preventDefault();
                void openExternal(url);
              }}
            >
              ⬆ 发现新版本 {update.latest}（当前 {APP_VERSION}）——点击前往下载
            </a>
          );
        })()}
        {tab === "overview" && <OverviewTab data={data} online={online} />}
        {tab === "projects" && <ProjectsTab />}
        {tab === "sessions" && <SessionsTab />}
        {tab === "alerts" && <AlertsTab />}
        {tab === "settings" && (
          <SettingsTab theme={theme} onTheme={setTheme} appVersion={APP_VERSION} />
        )}
      </main>
    </div>
  );
}
