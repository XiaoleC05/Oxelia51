import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { fetchHeroImages, fetchArticles, apiGet } from '../api'
import './Landing.css'

const DEFAULT_INTERVAL = 5000

function Landing() {
  const [images, setImages] = useState([])
  const [current, setCurrent] = useState(0)
  const [autoplayMs, setAutoplayMs] = useState(DEFAULT_INTERVAL)
  const timerRef = useRef(null)
  const [tools, setTools] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [articles, setArticles] = useState([])

  useEffect(() => {
    Promise.all([
      fetchHeroImages().catch(() => null),
      apiGet('/tools').catch(() => []),
      apiGet('/portfolio').catch(() => []),
      fetchArticles().catch(() => []),
    ]).then(([hero, toolsData, portfolioData, articlesData]) => {
      if (hero) {
        setImages(hero.images || [])
        if (hero.autoplay_interval_ms) setAutoplayMs(hero.autoplay_interval_ms)
      }
      setTools(toolsData || [])
      setPortfolio(portfolioData || [])
      setArticles(articlesData || [])
    })
  }, [])

  const total = images.length
  const hasImages = total > 0

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    if (!hasImages) return
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % total)
    }, autoplayMs)
  }, [hasImages, total, stopTimer, autoplayMs])

  useEffect(() => {
    startTimer()
    return stopTimer
  }, [startTimer, stopTimer])

  const goTo = (index) => { setCurrent(index); startTimer() }
  const goPrev = () => { setCurrent((prev) => (prev - 1 + total) % total); startTimer() }
  const goNext = () => { setCurrent((prev) => (prev + 1) % total); startTimer() }

  return (
    <main className="landing">
      {/* ===== Fluid 全屏头图 ===== */}
      <section className="hero" aria-label="头图轮播">
        {hasImages ? (
          images.map((img, i) => (
            <div
              key={img.id}
              className={`hero-slide ${i === current ? 'hero-slide--active' : ''}`}
              style={{ backgroundImage: `url(${img.image_url})` }}
              aria-hidden={i !== current}
            />
          ))
        ) : (
          <div className="hero-slide hero-slide--active hero-slide--default" />
        )}

        {/* 渐变遮罩 */}
        <div className="hero-overlay" />

        {/* 居中单行标题 */}
        <div className="hero-content">
          <h1 className="hero-title">
            {hasImages && images[current]?.title
              ? images[current].title
              : 'Oxelia51 · 统一在线工具平台'}
          </h1>
        </div>

        {/* 左右箭头 */}
        {hasImages && (
          <>
            <button className="hero-arrow hero-arrow--left" onClick={goPrev} aria-label="上一张">&#10094;</button>
            <button className="hero-arrow hero-arrow--right" onClick={goNext} aria-label="下一张">&#10095;</button>
          </>
        )}

        {/* 圆点指示器 */}
        {hasImages && total > 1 && (
          <div className="hero-dots">
            {images.map((img, i) => (
              <button
                key={img.id}
                className={`hero-dot ${i === current ? 'hero-dot--active' : ''}`}
                onClick={() => goTo(i)}
                aria-label={`第 ${i + 1} 张`}
              />
            ))}
          </div>
        )}

        {/* 向下箭头 */}
        <button className="hero-scroll-hint" onClick={() => {
          document.getElementById('landing-content')?.scrollIntoView({ behavior: 'smooth' })
        }} aria-label="向下滚动">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </section>

      {/* ===== 内容区：Fluid 极简风格 ===== */}
      <section className="landing-intro" id="landing-content">
        <h2 className="landing-intro-brand">Oxelia51</h2>
        <p className="landing-intro-desc">
          一个账号，探索全部在线工具。不追逐潮流，只做好用的小工具。
        </p>
        <div className="landing-intro-links">
          <Link to="/tools" className="landing-intro-link">浏览工具</Link>
          <Link to="/portfolio" className="landing-intro-link">作品集</Link>
        </div>
      </section>

      {/* ===== 热门工具 ===== */}
      {tools.length > 0 && (
        <section className="landing-section">
          <div className="landing-section-head">
            <h2 className="landing-section-title">热门工具</h2>
            <Link to="/tools" className="landing-section-link">查看全部 &rarr;</Link>
          </div>
          <div className="landing-card-grid">
            {tools.slice(0, 4).map((tool) => (
              <div key={tool.slug} className="landing-card">
                <div className="landing-card-body">
                  <h3 className="landing-card-name">{tool.name}</h3>
                  <p className="landing-card-desc">{tool.description || '\u2014'}</p>
                  {tool.badge && (
                    <span className="landing-card-badge">{tool.badge === 'open' ? '已开放' : tool.badge === 'closed_to_users' ? '暂未开放' : '已下线'}</span>
                  )}
                </div>
                <div className="landing-card-foot">
                  <Link to={`/tools/${tool.slug}`} className="landing-card-link">进入工具 &rarr;</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== 热门作品 ===== */}
      {portfolio.length > 0 && (
        <section className="landing-section">
          <div className="landing-section-head">
            <h2 className="landing-section-title">热门作品</h2>
            <Link to="/portfolio" className="landing-section-link">查看全部 &rarr;</Link>
          </div>
          <div className="landing-card-grid">
            {portfolio.slice(0, 4).map((item) => (
              <div key={item.slug} className="landing-card">
                <div className="landing-card-body">
                  <h3 className="landing-card-name">{item.name}</h3>
                  <p className="landing-card-desc">{item.description || '\u2014'}</p>
                </div>
                <div className="landing-card-foot">
                  {item.github_repo && (
                    <a
                      href={`https://github.com/${item.github_repo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="landing-card-link"
                    >
                      GitHub &rarr;
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== 最新文章 ===== */}
      {articles.length > 0 && (
        <section className="landing-section">
          <div className="landing-section-head">
            <h2 className="landing-section-title">最新文章</h2>
            <Link to="/blog" className="landing-section-link">
              博客 &rarr;
            </Link>
          </div>
          <div className="landing-article-list">
            {articles.slice(0, 6).map((article) => (
              <Link
                key={article.id}
                to={`/blog/${article.id}`}
                className="landing-article-row"
              >
                <div className="landing-article-main">
                  <div className="landing-article-head">
                    <h3 className="landing-article-title">
                      {article.title}
                      <svg className="landing-article-ext" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 2h8v8M14 2L4 12M11 8v4a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1h4"/>
                      </svg>
                    </h3>
                    {article.published_at && (
                      <span className="landing-article-date">
                        {new Date(article.published_at).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </div>
                  {article.category && (
                    <span className="landing-article-cat">{article.category}</span>
                  )}
                  {article.summary && (
                    <p className="landing-article-summary">{article.summary}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ===== Footer：Fluid 分栏风格 ===== */}
      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div className="landing-footer-brand">
            <div className="landing-footer-logo">Oxelia51</div>
            <p className="landing-footer-desc">一个账号，探索全部在线工具。</p>
          </div>
          <div className="landing-footer-links">
            <div className="landing-footer-col">
              <span className="landing-footer-col-title">导航</span>
              <Link to="/tools">工具</Link>
              <Link to="/portfolio">作品</Link>
              <Link to="/blog">博客</Link>
              <Link to="/about">关于</Link>
            </div>
            <div className="landing-footer-col">
              <span className="landing-footer-col-title">链接</span>
              <a href="https://github.com/XiaoleC05/Oxelia51" target="_blank" rel="noreferrer">GitHub</a>
              <a href="https://xiaolec05.github.io" target="_blank" rel="noreferrer">Blog</a>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Oxelia51</span>
          <span className="landing-footer-sep">·</span>
          <span>by ChenXiaole</span>
        </div>
      </footer>
    </main>
  )
}

export default Landing
