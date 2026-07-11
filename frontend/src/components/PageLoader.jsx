import { useState, useEffect } from 'react'
import './PageLoader.css'

const VARIANTS = ['split', 'ink', 'mist', 'light']

const INK_BLOBS = [
  { delay: 0,    x:  5, y: -8,  s: 1.10 },
  { delay: 0.05, x: -7, y:  6,  s: 0.95 },
  { delay: 0.10, x:  9, y:  4,  s: 1.05 },
  { delay: 0.08, x: -4, y: -9,  s: 1.00 },
  { delay: 0.15, x:  2, y: 10,  s: 0.90 },
  { delay: 0.12, x: -8, y:  2,  s: 1.08 },
]

function PageLoader({ variant = 'split', onDone }) {
  const [phase, setPhase] = useState('hold')
  const safeVariant = VARIANTS.includes(variant) ? variant : 'split'

  useEffect(() => {
    // sync with CSS: --pl-hold 0.5s + --pl-reveal 0.4s + --pl-fade 0.25s = 1.15s
    const holdTimer  = setTimeout(() => setPhase('open'), 500)
    const fadeTimer  = setTimeout(() => setPhase('fade'), 900)
    const doneTimer  = setTimeout(() => {
      setPhase('gone')
      if (typeof onDone === 'function') onDone()
    }, 1150)

    return () => {
      clearTimeout(holdTimer)
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  if (phase === 'gone') return null

  return (
    <div
      className={`page-loader page-loader--${safeVariant} page-loader--${phase}`}
      aria-hidden="true"
    >
      {safeVariant === 'split' && (
        <>
          <div className="page-loader__door page-loader__door--left" />
          <div className="page-loader__door page-loader__door--right" />
        </>
      )}

      {safeVariant === 'ink' && (
        <div className="page-loader__ink-wrap">
          {INK_BLOBS.map((b, i) => (
            <span
              key={i}
              className="page-loader__ink-blob"
              style={{
                '--ink-delay': `${b.delay}s`,
                '--ink-x':     `${b.x}vw`,
                '--ink-y':     `${b.y}vh`,
                '--ink-s':     b.s,
              }}
            />
          ))}
        </div>
      )}

      {safeVariant === 'mist' && <div className="page-loader__mist" />}

      {safeVariant === 'light' && (
        <div className="page-loader__light-overlay">
          <div className="page-loader__light-beam" />
        </div>
      )}

      <div className="page-loader__logo">Oxelia51</div>
    </div>
  )
}

export default PageLoader
