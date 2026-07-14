import './DevTimeline.css'

/* ===== AI 协作时间线 — 静态硬编码数据 =====
 * 当前仅展示 SuperRead 工具的开发时间线
 * 后续可扩展为多工具时间线
 */
const TIMELINE = [
  {
    phase: '需求 & 设计',
    date: '2026-06-20',
    agent: 'Claude',
    desc: '撰写 spec：RSS 抓取 + AI 摘要 + 每日简报',
  },
  {
    phase: '前端骨架',
    date: '2026-06-25',
    agent: 'Trae',
    desc: 'ToolShell + 订阅管理 UI 落地',
  },
  {
    phase: '后端 RAG',
    date: '2026-07-01',
    agent: 'Qoder',
    desc: 'pgvector 向量化 + 文档摄入管线',
  },
  {
    phase: 'Bug 修复',
    date: '2026-07-05',
    agent: 'Codex',
    desc: '审查 8 个 bug 案例，回归测试通过',
  },
  {
    phase: '上线',
    date: '2026-07-10',
    agent: 'Trae',
    desc: 'Nginx + systemd 部署到生产',
  },
]

const AGENT_ICON = {
  Claude: 'C',
  Trae: 'T',
  Qoder: 'Q',
  Codex: 'X',
}

function DevTimeline() {
  return (
    <section className="dev-timeline" aria-label="AI 协作时间线">
      <h2 className="dev-timeline-title">AI 协作时间线 · SuperRead</h2>
      <div className="dev-timeline-track">
        {TIMELINE.map((node, i) => (
          <div
            key={i}
            className="dev-timeline-node"
            style={{ '--idx': i }}
          >
            <div className="dev-timeline-line" aria-hidden="true" />
            <div
              className={`dev-timeline-dot dev-timeline-dot--${node.agent}`}
              title={`${node.agent} · ${node.date}`}
            >
              {AGENT_ICON[node.agent] || '?'}
            </div>
            <div className="dev-timeline-content">
              <span className="dev-timeline-phase">{node.phase}</span>
              <span className="dev-timeline-date">{node.date}</span>
              <span className="dev-timeline-desc">{node.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default DevTimeline
