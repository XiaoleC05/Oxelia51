import { useRef, useEffect, useState } from 'react'
import './MouseGlow.css'

const GLOW_RADIUS = 200
const FADE_OUT_MS = 300
const RESTORE_DELAY_MS = 800

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
    let restoreTimer = null

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

    const onTap = () => {
      const el = glowRef.current
      if (!el) return
      el.classList.add('mouse-glow--hidden')
      clearTimeout(restoreTimer)
      restoreTimer = setTimeout(() => {
        el.classList.remove('mouse-glow--hidden')
      }, RESTORE_DELAY_MS)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('click', onTap)
    document.addEventListener('touchstart', onTap)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('click', onTap)
      document.removeEventListener('touchstart', onTap)
      if (rafId) cancelAnimationFrame(rafId)
      clearTimeout(restoreTimer)
    }
  }, [])

  if (!enabled) return null

  return <div className="mouse-glow" ref={glowRef} aria-hidden="true" />
}

export default MouseGlow
