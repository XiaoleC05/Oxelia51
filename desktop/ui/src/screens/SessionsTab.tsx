import { useCallback, useEffect, useState } from "react";
import {
  fetchSessionDetail,
  fetchSessions,
  fmtCost,
  fmtTokens,
  type SessionDetail,
  type SessionStat,
} from "../api";
import { EmptyState } from "../EmptyState";
import { copyText, PROXY_CMD } from "../clipboard";

function SessionDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchSessionDetail(id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <p className="empty">加载失败：{error}</p>;
  if (!detail) return <p className="empty">加载中…</p>;

  return (
    <>
      <button type="button" className="link-btn" onClick={onBack}>
        ← 返回会话列表
      </button>
      <h1 className="page-title">会话 {detail.session.sessionId.slice(0, 12)}</h1>
      <div className="card">
        <div className="list-stats tabular">
          <span>{fmtTokens(detail.session.tokens)} tokens</span>
          <span>{detail.session.requests} 次</span>
          <span>{fmtCost(detail.session.cost)}</span>
          <span>{detail.session.lastTs.slice(0, 19)}</span>
        </div>
      </div>

      <h2 className="card-title">按模型</h2>
      <div className="card">
        {detail.models.length === 0 ? (
          <p className="empty">无</p>
        ) : (
          <div className="rank">
            {detail.models.map((m) => (
              <div key={m.model} className="rank-row">
                <span className="rank-name">{m.model}</span>
                <div className="rank-track">
                  <div className="rank-fill" style={{ width: `${Math.min(100, (m.tokens / Math.max(1, detail.models[0].tokens)) * 100)}%` }} />
                </div>
                <span className="rank-val tabular">{fmtTokens(m.tokens)} · {fmtCost(m.cost)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="card-title">最近请求</h2>
      <div className="card">
        {detail.events.length === 0 ? (
          <p className="empty">无</p>
        ) : (
          <ul className="event-list">
            {detail.events.map((e, i) => (
              <li key={i} className="event-row">
                <span className="event-model">{e.model}</span>
                <span className="event-meta tabular">{fmtTokens(e.tokens)} · {e.durationMs}ms</span>
                <span className="event-ts">{e.ts.slice(5, 19)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function SessionsTab() {
  const [sessions, setSessions] = useState<SessionStat[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setSessions((await fetchSessions()).sessions);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (selected) {
    return <SessionDetailView id={selected} onBack={() => setSelected(null)} />;
  }

  const copy = async () => {
    if (await copyText(PROXY_CMD)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <h1 className="page-title">会话</h1>
      {error && <p className="empty">加载失败：{error}</p>}
      {sessions.length === 0 && !error && (
        <EmptyState
          title="暂无会话"
          desc="代理落账后按 session_id 自动聚合。先配置模型工具指向本地代理："
          action={{ label: copied ? "已复制 ✓" : "复制代理命令", onClick: () => void copy() }}
        />
      )}
      <div className="card-list">
        {sessions.map((s) => (
          <button
            key={s.sessionId}
            type="button"
            className="card list-row clickable"
            onClick={() => setSelected(s.sessionId)}
          >
            <div className="list-main">
              <span className="list-title">{s.sessionId.slice(0, 12)}</span>
              <span className="list-sub">
                {s.projectId} · {s.models} 模型 · 最近 {s.lastTs.slice(5, 16)}
              </span>
            </div>
            <div className="list-stats tabular">
              <span>{fmtTokens(s.tokens)}</span>
              <span>{s.requests} 次</span>
              <span>{fmtCost(s.cost)}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
