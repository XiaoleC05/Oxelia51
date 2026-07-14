import './DevTimeline.css'

/* ===== AI 协作时间线 — Agent 职责描述 =====
 * 6 个节点对应 Oxelia51 多 Agent 协作流程
 * 每个节点展示阶段名 + Agent + 一行职责描述
 */
const TIMELINE = [
  {
    phase: '需求分析',
    agent: 'Claude',
    role: 'Claude Code',
    desc: '理解需求、拆分任务、分配给各智能体',
  },
  {
    phase: '架构设计',
    agent: 'Claude',
    role: 'Claude Code',
    desc: '设计架构、API 规范、数据库模式',
  },
  {
    phase: '后端实现',
    agent: 'Qoder',
    role: 'Qoder',
    desc: '业务逻辑、API、数据库、定时任务',
  },
  {
    phase: '前端开发',
    agent: 'Trae',
    role: 'Trae Work',
    desc: 'UI 组件、页面布局、动画、响应式',
  },
  {
    phase: '审查测试',
    agent: 'Codex',
    role: 'Codex',
    desc: '代码审查、测试覆盖、文档同步',
  },
  {
    phase: '部署上线',
    agent: 'Claude',
    role: 'Claude Code',
    desc: 'Git 合并、SSH 部署、systemctl restart',
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
      <h2 className="dev-timeline-title">AI 协作时间线</h2>
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
              title={`${node.role}`}
            >
              {AGENT_ICON[node.agent] || '?'}
            </div>
            <div className="dev-timeline-content">
              <span className="dev-timeline-phase">{node.phase}</span>
              <span className="dev-timeline-agent">{node.role}</span>
              <span className="dev-timeline-desc">{node.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default DevTimeline
