import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchArticle, fetchArticles } from '../api'
import ScrollProgress from '../components/ScrollProgress'
import './ArticleDetail.css'

function ArticleDetail() {
  const { id } = useParams()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [relatedArticles, setRelatedArticles] = useState([])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLoading(true)
    setError('')
    fetchArticle(id)
      .then((data) => {
        setArticle(data)
        // Fetch related articles (same category)
        if (data.category) {
          fetchArticles(data.category).then((list) => {
            setRelatedArticles(
              list.filter((a) => a.id !== data.id).slice(0, 3)
            )
          }).catch(() => {})
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (loading) {
    return (
      <div className="article-detail-page">
        <div className="article-detail">
          <div className="skeleton skeleton-title" style={{ height: '28px', marginBottom: '16px' }} />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text" style={{ width: '40%' }} />
          <div style={{ marginTop: '40px' }}>
            <div className="skeleton skeleton-text" style={{ width: '80%' }} />
            <div className="skeleton skeleton-text" style={{ width: '90%' }} />
            <div className="skeleton skeleton-text" style={{ width: '60%' }} />
            <div className="skeleton skeleton-text" style={{ width: '85%' }} />
            <div className="skeleton skeleton-text" style={{ width: '45%' }} />
          </div>
        </div>
      </div>
    )
  }

  if (error) return <p className="article-detail-status article-detail-error">{error}</p>
  if (!article) return <p className="article-detail-status">文章不存在。</p>

  const hasContent = article.content && article.content.trim().length > 0

  // Reading time: Chinese ~400 chars/min
  const readingTime = (() => {
    if (!hasContent) return null
    const text = article.content.replace(/<[^>]+>/g, '')
    const chars = text.length
    const minutes = Math.max(1, Math.round(chars / 400))
    return `约 ${minutes} 分钟`
  })()

  return (
    <div className="article-detail-page">
      <ScrollProgress selector=".article-detail-content" />
      <article className="article-detail">
        <header className="article-detail-header">
          <h1 className="article-detail-title">{article.title}</h1>
          <div className="article-detail-meta">
            {article.category && (
              <span className="article-detail-cat">{article.category}</span>
            )}
            {article.published_at && (
              <span className="article-detail-date">
                {new Date(article.published_at).toLocaleDateString('zh-CN')}
              </span>
            )}
            {readingTime && (
              <span className="article-detail-readtime">{readingTime}</span>
            )}
          </div>
          {Array.isArray(article.tags) && article.tags.length > 0 && (
            <div className="article-detail-tags">
              {article.tags.map((tag) => (
                <span key={tag} className="article-detail-tag">{tag}</span>
              ))}
            </div>
          )}
        </header>

        {hasContent ? (
          <div
            className="article-detail-content"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        ) : (
          <div className="article-detail-empty">
            <p>本文暂无正文内容。</p>
            {article.url && (
              <a
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="article-detail-ext-link"
              >
                阅读原文 &rarr;
              </a>
            )}
          </div>
        )}

        {hasContent && article.url && (
          <div className="article-detail-source">
            <a
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="article-detail-ext-link"
            >
              查看原文 &rarr;
            </a>
          </div>
        )}

        {/* Related articles */}
        {relatedArticles.length > 0 && (
          <section className="article-detail-related">
            <h3 className="article-detail-related-title">相关文章</h3>
            <div className="article-detail-related-list">
              {relatedArticles.map((a) => (
                <Link
                  key={a.id}
                  to={`/blog/${a.id}`}
                  className="article-detail-related-item"
                >
                  <span className="article-detail-related-name">{a.title}</span>
                  {a.published_at && (
                    <span className="article-detail-related-date">
                      {new Date(a.published_at).toLocaleDateString('zh-CN')}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        <footer className="article-detail-footer">
          <Link to="/blog" className="article-detail-back">&larr; 返回博客</Link>
        </footer>
      </article>
    </div>
  )
}

export default ArticleDetail
