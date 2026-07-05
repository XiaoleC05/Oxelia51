import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  apiGet,
  canUseTool,
  getStoredUser,
  getToken,
  BADGE_LABEL,
} from '../api'
import DormGuardTool from '../tools/dormguard/DormGuardTool'
import SuperReadTool from '../tools/superread/SuperReadTool'
import MusicBoxTool from '../tools/musicbox/MusicBoxTool'
import CS2LabTool from '../tools/cs2lab/CS2LabTool'
import AIHelperTool from '../tools/aihelper/AIHelperTool'
import AgentCanvasTool from '../tools/agentcanvas/AgentCanvasTool'
import './ToolShell.css'

const TOOL_VIEWS = {
  dormguard: DormGuardTool,
  superread: SuperReadTool,
  musicbox: MusicBoxTool,
  cs2lab: CS2LabTool,
  aihelper: AIHelperTool,
  agentcanvas: AgentCanvasTool,
}

function ToolShell() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [tool, setTool] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const user = getStoredUser()
  const token = getToken()

  useEffect(() => {
    apiGet(`/tools/${slug}`)
      .then(setTool)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    if (!loading && tool && !token) {
      navigate('/login', { state: { from: `/tools/${slug}` } })
    }
  }, [loading, tool, token, slug, navigate])

  if (loading) return <p className="tool-shell-status">加载中...</p>
  if (error) return <p className="tool-shell-status tool-shell-error">{error}</p>
  // 未登录时立即返回 null，不渲染工具页内容，避免闪现后跳转
  if (!token) return null
  if (!tool) return null

  const usable = canUseTool(tool, user)
  const View = TOOL_VIEWS[slug]

  return (
    <div className="tool-shell">
      <header className="tool-shell-header">
        <Link to="/tools" className="tool-shell-back">← 工具目录</Link>
        <h1>{tool.name}</h1>
        <span className={`tool-shell-badge tool-shell-badge--${tool.badge}`}>
          {BADGE_LABEL[tool.badge] || tool.badge}
        </span>
        {tool.description && <p className="tool-shell-desc">{tool.description}</p>}
      </header>

      {token && !usable && (
        <div className="tool-shell-blocked">
          <p>该工具暂未对普通用户开放。</p>
          {user?.role !== 'admin' && (
            <p className="tool-shell-muted">管理者可在后台开启 user_accessible。</p>
          )}
        </div>
      )}

      {token && usable && !View && (
        <p className="tool-shell-muted">工具壳 UI 待接入（slug: {slug}）</p>
      )}

      {token && usable && View && <View />}
    </div>
  )
}

export default ToolShell
