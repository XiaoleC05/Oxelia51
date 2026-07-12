import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { apiGet, getToken, getStoredUser, canUseTool, BADGE_LABEL } from '../api'
import './Tools.css'
import './Portfolio.css'

function Tools() {
  const navigate = useNavigate()
  const token = getToken()
  const user = getStoredUser()
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTabState] = useState(() => {
    const t = searchParams.get('tab')
    return t === 'portfolio' ? 'portfolio' : 'tools'
  })
  const setActiveTab = (next) => {
    setActiveTabState(next)
    setSearchParams({ tab: next }, { replace: true })
  }
  const [portfolio, setPortfolio] = useState([])
  const [portfolioLoading, setPortfolioLoading] = useState(false)

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

  useEffect(() => {
    if (activeTab !== 'portfolio' || portfolio.length > 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortfolioLoading(true)
    apiGet('/portfolio')
      .then(setPortfolio)
      .catch(() => {})
      .finally(() => setPortfolioLoading(false))
  }, [activeTab, portfolio.length])

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
        <h1>工具</h1>
        <p className="tools-subtitle">平台所有在线工具</p>
      </header>

      <div className="tools-tabs">
        <button
          className={`tools-tab${activeTab === 'tools' ? ' tools-tab--active' : ''}`}
          onClick={() => setActiveTab('tools')}
        >
          工具
        </button>
        <button
          className={`tools-tab${activeTab === 'portfolio' ? ' tools-tab--active' : ''}`}
          onClick={() => setActiveTab('portfolio')}
        >
          作品
        </button>
      </div>

      {activeTab === 'tools' && (
        tools.length === 0 ? (
          <div className="tools-empty">
            <p>暂无内容</p>
          </div>
        ) : (
          <div className="tools-list">
            {tools.map((t, idx) => (
              <div key={t.slug} className="tool-row">
                <div className="tool-info">
                  <h2 className="tool-name">
                    {t.name}
                    {idx === 0 && t.badge === 'open' && (
                      <span className="tool-recommend">推荐</span>
                    )}
                  </h2>
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
                    {canUseTool(t, user) ? '进入' : '详情'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === 'portfolio' && (
        <div className="portfolio-list">
          {portfolioLoading ? (
            <p className="tools-status">载入中…</p>
          ) : portfolio.length === 0 ? (
            <div className="tools-empty"><p>暂无内容</p></div>
          ) : (
            portfolio.map((item) => (
              <article key={item.slug} className="portfolio-row">
                <div className="portfolio-info">
                  <h2>{item.name}</h2>
                  <p>{item.description || '\u2014'}</p>
                </div>
                <div className="portfolio-links">
                  {item.linked_tool_slug && (
                    <Link to={`/tools/${item.linked_tool_slug}`}>在线工具</Link>
                  )}
                  {item.github_repo && (
                    <a href={`https://github.com/${item.github_repo}`} target="_blank" rel="noreferrer">GitHub</a>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default Tools
