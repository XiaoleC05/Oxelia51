import { useState, useEffect } from 'react'
import './PageLoader.css'

const VARIANTS = ['split', 'diagonal', 'expand']

function PageLoader({ variant = 'split', onDone }) {
  const [phase, setPhase] = useState('hold')
  const safeVariant = VARIANTS.includes(variant) ? variant : 'split'

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('open'), 1500)
    const fadeTimer = setTimeout(() => setPhase('fade'), 1500 + 1200)
    const doneTimer = setTimeout(() => {
      setPhase('gone')
      if (typeof onDone === 'function') onDone()
    }, 1500 + 1200 + 400)

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
      {safeVariant === 'diagonal' && (
        <>
          <div className="page-loader__door page-loader__door--tl" />
          <div className="page-loader__door page-loader__door--br" />
        </>
      )}
      {safeVariant === 'expand' && <div className="page-loader__curtain" />}
      <div className="page-loader__logo">Oxelia51</div>
    </div>
  )
}

export default PageLoader
