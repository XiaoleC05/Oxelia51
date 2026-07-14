import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { fetchHeroImages, fetchArticles, apiGet } from '../api'
import { SkeletonLine } from '../components/Skeleton'
import DevTimeline from '../components/DevTimeline'
import BugCards from '../components/BugCards'
import './Landing.css'

const DEFAULT_INTERVAL = 5000

function useCountUp(target, duration = 1500) {
  const [count, setCount] = useState(0)
  const started = useRef(false)
  const elRef = useRef(null)

  useEffect(() => {
    if (!target || target <= 0) return
    const el = elRef.current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const start = performance.now()
        const step = (now) => {
          const elapsed = now - start
          const progress = Math.min(elapsed / duration, 1)
          setCount(Math.round(target * (1 - Math.pow(1 - progress, 3))))
          if (progress < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
        observer.disconnect()
      }
    }, { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, duration])

  const ref = useCallback((node) => { elRef.current = node }, [])
  return [count, ref]
}

function Landing() {
  const [images, setImages] = useState([])
  const [current, setCurrent] = useState(0)
  const [autoplayMs, setAutoplayMs] = useState(DEFAULT_INTERVAL)
  const timerRef = useRef(null)
  const [tools, setTools] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [articles, setArticles] = useState([])
  const [uptime, setUptime] = useState(null) // { days, hours }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchHeroImages().catch(() => null),
      apiGet('/tools').catch(() => []),
      apiGet('/portfolio').catch(() => []),
      fetchArticles().catch(() => []),
      apiGet('/uptime').catch(() => null),
    ]).then(([hero, toolsData, portfolioData, articlesData, uptimeData]) => {
      if (hero) {
        setImages(hero.images || [])
        if (hero.autoplay_interval_ms) setAutoplayMs(hero.autoplay_interval_ms)
      }
      setTools(toolsData || [])
      setPortfolio(portfolioData || [])
      setArticles(articlesData || [])
      if (uptimeData) setUptime(uptimeData)
    }).finally(() => setLoading(false))
  }, [])

  const total = images.length
  const hasImages = total > 0

  /* ---- 动态注入 <link rel="preload"> 预加载首张头图（LCP 优化） ----
   * 首页头图 URL 来自 API（动态），无法在 index.html 中硬编码
   * 获取到首张 URL 后注入 preload link，让浏览器尽早开始下载
   */
  useEffect(() => {
    if (!hasImages || !images[0]?.image_url) return
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = images[0].image_url
    link.fetchPriority = 'high'
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [hasImages, images])

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

  const [toolsNum, toolsCountRef] = useCountUp(loading ? 0 : tools.length)
  const [portfolioNum, portfolioCountRef] = useCountUp(loading ? 0 : portfolio.length)
  const [articlesNum, articlesCountRef] = useCountUp(loading ? 0 : articles.length)

  return (
    <main className="landing">
      <section className="hero" aria-label="头图轮播">
        {/* 隐藏 <img> 元素：为浏览器提供 fetchpriority / loading 提示，
            配合 backgroundImage div 使用浏览器缓存 */}
        {hasImages && images.map((img, i) => (
          <img
            key={`preload-${img.id}`}
            src={img.image_url}
            alt=""
            aria-hidden="true"
            fetchPriority={i === 0 ? 'high' : 'auto'}
            loading={i === 0 ? 'eager' : 'lazy'}
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
          />
        ))}
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

        <div className="hero-overlay" />

        <div className="hero-content">
          <img src="/assets/image/head-logo.png" className="hero-logo" alt="Oxelia51" />
          <span className="hero-brand">Oxelia51</span>
          {images[current]?.title && <h1 className="hero-title">{images[current].title}</h1>}
          {images[current]?.subtitle && <p className="hero-subtitle">{images[current].subtitle}</p>}
        </div>

        {hasImages && (
          <>
            <button className="hero-arrow hero-arrow--left" onClick={goPrev} aria-label="上一张">&#10094;</button>
            <button className="hero-arrow hero-arrow--right" onClick={goNext} aria-label="下一张">&#10095;</button>
          </>
        )}

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

        <button className="hero-scroll-hint" onClick={() => {
          document.getElementById('landing-content')?.scrollIntoView({ behavior: 'smooth' })
        }} aria-label="向下滚动">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </section>

      <section className="landing-stats" id="landing-content" aria-label="数据概览">
        <div className="landing-stats-inner">
          <div className="landing-stat landing-stat--uptime">
            <span className="landing-stat-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            {loading ? (
              <SkeletonLine width="140px" height="36px" />
            ) : (
              <span className="landing-stat-num landing-stat-num--text">
                {uptime?.days ?? 0}<span className="landing-stat-unit">天</span>
                {uptime?.hours ?? 0}<span className="landing-stat-unit">小时</span>
              </span>
            )}
            <span className="landing-stat-label">运行时长</span>
          </div>
          <div className="landing-stat" ref={toolsCountRef}>
            <span className="landing-stat-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </span>
            {loading ? <SkeletonLine width="60px" height="36px" /> : <span className="landing-stat-num count-up">{toolsNum}</span>}
            <span className="landing-stat-label">在线工具</span>
          </div>
          <div className="landing-stat" ref={portfolioCountRef}>
            <span className="landing-stat-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM6 14a8 8 0 0 1 8-8" /><circle cx="9" cy="9" r="1.5" fill="currentColor" /><circle cx="15" cy="15" r="1.5" fill="currentColor" />
              </svg>
            </span>
            {loading ? <SkeletonLine width="60px" height="36px" /> : <span className="landing-stat-num count-up">{portfolioNum}</span>}
            <span className="landing-stat-label">开源作品</span>
          </div>
          <div className="landing-stat" ref={articlesCountRef}>
            <span className="landing-stat-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" />
              </svg>
            </span>
            {loading ? <SkeletonLine width="60px" height="36px" /> : <span className="landing-stat-num count-up">{articlesNum}</span>}
            <span className="landing-stat-label">技术文章</span>
          </div>
        </div>
      </section>

      {/* 网站导览 */}
      <section className="landing-guide" aria-label="网站导览">
        <Link to="/tools" className="guide-card">
          <span className="guide-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
          </span>
          <span className="guide-title">工具</span>
          <span className="guide-desc">RSS 阅读 · 电费监控 · 知识库 · 更多</span>
        </Link>
        <Link to="/blog" className="guide-card">
          <span className="guide-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></svg>
          </span>
          <span className="guide-title">博客</span>
          <span className="guide-desc">技术文章 · 项目笔记</span>
        </Link>
        <Link to="/about" className="guide-card">
          <span className="guide-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </span>
          <span className="guide-title">关于</span>
          <span className="guide-desc">开发者介绍 · 联系方式</span>
        </Link>
        <Link to="/admin" className="guide-card">
          <span className="guide-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </span>
          <span className="guide-title">管理</span>
          <span className="guide-desc">后台管理 · 仅管理员</span>
        </Link>
      </section>

      <DevTimeline />
      <BugCards />

      <div className="landing-footer-transition" />

      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div className="landing-footer-brand">
            <div className="landing-footer-logo">Oxelia51</div>
          </div>
          <div className="landing-footer-links">
            <div className="landing-footer-col">
              <span className="landing-footer-col-title">导航</span>
              <Link to="/tools">工具</Link>
              <Link to="/blog">博客</Link>
              <Link to="/about">关于</Link>
            </div>
            <div className="landing-footer-col">
              <span className="landing-footer-col-title">链接</span>
              <a href="https://github.com/XiaoleC05/Oxelia51" target="_blank" rel="noreferrer">GitHub</a>
              <a href="https://xiaolec05.github.io" target="_blank" rel="noreferrer">Blog</a>
              <Link to="/friends">友情链接</Link>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Oxelia51</span>
          <span className="landing-footer-sep">·</span>
          <span>by 陈晓乐</span>
        </div>
        <div className="landing-footer-filing">
          <a
            href="https://beian.miit.gov.cn/"
            rel="noreferrer"
            target="_blank"
            className="landing-footer-filing-link"
          >
            鲁ICP备2026038838号-1
          </a>
        </div>
      </footer>
    </main>
  )
}

export default Landing
