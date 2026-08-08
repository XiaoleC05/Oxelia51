import { useCallback, useEffect, useState } from "react";
import { fetchProjects, fmtCost, fmtTokens, fmtDate, type ProjectStat } from "../api";

export function ProjectsTab() {
  const [projects, setProjects] = useState<ProjectStat[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setProjects((await fetchProjects()).projects);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <>
      <h1 className="page-title">项目</h1>
      {error && <p className="empty">加载失败：{error}</p>}
      {projects.length === 0 && !error && (
        <p className="empty">暂无项目——代理落账后按 project_id 自动聚合。</p>
      )}
      <div className="card-list">
        {projects.map((p) => (
          <div key={p.projectId} className="card list-row">
            <div className="list-main">
              <span className="list-title">{p.projectId}</span>
              <span className="list-sub">
                {p.models} 个模型 · 最近 {fmtDate(p.lastTs)}
              </span>
            </div>
            <div className="list-stats tabular">
              <span>{fmtTokens(p.tokens)}</span>
              <span>{p.requests} 次</span>
              <span>{fmtCost(p.cost)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
