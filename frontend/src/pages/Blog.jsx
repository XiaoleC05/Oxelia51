import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { fetchArticles, fetchCategories, getStoredUser, getToken } from '../api'
import './Blog.css'

function Blog() {
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const user = getStoredUser()
  const token = getToken()
  const isAdmin = token && user?.role === 'admin'

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

  // Build tag cloud from ALL articles (not just filtered)
  const tagCloud = useMemo(() => {
    const tagMap = {}
    articles.forEach((a) => {
      if (Array.isArray(a.tags)) {
        a.tags.forEach((t) => {
          tagMap[t] = (tagMap[t] || 0) + 1
        })
      }
    })
    const entries = Object.entries(tagMap).sort((a, b) => b[1] - a[1])
    const maxCount = entries.length > 0 ? entries[0][1] : 1
    return entries.map(([tag, count]) => ({
      tag,
      count,
      size: 0.75 + (count / maxCount) * 0.45, // 0.75rem ~ 1.2rem
    }))
  }, [articles])

  // Client-side tag filter
  const filteredArticles = useMemo(() => {
    if (!selectedTag) return articles
    return articles.filter((a) => Array.isArray(a.tags) && a.tags.includes(selectedTag))
  }, [articles, selectedTag])

  const handleTagClick = (tag) => {
    setSelectedTag((prev) => (prev === tag ? '' : tag))
  }

  return (
    <div className="blog-page">
      <header className="blog-header">
        <div className="blog-header-text">
          <h1>博客</h1>
          <p className="blog-subtitle">技术随笔与思考</p>
        </div>
        {isAdmin && (
          <Link to="/admin" className="blog-admin-btn">+ 新建文章</Link>
        )}
      </header>

      <div className="blog-layout">
        {/* 侧栏 */}
        <aside className="blog-sidebar">
          {/* 分类 */}
          <h3 className="blog-sidebar-title">分类</h3>
          <ul className="blog-cat-list">
            <li>
              <button
                className={`blog-cat-btn ${selectedCat === '' ? 'blog-cat-btn--active' : ''}`}
                onClick={() => { setSelectedCat(''); setSelectedTag('') }}
              >
                全部
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.category}>
                <button
                  className={`blog-cat-btn ${selectedCat === c.category ? 'blog-cat-btn--active' : ''}`}
                  onClick={() => { setSelectedCat(c.category); setSelectedTag('') }}
                >
                  {c.category}
                  <span className="blog-cat-count">{c.count}</span>
                </button>
              </li>
            ))}
          </ul>

          {/* 标签云 */}
          {tagCloud.length > 0 && (
            <div className="blog-tag-cloud">
              <h3 className="blog-sidebar-title">标签</h3>
              <div className="blog-tag-list">
                {tagCloud.map(({ tag, count, size }) => (
                  <button
                    key={tag}
                    className={`blog-tag-item ${selectedTag === tag ? 'blog-tag-item--active' : ''}`}
                    style={{ fontSize: `${size}rem` }}
                    onClick={() => handleTagClick(tag)}
                  >
                    {tag}
                    <span className="blog-tag-count">{count}</span>
                  </button>
                ))}
              </div>
              {selectedTag && (
                <button
                  className="blog-tag-clear"
                  onClick={() => setSelectedTag('')}
                >
                  清除筛选
                </button>
              )}
            </div>
          )}
        </aside>

        {/* 文章列表 */}
        <main className="blog-main">
          {loading && <p className="blog-status">载入中…</p>}
          {error && <p className="blog-status blog-error">{error}</p>}

          {!loading && !error && filteredArticles.length === 0 && (
            <div className="blog-empty">
              <p>暂无文章。</p>
            </div>
          )}

          {!loading && !error && filteredArticles.length > 0 && (
            <div className="blog-list">
              {filteredArticles.map((article) => (
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
