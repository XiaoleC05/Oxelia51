import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../api'
import './Portfolio.css'

function Portfolio() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet('/portfolio')
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="portfolio-status">加载中...</p>
  if (error) return <p className="portfolio-status portfolio-error">{error}</p>

  return (
    <div className="portfolio-page">
      <header className="portfolio-header">
        <h1>作品集</h1>
        <p>本地 <code>code</code> 目录下的全部项目</p>
      </header>
      <div className="portfolio-grid">
        {items.map((item) => (
          <article key={item.slug} className="portfolio-card">
            <h2>{item.name}</h2>
            <p>{item.description || '暂无描述'}</p>
            <div className="portfolio-links">
              {item.linked_tool_slug && (
                <Link to={`/tools/${item.linked_tool_slug}`}>在线工具</Link>
              )}
              {item.github_repo && (
                <a
                  href={`https://github.com/${item.github_repo}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

export default Portfolio
