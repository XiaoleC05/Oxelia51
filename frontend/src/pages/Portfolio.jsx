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

  if (loading) return <p className="portfolio-status">载入中…</p>
  if (error) return <p className="portfolio-status portfolio-error">{error}</p>

  return (
    <div className="portfolio-page">
      <header className="portfolio-header">
        <h1>作品集</h1>
        <p>精心挑选的项目与工具</p>
      </header>

      <div className="portfolio-list">
        {items.map((item) => (
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
