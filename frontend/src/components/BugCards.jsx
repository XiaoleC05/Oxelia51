import { useState } from 'react'
import './BugCards.css'

/* ===== Vite ?raw 导入 Markdown 文件作为字符串 =====
 * 路径：src/components/ → ../ = src/ → ../../ = frontend/ → ../../../ = Oxelia51/
 * Markdown 文件位于 Oxelia51/docs/superpowers/bugs/
 */
import bug001 from '../../../docs/superpowers/bugs/001-superread-apikey-mask.md?raw'
import bug002 from '../../../docs/superpowers/bugs/002-smartkb-date-scan.md?raw'
import bug003 from '../../../docs/superpowers/bugs/003-brief-utc-timezone.md?raw'
import bug004 from '../../../docs/superpowers/bugs/004-webhook-concurrency.md?raw'
import bug005 from '../../../docs/superpowers/bugs/005-nginx-405-tool-webhook.md?raw'
import bug006 from '../../../docs/superpowers/bugs/006-frontend-paren-render.md?raw'
import bug007 from '../../../docs/superpowers/bugs/007-sse-type-mismatch.md?raw'
import bug008 from '../../../docs/superpowers/bugs/008-fetch-interval-unit.md?raw'

const BUG_FILES = [
  bug001, bug002, bug003, bug004,
  bug005, bug006, bug007, bug008,
]

/* ===== 解析 Markdown：提取标题 + 字段键值对 =====
 * 格式：
 *   # 标题
 *
 *   - **key**: value
 */
function parseBug(md) {
  const lines = md.split('\n').map((l) => l.trim()).filter(Boolean)
  const titleLine = lines.find((l) => l.startsWith('# ')) || ''
  const title = titleLine.replace(/^#\s+/, '')
  const fields = {}
  lines.forEach((line) => {
    const m = line.match(/^-\s+\*\*(.+?)\*\*[:：]\s*(.+)$/)
    if (m) {
      fields[m[1]] = m[2]
    }
  })
  return { title, fields, raw: md }
}

const BUGS = BUG_FILES.map(parseBug)

/* 字段中文名映射（用于卡片头部小标签） */
const FIELD_LABELS = {
  '场景': 'scenario',
  '发现 Agent': 'discover',
  '修复 Agent': 'fixer',
  '根因': 'cause',
  '修复方案': 'fix',
  '结果': 'result',
  '提交': 'commit',
  '日期': 'date',
}

/* Agent 对应的颜色 class */
function agentClass(name) {
  if (!name) return ''
  if (name.includes('Claude')) return 'bug-agent--claude'
  if (name.includes('Trae')) return 'bug-agent--trae'
  if (name.includes('Qoder')) return 'bug-agent--qoder'
  if (name.includes('Codex')) return 'bug-agent--codex'
  return ''
}

function BugCards() {
  const [expanded, setExpanded] = useState(null)

  return (
    <section className="bug-cards" aria-label="Bug 案例">
      <h2 className="bug-cards-title">Bug 案例 · AI 协作修复</h2>
      <p className="bug-cards-sub">
        以下案例来自实际开发中由 Claude Code 发现、Qoder 修复的真实问题
      </p>
      <div className="bug-cards-grid">
        {BUGS.map((bug, i) => {
          const isOpen = expanded === i
          return (
            <article
              key={i}
              className={`bug-card ${isOpen ? 'bug-card--open' : ''}`}
              onClick={() => setExpanded(isOpen ? null : i)}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setExpanded(isOpen ? null : i)
                }
              }}
            >
              <header className="bug-card-head">
                <span className="bug-card-id">#{String(i + 1).padStart(3, '0')}</span>
                <h3 className="bug-card-title">{bug.title}</h3>
              </header>
              <div className="bug-card-meta">
                {bug.fields['发现 Agent'] && (
                  <span className={`bug-agent ${agentClass(bug.fields['发现 Agent'])}`}>
                    发现 · {bug.fields['发现 Agent']}
                  </span>
                )}
                {bug.fields['修复 Agent'] && (
                  <span className={`bug-agent ${agentClass(bug.fields['修复 Agent'])}`}>
                    修复 · {bug.fields['修复 Agent']}
                  </span>
                )}
                {bug.fields['日期'] && (
                  <span className="bug-date">{bug.fields['日期']}</span>
                )}
              </div>
              {bug.fields['场景'] && (
                <p className="bug-card-scenario">{bug.fields['场景']}</p>
              )}
              {isOpen && (
                <div className="bug-card-detail">
                  {bug.fields['根因'] && (
                    <div className="bug-detail-row">
                      <span className="bug-detail-label">根因</span>
                      <span className="bug-detail-value">{bug.fields['根因']}</span>
                    </div>
                  )}
                  {bug.fields['修复方案'] && (
                    <div className="bug-detail-row">
                      <span className="bug-detail-label">修复方案</span>
                      <span className="bug-detail-value">{bug.fields['修复方案']}</span>
                    </div>
                  )}
                  {bug.fields['结果'] && (
                    <div className="bug-detail-row">
                      <span className="bug-detail-label">结果</span>
                      <span className="bug-detail-value">{bug.fields['结果']}</span>
                    </div>
                  )}
                  {bug.fields['提交'] && (
                    <a
                      className="bug-commit"
                      href={bug.fields['提交']}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      查看提交 →
                    </a>
                  )}
                </div>
              )}
              <span className="bug-card-toggle" aria-hidden="true">
                {isOpen ? '收起 ▲' : '展开 ▼'}
              </span>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default BugCards
