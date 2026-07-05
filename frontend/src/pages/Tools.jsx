import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

  if (loading) return <p className="tools-status">加载中...</p>
  if (error) return <p className="tools-status tools-error">{error}</p>

  return (
    <div className="tools-page">
      <header className="tools-header">
        <h1>工具目录</h1>
        <p className="tools-subtitle">探索所有可用工具</p>
      </header>

      {tools.length === 0 ? (
        <div className="tools-empty">
          <p>暂无可用工具</p>
        </div>
      ) : (
        <div className="tools-grid">
          {tools.map((t) => (
            <div key={t.slug} className="tool-card">
              <div className="tool-card-header">
                <h3 className="tool-name">{t.name}</h3>
                <span className={`tool-badge tool-badge--${t.badge || 'open'}`}>
                  {BADGE_LABEL[t.badge] || BADGE_LABEL.open}
                </span>
              </div>
              <p className="tool-desc">{t.description || '暂无描述'}</p>
              {t.release_url && (
                <div className="tool-card-footer">
                  <a href={t.release_url} target="_blank" rel="noreferrer" className="tool-release-link">
                    下载桌面版
                  </a>
                </div>
              )}
              <div className="tool-card-footer">
                <button
                  type="button"
                  className="tool-use-btn"
                  onClick={() => {
                    if (!token) {
                      navigate('/login', { state: { from: `/tools/${t.slug}` } })
                      return
                    }
                    navigate(`/tools/${t.slug}`)
                  }}
                >
                  {t.badge === 'open' || user?.role === 'admin' ? '进入使用' : '查看详情'}
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
