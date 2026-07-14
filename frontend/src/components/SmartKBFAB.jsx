import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './SmartKBFAB.css'

/* ===== 常量 ===== */
const DEFAULT_POS = { right: 24, bottom: 400 }
const FAB_SIZE_DESKTOP = 120
const FAB_SIZE_MOBILE = 96
const DRAG_THRESHOLD = 10
const PARTICLE_COUNT_MIN = 16
const PARTICLE_COUNT_MAX = 20
const PARTICLE_DIST_MIN = 40
const PARTICLE_DIST_MAX = 60
const BURST_DURATION_MS = 700
const STORAGE_KEY_POS = 'oxelia51_smartkb_pos'

/* ===== SmartKBFAB 浮球组件 — Orbiting Glass =====
 * onToggle: function — 点击浮球时触发（展开/隐藏 SmartKB 浮窗，浮窗在 P6 实现）
 */
function SmartKBFAB({ onToggle }) {
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POS)
      if (saved) {
        const p = JSON.parse(saved)
        const w = typeof window !== 'undefined' ? window.innerWidth : 1920
        const h = typeof window !== 'undefined' ? window.innerHeight : 1080
        const s = w <= 640 ? FAB_SIZE_MOBILE : FAB_SIZE_DESKTOP
        return {
          right: Math.min(Math.max(0, p.right || 24), w - s - 8),
          bottom: Math.min(Math.max(0, p.bottom || 400), h - s - 8),
        }
      }
      return DEFAULT_POS
    } catch {
      return DEFAULT_POS
    }
  })
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showHint, setShowHint] = useState(() => {
    try { return !localStorage.getItem('oxelia51_smartkb_seen') } catch { return true }
  })
  // burstKey 用于强制重新挂载内部 DOM，从而重启 CSS 动画（连续点击也能重播）
  const [burstKey, setBurstKey] = useState(0)
  const [particles, setParticles] = useState([])
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  )

  const burstTimerRef = useRef(null)
  // 用于移动端覆盖 CSS !important 定位（CSS 文件不可修改，用 setProperty('important') 覆盖）
  const fabRef = useRef(null)

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

  /* ---- 移动端位置同步：用 setProperty('important') 覆盖 CSS 的 !important ----
   * CSS .smartkb-fab--mobile { right: 16px !important; bottom: 360px !important }
   * 内联 style 属性（React style prop）无法覆盖 !important
   * 必须用 element.style.setProperty(prop, val, 'important') 设置内联 !important（优先级最高）
   */
  useEffect(() => {
    if (!fabRef.current) return
    if (isMobile) {
      // 移动端：设置 !important 内联样式覆盖 CSS
      fabRef.current.style.setProperty('right', `${pos.right}px`, 'important')
      fabRef.current.style.setProperty('bottom', `${pos.bottom}px`, 'important')
    } else {
      // 桌面端：清除可能残留的 !important 内联样式，让 React style prop 生效
      fabRef.current.style.setProperty('right', '')
      fabRef.current.style.setProperty('bottom', '')
      fabRef.current.style.setProperty('right', `${pos.right}px`)
      fabRef.current.style.setProperty('bottom', `${pos.bottom}px`)
    }
  }, [isMobile, pos])

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

  /* ---- 统一拖动逻辑（同时支持 PointerEvent 和 TouchEvent） ---- */
  const handleDragStart = useCallback((e) => {
    // 跳过触摸来源的 pointerdown（touchstart 已处理，避免重复触发）
    if (!e.touches && e.pointerType === 'touch') return

    // 从 pointer 或 touch 事件中提取起始坐标
    let startX, startY
    if (e.touches) {
      // TouchEvent
      if (e.touches.length !== 1) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    } else {
      // PointerEvent / MouseEvent
      if (e.button !== undefined && e.button !== 0) return
      startX = e.clientX
      startY = e.clientY
    }

    try { e.preventDefault() } catch {}
    const startPos = { ...pos }
    const fabSize = isMobile ? FAB_SIZE_MOBILE : FAB_SIZE_DESKTOP
    let moved = false
    let ended = false

    /* ---- 通用移动处理 ---- */
    const handleMove = (cx, cy) => {
      const dx = cx - startX
      const dy = cy - startY
      if (!moved) {
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
          moved = true
          setDragging(true)
        } else {
          return
        }
      }
      const maxX = window.innerWidth - fabSize - 8
      const maxY = window.innerHeight - fabSize - 8
      const newPos = {
        right: Math.max(0, Math.min(startPos.right - dx, maxX)),
        bottom: Math.max(0, Math.min(startPos.bottom - dy, maxY)),
      }
      setPos(newPos)
    }

    /* ---- 通用结束处理 ---- */
    const handleEnd = () => {
      if (ended) return
      ended = true
      // 移除所有监听器（pointer + touch）
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)

      if (moved) {
        setDragging(false)
        setPos((currentPos) => {
          localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(currentPos))
          return currentPos
        })
        return
      }
      // 未移动 → 保存位置
      setDragging(false)
      setPos((currentPos) => {
        localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(currentPos))
        return currentPos
      })
    }

    /* ---- Pointer 事件监听器（桌面端） ---- */
    const onPointerMove = (ev) => handleMove(ev.clientX, ev.clientY)
    const onPointerUp = () => handleEnd()

    /* ---- Touch 事件监听器（移动端，需 passive: false 才能 preventDefault） ---- */
    const onTouchMove = (ev) => {
      if (ev.touches.length !== 1) return
      try { ev.preventDefault() } catch {} // 阻止页面滚动
      handleMove(ev.touches[0].clientX, ev.touches[0].clientY)
    }
    const onTouchEnd = () => handleEnd()

    // 根据事件类型注册对应的监听器
    if (e.touches) {
      // Touch 事件 → 注册 touch 监听器
      document.addEventListener('touchmove', onTouchMove, { passive: false })
      document.addEventListener('touchend', onTouchEnd)
      document.addEventListener('touchcancel', onTouchEnd)
    } else {
      // Pointer 事件 → 注册 pointer 监听器
      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp)
    }
  }, [isMobile, pos, onToggle, triggerBurst])

  useEffect(() => {
    const el = fabRef.current
    if (!el) return
    const onTouch = (e) => { if (e.touches.length === 1) handleDragStart(e) }
    el.addEventListener('touchstart', onTouch, { passive: false })
    return () => el.removeEventListener('touchstart', onTouch)
  }, [handleDragStart])

  if (!mounted) return null

  return createPortal(
    <div
      ref={fabRef}
      className={[
        'smartkb-fab',
        hovered ? 'smartkb-fab--hover' : '',
        dragging ? 'smartkb-fab--dragging' : '',
        isMobile ? 'smartkb-fab--mobile' : '',
      ].filter(Boolean).join(' ')}
      style={{ right: `${pos.right}px`, bottom: `${pos.bottom}px` }}
      onPointerDown={handleDragStart}
      onClick={() => {
        if (showHint) { setShowHint(false); try { localStorage.setItem('oxelia51_smartkb_seen', '1') } catch {} }
        triggerBurst()
        if (typeof onToggle === 'function') onToggle()
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      aria-label="SmartKB 知识库"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          try { e.preventDefault() } catch {}
          triggerBurst()
          if (typeof onToggle === 'function') onToggle()
        }
      }}
    >
      {/* key 重新挂载 → 重启 CSS 动画（连续点击也能播放） */}
      <div className="smartkb-fab-inner" key={burstKey}>
        {/* 玻璃光晕（脉冲） */}
        <div className="smartkb-fab-glow" aria-hidden="true" />
        {/* 双层星轨（内快外慢，不同颜色） */}
        <div className="smartkb-fab-orbit smartkb-fab-orbit--1" aria-hidden="true" />
        <div className="smartkb-fab-orbit smartkb-fab-orbit--2" aria-hidden="true" />
        {/* 星球 + 「Oxelia51」 */}
        <div className="smartkb-fab-planet">
          <span className="smartkb-fab-num">Oxelia51</span>
        </div>
        {/* 首次引导提示 */}
        {showHint && (
          <div className="smartkb-fab-hint">
            <span>项目知识库</span>
            <span>点击提问</span>
          </div>
        )}
        {/* 粒子飞散 */}
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
