import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, getToken, getStoredUser, BADGE_LABEL } from '../api'
import './Tools.css'

function Tools() {
  const navigate = useNavigate()
  const token = getToken()
  const user = getStoredUser()
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const data = await apiGet('/tools')
        setTools(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchTools()
  }, [])

  if (loading) return <p className="tools-status">载入中…</p>
  if (error) return <p className="tools-status tools-error">{error}</p>

  const handleEnter = (t) => {
    if (!token) {
      navigate('/login', { state: { from: `/tools/${t.slug}` } })
      return
    }
    navigate(`/tools/${t.slug}`)
  }

  return (
    <div className="tools-page">
      <header className="tools-header">
        <p className="chapter-num">二</p>
        <h1>工具</h1>
        <p className="tools-subtitle">平台所有在线工具</p>
      </header>

      {tools.length === 0 ? (
        <div className="tools-empty">
          <p>尚无工具。</p>
        </div>
      ) : (
        <div className="tools-list">
          {tools.map((t) => (
            <div key={t.slug} className="tool-row">
              <div className="tool-info">
                <h2 className="tool-name">{t.name}</h2>
                <p className="tool-desc">{t.description || '\u2014'}</p>
                {t.release_url && (
                  <a href={t.release_url} target="_blank" rel="noreferrer" className="tool-release-link">
                    下载桌面版
                  </a>
                )}
              </div>
              <div className="tool-meta">
                <span className={`tool-badge tool-badge--${t.badge || 'open'}`}>
                  {BADGE_LABEL[t.badge] || BADGE_LABEL.open}
                </span>
                <button
                  type="button"
                  className="tool-enter"
                  onClick={() => handleEnter(t)}
                >
                  {t.badge === 'open' || user?.role === 'admin' ? '进入' : '详情'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Tools
