import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchArticle } from '../api'
import './ArticleDetail.css'

function ArticleDetail() {
  const { id } = useParams()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetchArticle(id)
      .then(setArticle)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="article-detail-status">载入中…</p>
  if (error) return <p className="article-detail-status article-detail-error">{error}</p>
  if (!article) return <p className="article-detail-status">文章不存在。</p>

  const hasContent = article.content && article.content.trim().length > 0

  return (
    <div className="article-detail-page">
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

        <footer className="article-detail-footer">
          <Link to="/blog" className="article-detail-back">&larr; 返回博客</Link>
        </footer>
      </article>
    </div>
  )
}

export default ArticleDetail
