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
        // API 返回 { images, autoplay_interval_ms }
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

  const goTo = (index) => {
    setCurrent(index)
    startTimer()
  }

  const goPrev = () => {
    setCurrent((prev) => (prev - 1 + total) % total)
    startTimer()
  }

  const goNext = () => {
    setCurrent((prev) => (prev + 1) % total)
    startTimer()
  }

  return (
    <main className="landing">
      {/* ---- Hero Carousel ---- */}
      <section className="hero-carousel" aria-label="头图轮播">
        {hasImages ? (
          images.map((img, i) => (
            <div
              key={img.id}
              className={`hero-carousel-slide ${i === current ? 'hero-carousel-slide--active' : ''}`}
              style={{ backgroundImage: `url(${img.image_url})` }}
              aria-hidden={i !== current}
            />
          ))
        ) : (
          /* Default hero: CSS gradient fallback */
          <div className="hero-carousel-slide hero-carousel-slide--active hero-carousel-slide--default" />
        )}

        {/* Overlay gradient + text */}
        <div className="hero-carousel-overlay" />

        {hasImages && (
          <div className="hero-carousel-text">
            <h2 className="hero-carousel-title">{images[current]?.title || ''}</h2>
            {images[current]?.subtitle && (
              <p className="hero-carousel-subtitle">{images[current].subtitle}</p>
            )}
          </div>
        )}

        {/* Default hero text when no images */}
        {!hasImages && (
          <div className="hero-carousel-text">
            <h2 className="hero-carousel-title">Oxelia<span className="landing-hero-sup">51</span></h2>
            <p className="hero-carousel-subtitle">统一在线工具平台</p>
          </div>
        )}

        {/* Arrows */}
        {hasImages && (
          <>
            <button className="hero-carousel-arrow hero-carousel-arrow--left" onClick={goPrev} aria-label="上一张">
              &#10094;
            </button>
            <button className="hero-carousel-arrow hero-carousel-arrow--right" onClick={goNext} aria-label="下一张">
              &#10095;
            </button>
          </>
        )}

        {/* Dots */}
        {hasImages && total > 1 && (
          <div className="hero-carousel-dots">
            {images.map((img, i) => (
              <button
                key={img.id}
                className={`hero-carousel-dot ${i === current ? 'hero-carousel-dot--active' : ''}`}
                onClick={() => goTo(i)}
                aria-label={`第 ${i + 1} 张`}
              />
            ))}
          </div>
        )}
      </section>

      {/* ---- Existing Landing content ---- */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <p className="landing-hero-chapter">一</p>
          <h1 className="landing-hero-title">Oxelia<span className="landing-hero-sup">51</span></h1>
          <p className="landing-hero-sub">统一在线工具平台</p>
          <p className="landing-hero-desc">
            一个账号，探索全部在线工具。<br />
            不追逐潮流，只做好用的小工具。
          </p>
          <nav className="landing-hero-actions">
            <Link to="/tools" className="landing-hero-cta">浏览工具</Link>
            <Link to="/portfolio" className="landing-hero-link">作品集</Link>
          </nav>
        </div>
      </section>

      {/* ---- Light content section ---- */}
      <section className="landing-body">
        <div className="landing-body-inner">
          <p className="landing-body-lead">
            作品集展示 <code>code</code> 目录下的全部项目，
            每个工具均为独立开源仓库，可独立部署与使用。
          </p>
          <div className="landing-body-links">
            <a href="https://github.com/XiaoleC05/Oxelia51" target="_blank" rel="noreferrer" className="landing-footnote-link">
              GitHub &rarr;
            </a>
            <a href="https://xiaolec05.github.io" target="_blank" rel="noreferrer" className="landing-footnote-link">
              Blog &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* ---- Dark footer ---- */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <p className="landing-footer-links">
            <a href="https://github.com/XiaoleC05/Oxelia51" target="_blank" rel="noreferrer">GitHub</a>
            <span className="landing-sep">/</span>
            <a href="https://xiaolec05.github.io" target="_blank" rel="noreferrer">Blog</a>
          </p>
          <p className="landing-signature"><em>by ChenXiaole</em></p>
        </div>
      </footer>
    </main>
  )
}

export default Landing
