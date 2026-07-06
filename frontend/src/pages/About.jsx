import { useState, useEffect } from 'react'
import { fetchPage } from '../api'
import './About.css'

function About() {
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPage('about')
      .then(setPage)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="about-status">载入中…</p>
  if (error) return <p className="about-status about-error">{error}</p>
  if (!page) return <p className="about-status">页面不存在或未启用。</p>

  return (
    <div className="about-page">
      <article className="about-article">
        <header className="about-header">
          <h1>{page.title}</h1>
        </header>
        <div
          className="about-content"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      </article>
    </div>
  )
}

export default About
