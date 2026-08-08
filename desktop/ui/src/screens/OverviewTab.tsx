import { useState } from "react";
import { fmtCost, fmtTokens, type ModelStat, type Overview, type ProjectStat, type TrendPoint } from "../api";
import { EmptyState } from "../EmptyState";
import { copyText, PROXY_CMD } from "../clipboard";

/** 复制代理配置命令，返回是否成功（成功时短暂提示按钮文字）。 */
function useCopyCmd() {
  const [copied, setCopied] = useState(false);
  return {
    copied,
    copy: async () => {
      if (await copyText(PROXY_CMD)) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    },
  };
}

function StatCard({ label, tokens, requests, cost }: { label: string; tokens: number; requests: number; cost: number }) {
  return (
    <div className="card stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value tabular">{fmtTokens(tokens)}</span>
      <span className="stat-sub tabular">请求 {requests} · {fmtCost(cost)}</span>
    </div>
  );
}

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  const max = Math.max(1, ...trend.map((t) => t.tokens));
  return (
    <div className="card">
      <h2 className="card-title">近 14 天用量趋势</h2>
      {trend.length === 0 ? (
        <EmptyState compact title="趋势待有数据后展示" desc="代理落账后按天自动聚合。" />
      ) : (
        <div className="trend">
          {trend.map((t) => (
            <div key={t.date} className="trend-col" title={`${t.date} · ${fmtTokens(t.tokens)}`}>
              <div className="trend-bar" style={{ height: `${Math.max(3, (t.tokens / max) * 100)}%` }} />
              <span className="trend-label">{t.date.slice(5)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Ranking({ title, rows }: { title: string; rows: { name: string; tokens: number; requests: number; cost: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.tokens));
  return (
    <div className="card">
      <h2 className="card-title">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState compact title="暂无排行数据" desc="落账后按维度自动聚合。" />
      ) : (
        <div className="rank">
          {rows.map((r) => (
            <div key={r.name} className="rank-row">
              <span className="rank-name">{r.name}</span>
              <div className="rank-track">
                <div className="rank-fill" style={{ width: `${Math.max(2, (r.tokens / max) * 100)}%` }} />
              </div>
              <span className="rank-val tabular">
                {fmtTokens(r.tokens)} · {fmtCost(r.cost)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentSessions({ sessions }: { sessions: { sessionId: string; tokens: number; requests: number; lastTs: string }[] }) {
  return (
    <div className="card">
      <h2 className="card-title">最近会话</h2>
      {sessions.length === 0 ? (
        <EmptyState compact title="暂无会话" desc="代理落账后按 session_id 自动聚合。" />
      ) : (
        <ul className="session-list">
          {sessions.map((s) => (
            <li key={s.sessionId} className="session-row">
              <span className="session-id">{s.sessionId.slice(0, 12)}</span>
              <span className="session-meta tabular">{fmtTokens(s.tokens)} · {s.requests} 次</span>
              <span className="session-ts">{s.lastTs.slice(5, 16)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OverviewTab({ data, online }: { data: Overview | null; online: boolean }) {
  const { copied, copy } = useCopyCmd();
  // 全新安装零数据：整屏引导空态，不展示空卡片/占位
  const isEmpty = online && data != null && data.total.tokens === 0;

  if (isEmpty) {
    return (
      <>
        <EmptyState
          title="还没有 Token 记录"
          desc="把模型工具的 BASE_URL 指向本地代理即可开始记账。复制下面的命令到你的 Claude Code / Cursor 终端："
          action={{ label: copied ? "已复制 ✓" : "复制代理命令", onClick: () => void copy() }}
        />
      </>
    );
  }

  return (
    <>
      {!online && (
        <div className="offline-banner">
          sidecar 未运行。请配置 Claude Code / Cursor 的代理指向{" "}
          <code>http://127.0.0.1:17800</code>。
        </div>
      )}
      <section className="stats">
        <StatCard label="今日" tokens={data?.today.tokens ?? 0} requests={data?.today.requests ?? 0} cost={data?.today.cost ?? 0} />
        <StatCard label="近 7 日" tokens={data?.week.tokens ?? 0} requests={data?.week.requests ?? 0} cost={data?.week.cost ?? 0} />
        <StatCard label="近 30 日" tokens={data?.month.tokens ?? 0} requests={data?.month.requests ?? 0} cost={data?.month.cost ?? 0} />
        <StatCard label="累计" tokens={data?.total.tokens ?? 0} requests={data?.total.requests ?? 0} cost={data?.total.cost ?? 0} />
      </section>
      <TrendChart trend={data?.trend ?? []} />
      <section className="grid-2">
        <Ranking title="按模型" rows={(data?.byModel ?? []).map((m: ModelStat) => ({ name: m.model, tokens: m.tokens, requests: m.requests, cost: m.cost }))} />
        <Ranking title="按项目" rows={(data?.byProject ?? []).map((p: ProjectStat) => ({ name: p.projectId, tokens: p.tokens, requests: p.requests, cost: p.cost }))} />
      </section>
      <RecentSessions sessions={data?.sessions ?? []} />
    </>
  );
}
