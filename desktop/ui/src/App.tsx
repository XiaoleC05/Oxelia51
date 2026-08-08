import { useCallback, useEffect, useState } from "react";
import {
  fetchHealth,
  fetchOverview,
  fmtTokens,
  type ModelStat,
  type Overview,
  type ProjectStat,
  type SessionStat,
  type TrendPoint,
} from "./api";
import "./app.css";

/**
 * Oxelia51 桌面端「总览」屏（P3.1 最小版）。
 * 数据源：本地 sidecar 的只读统计接口（/api/overview）。
 * 5 秒轮询刷新；sidecar 离线时顶栏红灯提示。
 */

function StatCard({
  label,
  tokens,
  requests,
}: {
  label: string;
  tokens: number;
  requests: number;
}) {
  return (
    <div className="card stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value tabular">{fmtTokens(tokens)}</span>
      <span className="stat-sub tabular">请求 {requests}</span>
    </div>
  );
}

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  const max = Math.max(1, ...trend.map((t) => t.tokens));
  return (
    <div className="card">
      <h2 className="card-title">近 14 天用量趋势</h2>
      {trend.length === 0 ? (
        <p className="empty">还没有数据——配置代理指向 127.0.0.1:17800 后自动落账。</p>
      ) : (
        <div className="trend">
          {trend.map((t) => (
            <div key={t.date} className="trend-col" title={`${t.date} · ${fmtTokens(t.tokens)}`}>
              <div
                className="trend-bar"
                style={{ height: `${Math.max(3, (t.tokens / max) * 100)}%` }}
              />
              <span className="trend-label">{t.date.slice(5)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModelRanking({ byModel }: { byModel: ModelStat[] }) {
  const max = Math.max(1, ...byModel.map((m) => m.tokens));
  return (
    <div className="card">
      <h2 className="card-title">按模型</h2>
      {byModel.length === 0 ? (
        <p className="empty">暂无数据</p>
      ) : (
        <div className="rank">
          {byModel.map((m) => (
            <div key={m.model} className="rank-row">
              <span className="rank-name">{m.model}</span>
              <div className="rank-track">
                <div
                  className="rank-fill"
                  style={{ width: `${Math.max(2, (m.tokens / max) * 100)}%` }}
                />
              </div>
              <span className="rank-val tabular">
                {fmtTokens(m.tokens)} · {m.requests} 次
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectRanking({ byProject }: { byProject: ProjectStat[] }) {
  const max = Math.max(1, ...byProject.map((p) => p.tokens));
  return (
    <div className="card">
      <h2 className="card-title">按项目</h2>
      {byProject.length === 0 ? (
        <p className="empty">暂无数据</p>
      ) : (
        <div className="rank">
          {byProject.map((p) => (
            <div key={p.projectId} className="rank-row">
              <span className="rank-name">{p.projectId}</span>
              <div className="rank-track">
                <div
                  className="rank-fill"
                  style={{ width: `${Math.max(2, (p.tokens / max) * 100)}%` }}
                />
              </div>
              <span className="rank-val tabular">
                {fmtTokens(p.tokens)} · {p.requests} 次
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentSessions({ sessions }: { sessions: SessionStat[] }) {
  return (
    <div className="card">
      <h2 className="card-title">最近会话</h2>
      {sessions.length === 0 ? (
        <p className="empty">暂无数据</p>
      ) : (
        <ul className="session-list">
          {sessions.map((s) => (
            <li key={s.sessionId} className="session-row">
              <span className="session-id">{s.sessionId.slice(0, 12)}</span>
              <span className="session-meta tabular">
                {fmtTokens(s.tokens)} · {s.requests} 次
              </span>
              <span className="session-ts">{s.lastTs.slice(5, 19)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<Overview | null>(null);
  const [online, setOnline] = useState(false);
  const [theme, setTheme] = useState<"cosmos" | "cozy">("cosmos");

  const refresh = useCallback(async () => {
    const [overview, health] = await Promise.all([
      fetchOverview().catch(() => null),
      fetchHealth(),
    ]);
    setData(overview);
    setOnline(health);
  }, []);

  // 轮询 sidecar：外部系统（本地网关进程），非派生状态
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
        {!online && (
          <div className="offline-banner">
            sidecar 未运行。请配置 Claude Code / Cursor 的代理指向{" "}
            <code>http://127.0.0.1:17800</code>。
          </div>
        )}

        <section className="stats">
          <StatCard label="今日" tokens={data?.today.tokens ?? 0} requests={data?.today.requests ?? 0} />
          <StatCard label="近 7 日" tokens={data?.week.tokens ?? 0} requests={data?.week.requests ?? 0} />
          <StatCard label="近 30 日" tokens={data?.month.tokens ?? 0} requests={data?.month.requests ?? 0} />
          <StatCard label="累计" tokens={data?.total.tokens ?? 0} requests={data?.total.requests ?? 0} />
        </section>

        <TrendChart trend={data?.trend ?? []} />

        <section className="grid-2">
          <ModelRanking byModel={data?.byModel ?? []} />
          <ProjectRanking byProject={data?.byProject ?? []} />
        </section>

        <RecentSessions sessions={data?.sessions ?? []} />
      </main>
    </div>
  );
}
