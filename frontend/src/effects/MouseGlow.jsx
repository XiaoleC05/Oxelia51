import { useRef, useEffect, useState } from 'react'
import './MouseGlow.css'

const GLOW_SIZE = 300
const HALF = GLOW_SIZE / 2

function MouseGlow() {
  const groupRef = useRef(null)
  const [enabled] = useState(() => window.matchMedia('(hover: hover)').matches)
  const [alive, setAlive] = useState(false)

  useEffect(() => {
    if (!enabled) return

    let rafId = null
    let hideTimer = null
    let firstMove = false

    const onMove = (e) => {
      if (!firstMove) {
        firstMove = true
        setAlive(true)
      }
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          const el = groupRef.current
          if (el) {
            el.style.transform = `translate3d(${e.clientX - HALF}px, ${e.clientY - HALF}px, 0)`
          }
          rafId = null
        })
      }
    }

    const onTap = () => {
      const el = groupRef.current
      if (!el || !firstMove) return
      el.classList.add('mouse-glow--hidden')
      clearTimeout(hideTimer)
      hideTimer = setTimeout(() => {
        if (el) el.classList.remove('mouse-glow--hidden')
      }, 280)
    }

    document.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('click', onTap)
    document.addEventListener('touchstart', onTap)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('click', onTap)
      document.removeEventListener('touchstart', onTap)
      if (rafId) cancelAnimationFrame(rafId)
      clearTimeout(hideTimer)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div
      className={`mouse-glow${alive ? ' mouse-glow--alive' : ''}`}
      ref={groupRef}
      aria-hidden="true"
    >
      <span className="mouse-glow__spot mouse-glow__spot--main" />
      <span className="mouse-glow__spot mouse-glow__spot--trail" />
    </div>
  )
}

export default MouseGlow
