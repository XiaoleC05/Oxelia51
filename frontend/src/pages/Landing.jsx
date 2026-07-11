import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { fetchHeroImages, fetchArticles, apiGet, getToken } from '../api'
import { SkeletonLine } from '../components/Skeleton'
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

function useReveal() {
  return useCallback((node) => {
    if (!node) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        node.classList.add('reveal--visible')
        io.disconnect()
      }
    }, { rootMargin: '0px 0px -60px 0px', threshold: 0.12 })
    io.observe(node)
  }, [])
}

function Typewriter({ text, onComplete }) {
  const [displayed, setDisplayed] = useState(() => (text || '').charAt(0))
  const idxRef = useRef(1)
  const timerRef = useRef(null)
  const [cursor, setCursor] = useState(true)

  useEffect(() => {
    idxRef.current = 0
    const textToType = text || ''

    timerRef.current = setInterval(() => {
      idxRef.current++
      if (idxRef.current <= textToType.length) {
        setDisplayed(textToType.slice(0, idxRef.current))
      } else {
        clearInterval(timerRef.current)
        onComplete?.()
      }
    }, 80)

    return () => clearInterval(timerRef.current)
  }, [text, onComplete])

  useEffect(() => {
    const cursorTimer = setInterval(() => setCursor((c) => !c), 500)
    return () => clearInterval(cursorTimer)
  }, [])

  return (
    <span>
      <span>{displayed}</span>
      <span className="hero-cursor" style={{ opacity: cursor ? 1 : 0 }}>|</span>
    </span>
  )
}

function Landing() {
  const [images, setImages] = useState([])
  const [current, setCurrent] = useState(0)
  const [autoplayMs, setAutoplayMs] = useState(DEFAULT_INTERVAL)
  const timerRef = useRef(null)
  const [tools, setTools] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const reveal = useReveal()

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
    }).finally(() => setLoading(false))
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

  const heroText = hasImages && images[current]?.title
    ? images[current].title
    : '集成·简洁·高效'

  const onTypewriterComplete = useCallback(() => {}, [])

  const [toolsNum, toolsCountRef] = useCountUp(loading ? 0 : tools.length)
  const [portfolioNum, portfolioCountRef] = useCountUp(loading ? 0 : portfolio.length)
  const [articlesNum, articlesCountRef] = useCountUp(loading ? 0 : articles.length)

  const isLoggedIn = !!getToken()

  return (
    <main className="landing">
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

        <div className="hero-overlay" />

        <div className="hero-content">
          <span className="hero-brand">Oxelia51</span>
          <h1 className="hero-title">
            <Typewriter
              key={`${current}-${heroText}`}
              text={heroText}
              onComplete={onTypewriterComplete}
            />
          </h1>
          <p className="hero-subtitle">做了一些小工具，写了一些东西，都放在这里。</p>
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

      <section className="landing-stats" aria-label="数据概览">
        <div className="landing-stats-inner">
          <div className="landing-stat" ref={toolsCountRef}>
            {loading ? <SkeletonLine width="40px" height="28px" /> : <span className="landing-stat-num count-up">{toolsNum}</span>}
            <span className="landing-stat-label">在线工具</span>
          </div>
          <div className="landing-stat-divider" />
          <div className="landing-stat" ref={portfolioCountRef}>
            {loading ? <SkeletonLine width="40px" height="28px" /> : <span className="landing-stat-num count-up">{portfolioNum}</span>}
            <span className="landing-stat-label">开源作品</span>
          </div>
          <div className="landing-stat-divider" />
          <div className="landing-stat" ref={articlesCountRef}>
            {loading ? <SkeletonLine width="40px" height="28px" /> : <span className="landing-stat-num count-up">{articlesNum}</span>}
            <span className="landing-stat-label">技术文章</span>
          </div>
        </div>
      </section>

      <div className="landing-content-sections">
        <section className="landing-intro" id="landing-content" ref={reveal}>
          <h2 className="landing-intro-brand">Oxelia51</h2>
          <p className="landing-intro-desc">
            一个开发者的站点。工具、作品、笔记，都放在一起。
          </p>
          <div className="landing-intro-links">
            <Link to="/tools" className="landing-intro-link">浏览工具</Link>
          </div>
        </section>

        <section className="landing-cta" ref={reveal}>
          <div className="landing-cta-inner">
            <h2 className="landing-cta-title">注册一个账号</h2>
            <p className="landing-cta-desc">注册后可以在线使用全部工具。</p>
            <div className="landing-cta-actions">
              {isLoggedIn ? (
                <Link to="/tools" className="landing-cta-btn landing-cta-btn--primary">浏览工具</Link>
              ) : (
                <>
                  <Link to="/register" className="landing-cta-btn landing-cta-btn--primary">免费注册</Link>
                  <Link to="/login" className="landing-cta-btn landing-cta-btn--ghost">已有账号？登录</Link>
                </>
              )}
            </div>
          </div>
        </section>

      </div>

      <div className="landing-footer-transition" />

      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div className="landing-footer-brand">
            <div className="landing-footer-logo">Oxelia51</div>
            <p className="landing-footer-desc">集成·简洁·高效</p>
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
          <span>ICP备案号：蜀ICP备XXXXXXXX号-1</span>
          <span className="landing-footer-sep">|</span>
          <span>公安部备案号：川公网安备 XXXXXXXXXXXX号</span>
        </div>
      </footer>
    </main>
  )
}

export default Landing
