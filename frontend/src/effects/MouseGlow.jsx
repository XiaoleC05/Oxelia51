import { useRef, useEffect, useState } from 'react'
import './MouseGlow.css'

const GLOW_RADIUS = 200

function MouseGlow() {
  const glowRef = useRef(null)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    if (!window.matchMedia('(hover: hover)').matches) {
      setEnabled(false)
      return
    }

    let rafId = null
    let mx = 0
    let my = 0

    const onMove = (e) => {
      mx = e.clientX
      my = e.clientY
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          const el = glowRef.current
          if (el) {
            el.style.transform = `translate3d(${mx - GLOW_RADIUS}px, ${my - GLOW_RADIUS}px, 0)`
          }
          rafId = null
        })
      }
    }

    document.addEventListener('mousemove', onMove)
    return () => {
      document.removeEventListener('mousemove', onMove)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  if (!enabled) return null

  return <div className="mouse-glow" ref={glowRef} aria-hidden="true" />
}

export default MouseGlow
