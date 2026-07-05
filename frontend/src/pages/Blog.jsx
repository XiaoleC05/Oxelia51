import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchArticles, fetchCategories } from '../api'
import './Blog.css'

function Blog() {
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCat, setSelectedCat] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    Promise.all([
      fetchArticles(selectedCat || undefined).catch(() => []),
      fetchCategories().catch(() => []),
    ])
      .then(([articlesData, catsData]) => {
        setArticles(articlesData)
        setCategories(catsData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedCat])

  return (
    <div className="blog-page">
      <header className="blog-header">
        <p className="chapter-num">博</p>
        <h1>博客</h1>
        <p className="blog-subtitle">技术随笔与思考</p>
      </header>

      <div className="blog-layout">
        {/* 分类侧栏 */}
        <aside className="blog-sidebar">
          <h3 className="blog-sidebar-title">分类</h3>
          <ul className="blog-cat-list">
            <li>
              <button
                className={`blog-cat-btn ${selectedCat === '' ? 'blog-cat-btn--active' : ''}`}
                onClick={() => setSelectedCat('')}
              >
                全部
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.category}>
                <button
                  className={`blog-cat-btn ${selectedCat === c.category ? 'blog-cat-btn--active' : ''}`}
                  onClick={() => setSelectedCat(c.category)}
                >
                  {c.category}
                  <span className="blog-cat-count">{c.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* 文章列表 */}
        <main className="blog-main">
          {loading && <p className="blog-status">载入中…</p>}
          {error && <p className="blog-status blog-error">{error}</p>}

          {!loading && !error && articles.length === 0 && (
            <div className="blog-empty">
              <p>暂无文章。</p>
            </div>
          )}

          {!loading && !error && articles.length > 0 && (
            <div className="blog-list">
              {articles.map((article) => (
                <article key={article.id} className="blog-item">
                  <div className="blog-item-main">
                    <div className="blog-item-head">
                      <h2 className="blog-item-title">
                        <Link to={`/blog/${article.id}`}>{article.title}</Link>
                      </h2>
                      {article.published_at && (
                        <span className="blog-item-date">
                          {new Date(article.published_at).toLocaleDateString('zh-CN')}
                        </span>
                      )}
                    </div>
                    <div className="blog-item-meta">
                      {article.category && (
                        <span className="blog-item-cat">{article.category}</span>
                      )}
                      {Array.isArray(article.tags) && article.tags.length > 0 && article.tags.map((tag) => (
                        <span key={tag} className="blog-item-tag">{tag}</span>
                      ))}
                    </div>
                    {article.summary && (
                      <p className="blog-item-summary">{article.summary}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default Blog
