import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import './ToolFAB.css'

/* ===== 工具列表（与 ToolShell.jsx TOOL_VIEWS 一致，共 7 个） ===== */
const TOOLS = [
  { slug: 'superread', name: 'SuperRead', desc: 'AI 新闻阅读' },
  { slug: 'aihelper', name: 'AI 助手', desc: '智能对话助手' },
  { slug: 'musicbox', name: 'MusicBox', desc: '音乐盒' },
  { slug: 'cs2lab', name: 'CS2 Lab', desc: 'CS2 实验室' },
  { slug: 'dormguard', name: 'DormGuard', desc: '宿舍守护' },
  { slug: 'agentcanvas', name: 'AgentCanvas', desc: 'Agent 画布' },
  { slug: 'secretstore', name: 'SecretStore', desc: '密钥仓库' },
]

const DEFAULT_POS = { right: 24, bottom: 80 }
const FAB_SIZE_DESKTOP = 56
const FAB_SIZE_MOBILE = 48
const DRAG_THRESHOLD = 4
const DOUBLE_CLICK_MS = 300
const FIRST_TIP_DURATION = 5000

const STORAGE_KEY_POS = 'oxelia51_fab_pos'
const STORAGE_KEY_LAST_TOOL = 'oxelia51_last_tool'
const STORAGE_KEY_FIRST_SEEN = 'oxelia51_fab_first_seen'

/* ===== 扳手拧螺母 SVG 图标 ===== */
function ToolFabIcon({ state }) {
  return (
    <svg
      className={`tool-fab-icon tool-fab-icon--${state}`}
      viewBox="0 0 64 64"
      width="30"
      height="30"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g className="tool-fab-nut">
        <polygon points="32,16 46,24 46,40 32,48 18,40 18,24" />
        <circle cx="32" cy="32" r="6" />
      </g>
      <g className="tool-fab-wrench">
        <line x1="32" y1="32" x2="54" y2="54" />
        <path d="M 26 26 L 32 32 L 38 26" />
      </g>
    </svg>
  )
}

/* ===== 主组件 ===== */
function ToolFAB() {
  const navigate = useNavigate()

  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POS)
      return saved ? JSON.parse(saved) : DEFAULT_POS
    } catch {
      return DEFAULT_POS
    }
  })
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showFirstTip, setShowFirstTip] = useState(
    () => !localStorage.getItem(STORAGE_KEY_FIRST_SEEN)
  )
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  )

  const fabRef = useRef(null)
  const lastClickRef = useRef(0)

  /* ---- 挂载标记（用于 portal 防止 SSR 警告） ---- */
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

  /* ---- 首次提示 5s 后淡出 ---- */
  useEffect(() => {
    if (!showFirstTip) return
    const timer = setTimeout(() => {
      setShowFirstTip(false)
      localStorage.setItem(STORAGE_KEY_FIRST_SEEN, '1')
    }, FIRST_TIP_DURATION)
    return () => clearTimeout(timer)
  }, [showFirstTip])

  /* ---- Esc 收起 ---- */
  useEffect(() => {
    if (!expanded) return
    const handler = (e) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [expanded])

  /* ---- 点击空白收起 ---- */
  useEffect(() => {
    if (!expanded) return
    const handler = (e) => {
      if (fabRef.current && !fabRef.current.contains(e.target)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expanded])

  /* ---- 拖动逻辑 ---- */
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
        // 保存最终位置
        setPos((currentPos) => {
          localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(currentPos))
          return currentPos
        })
        return
      }
      setDragging(false)
      // 单击 / 双击
      const now = Date.now()
      if (now - lastClickRef.current < DOUBLE_CLICK_MS) {
        // 双击 → 跳转上次使用工具
        const lastTool = localStorage.getItem(STORAGE_KEY_LAST_TOOL)
        if (lastTool && TOOLS.some((t) => t.slug === lastTool)) {
          navigate(`/tools/${lastTool}`)
          setExpanded(false)
        } else {
          setExpanded((e2) => !e2)
        }
        lastClickRef.current = 0
      } else {
        setExpanded((e2) => !e2)
        if (showFirstTip) {
          setShowFirstTip(false)
          localStorage.setItem(STORAGE_KEY_FIRST_SEEN, '1')
        }
        lastClickRef.current = now
      }
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [isMobile, pos, navigate, showFirstTip])

  /* ---- 点击工具项 ---- */
  const handleToolClick = useCallback((slug) => {
    localStorage.setItem(STORAGE_KEY_LAST_TOOL, slug)
    navigate(`/tools/${slug}`)
    setExpanded(false)
  }, [navigate])

  /* ---- 计算展开方向（选空间最大侧） ---- */
  const expandDir = (() => {
    if (isMobile) return 'drawer'
    const fabSize = FAB_SIZE_DESKTOP
    const distTop = window.innerHeight - pos.bottom - fabSize
    const distLeft = window.innerWidth - pos.right - fabSize
    const distRight = pos.right
    const distBottom = pos.bottom
    const max = Math.max(distTop, distLeft, distRight, distBottom)
    if (max === distTop) return 'up'
    if (max === distLeft) return 'left'
    if (max === distRight) return 'right'
    return 'down'
  })()

  const fabState = expanded ? 'expanded' : hovered ? 'hover' : 'idle'

  if (!mounted) return null

  return createPortal(
    <div
      ref={fabRef}
      className={[
        'tool-fab',
        expanded ? 'tool-fab--expanded' : '',
        dragging ? 'tool-fab--dragging' : '',
        showFirstTip ? 'tool-fab--first-tip' : '',
        isMobile ? 'tool-fab--mobile' : '',
        `tool-fab--dir-${expandDir}`,
      ].filter(Boolean).join(' ')}
      style={isMobile ? undefined : { right: `${pos.right}px`, bottom: `${pos.bottom}px` }}
      onPointerDown={handlePointerDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      aria-label={expanded ? '收起工具列表' : '展开工具列表'}
      aria-expanded={expanded}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setExpanded((v) => !v)
        }
      }}
    >
      {/* 浮球按钮 */}
      <div className="tool-fab-btn">
        <ToolFabIcon state={fabState} />
      </div>

      {/* 首次提示气泡 */}
      {showFirstTip && (
        <div className="tool-fab-tip" role="status">
          <span className="tool-fab-tip-text">工具入口在这里</span>
          <span className="tool-fab-tip-arrow" aria-hidden="true">↗</span>
        </div>
      )}

      {/* 展开工具列表 */}
      {expanded && (
        <div className={`tool-fab-menu tool-fab-menu--${expandDir}`}>
          <div className="tool-fab-menu-header">工具</div>
          <div className="tool-fab-menu-list">
            {TOOLS.map((tool, i) => (
              <button
                key={tool.slug}
                type="button"
                className="tool-fab-item"
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleToolClick(tool.slug)
                }}
              >
                <span className="tool-fab-item-name">{tool.name}</span>
                <span className="tool-fab-item-desc">{tool.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

export default ToolFAB
