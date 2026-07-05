import { useState, useEffect } from 'react'

function ScrollProgress({ selector }) {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    let rafId = null
    const handleScroll = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const el = selector ? document.querySelector(selector) : null
        if (el && selector) {
          const rect = el.getBoundingClientRect()
          const h = rect.height
          const top = rect.top
          if (h <= 0) { setPct(0); return }
          const read = Math.max(0, -top)
          setPct(Math.min(100, Math.round((read / (h - window.innerHeight)) * 100)))
        } else {
          const scrollH = document.documentElement.scrollHeight - window.innerHeight
          if (scrollH <= 0) { setPct(0); return }
          setPct(Math.round((window.scrollY / scrollH) * 100))
        }
      })
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [selector])

  return (
    <div
      className="scroll-progress"
      style={{ width: `${pct}%` }}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    />
  )
}

export default ScrollProgress
