import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { fetchHeroImages } from '../api'
import './Landing.css'

const DEFAULT_INTERVAL = 5000

function Landing() {
  const [images, setImages] = useState([])
  const [current, setCurrent] = useState(0)
  const [autoplayMs, setAutoplayMs] = useState(DEFAULT_INTERVAL)
  const timerRef = useRef(null)

  useEffect(() => {
    fetchHeroImages()
      .then((data) => {
        setImages(data.images || [])
        if (data.autoplay_interval_ms) setAutoplayMs(data.autoplay_interval_ms)
      })
      .catch(() => {})
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

      <section className="landing-links-row">
        <a href="https://github.com/XiaoleC05/Oxelia51" target="_blank" rel="noreferrer">GitHub</a>
        <span className="landing-links-sep">·</span>
        <a href="https://xiaolec05.github.io" target="_blank" rel="noreferrer">Blog</a>
      </section>

      {/* ===== Footer ===== */}
      <footer className="landing-footer">
        <span>by ChenXiaole</span>
      </footer>
    </main>
  )
}

export default Landing
