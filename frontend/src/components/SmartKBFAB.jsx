import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './SmartKBFAB.css'

/* ===== 常量 ===== */
const DEFAULT_POS = { right: 24, bottom: 400 }
const FAB_SIZE_DESKTOP = 56
const FAB_SIZE_MOBILE = 48
const DRAG_THRESHOLD = 4
const PARTICLE_COUNT_MIN = 8
const PARTICLE_COUNT_MAX = 12
const PARTICLE_DIST_MIN = 30
const PARTICLE_DIST_MAX = 40
const BURST_DURATION_MS = 700
const STORAGE_KEY_POS = 'oxelia51_smartkb_pos'

/* ===== SmartKBFAB 浮球组件 =====
 * onToggle: function — 点击浮球时触发（展开/隐藏 SmartKB 浮窗，浮窗在 P6 实现）
 */
function SmartKBFAB({ onToggle }) {
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POS)
      return saved ? JSON.parse(saved) : DEFAULT_POS
    } catch {
      return DEFAULT_POS
    }
  })
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [mounted, setMounted] = useState(false)
  // burstKey 用于强制重新挂载内部 DOM，从而重启 CSS 动画（连续点击也能重播）
  const [burstKey, setBurstKey] = useState(0)
  const [particles, setParticles] = useState([])
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  )

  const burstTimerRef = useRef(null)

  /* ---- 挂载标记（防止 SSR 警告） ---- */
  useEffect(() => {
    setMounted(true)
  }, [])

  /* ---- 监听窗口尺寸变化 ---- */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(max-width: 640px)')
    const handler = (e) => setIsMobile(e.matches)
    if (mq.addEventListener) mq.addEventListener('change', handler)
    else mq.addListener(handler)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler)
      else mq.removeListener(handler)
    }
  }, [])

  /* ---- 清理 burst 定时器 ---- */
  useEffect(() => () => {
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
  }, [])

  /* ---- 触发粒子飞散 + 星球缩放动画 ---- */
  const triggerBurst = useCallback(() => {
    const count =
      Math.floor(Math.random() * (PARTICLE_COUNT_MAX - PARTICLE_COUNT_MIN + 1)) +
      PARTICLE_COUNT_MIN
    const newParticles = Array.from({ length: count }, (_, i) => {
      // 均匀分布 + 随机抖动，避免粒子重叠成一条线
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
      const distance =
        PARTICLE_DIST_MIN + Math.random() * (PARTICLE_DIST_MAX - PARTICLE_DIST_MIN)
      return {
        id: `${Date.now()}-${i}`,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        delay: Math.random() * 80,
      }
    })
    setBurstKey((k) => k + 1)
    setParticles(newParticles)
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
    burstTimerRef.current = setTimeout(() => {
      setParticles([])
    }, BURST_DURATION_MS)
  }, [])

  /* ---- 拖动逻辑（与 ToolFAB 一致） ---- */
  const handlePointerDown = useCallback((e) => {
    if (isMobile) return
    if (e.button !== 0) return
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startPos = { ...pos }
    let moved = false

    const onMove = (ev) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!moved) {
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
          moved = true
          setDragging(true)
        } else {
          return
        }
      }
      const maxX = window.innerWidth - FAB_SIZE_DESKTOP - 8
      const maxY = window.innerHeight - FAB_SIZE_DESKTOP - 8
      const newPos = {
        right: Math.max(0, Math.min(startPos.right - dx, maxX)),
        bottom: Math.max(0, Math.min(startPos.bottom - dy, maxY)),
      }
      setPos(newPos)
    }

    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      if (moved) {
        setDragging(false)
        setPos((currentPos) => {
          localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(currentPos))
          return currentPos
        })
        return
      }
      setDragging(false)
      triggerBurst()
      if (typeof onToggle === 'function') onToggle()
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [isMobile, pos, onToggle, triggerBurst])

  if (!mounted) return null

  return createPortal(
    <div
      className={[
        'smartkb-fab',
        hovered ? 'smartkb-fab--hover' : '',
        dragging ? 'smartkb-fab--dragging' : '',
        isMobile ? 'smartkb-fab--mobile' : '',
      ].filter(Boolean).join(' ')}
      style={isMobile ? undefined : { right: `${pos.right}px`, bottom: `${pos.bottom}px` }}
      onPointerDown={handlePointerDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      aria-label="SmartKB 知识库"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          triggerBurst()
          if (typeof onToggle === 'function') onToggle()
        }
      }}
    >
      {/* key 重新挂载 → 重启 CSS 动画（连续点击也能播放） */}
      <div className="smartkb-fab-inner" key={burstKey}>
        <div className="smartkb-fab-orbit smartkb-fab-orbit--1" aria-hidden="true" />
        <div className="smartkb-fab-orbit smartkb-fab-orbit--2" aria-hidden="true" />
        <div className="smartkb-fab-planet">
          <span className="smartkb-fab-num">51</span>
        </div>
        {particles.map((p) => (
          <span
            key={p.id}
            className="smartkb-fab-particle"
            style={{
              '--dx': `${p.x}px`,
              '--dy': `${p.y}px`,
              animationDelay: `${p.delay}ms`,
            }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>,
    document.body
  )
}

export default SmartKBFAB
