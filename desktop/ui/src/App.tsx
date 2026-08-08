import { useCallback, useEffect, useState } from "react";
import { fetchHealth, fetchOverview, type Overview } from "./api";
import { APP_VERSION, checkForUpdate, type UpdateInfo } from "./version";
import { OverviewTab } from "./screens/OverviewTab";
import { ProjectsTab } from "./screens/ProjectsTab";
import { SessionsTab } from "./screens/SessionsTab";
import { AlertsTab } from "./screens/AlertsTab";
import { SettingsTab } from "./screens/SettingsTab";
import "./app.css";

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
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-glyph" />
          <span className="brand-name">Oxelia51</span>
          <span className="brand-sub">本地账本</span>
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
          <span className={`status ${online ? "ok" : "down"}`}>
            <span className="dot" />
            {online ? "代理在线 · :17800" : "代理离线"}
          </span>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "cosmos" ? "cozy" : "cosmos"))}
            title="切换主题"
          >
            {theme === "cosmos" ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <main className="content">
        {update.available && update.url && (
          <a className="update-banner" href={update.url} target="_blank" rel="noreferrer">
            ⬆ 发现新版本 {update.latest}（当前 {APP_VERSION}）——点击前往下载
          </a>
        )}
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
