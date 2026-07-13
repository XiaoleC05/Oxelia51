import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { getToken } from '../api'
import './SmartKBWidget.css'

/* ===== 常量 ===== */
const DEFAULT_POS = { right: 24, bottom: 120 } // SmartKB 浮球上方
const DEFAULT_SIZE = { width: 720, height: 520 }
const MIN_SIZE = { width: 480, height: 360 }
const DRAG_THRESHOLD = 4
const RESIZE_THRESHOLD = 6
const STORAGE_KEY_POS = 'oxelia51_smartkb_widget_pos'
const STORAGE_KEY_SIZE = 'oxelia51_smartkb_widget_size'

/* ===== 解析 SSE 流（fetch + ReadableStream 实现） =====
 * 后端约定：text/event-stream，data: 行
 *   - {"type":"token","content":"xxx"}   → 文本片段
 *   - {"type":"sources","sources":[...]} → 引用源（一次性）
 *   - {"type":"done"}                     → 结束
 *   - {"type":"error","message":"xxx"}    → 错误
 */
async function streamChat(query, { onToken, onSources, onDone, onError }) {
  let res
  try {
    res = await fetch('/api/smartkb/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken() || ''}`,
        'X-Oxelia51-Access-Token': getToken() || '',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ query }),
    })
  } catch (e) {
    onError?.(new Error('网络错误：' + e.message))
    return
  }
  if (!res.ok) {
    let msg = `请求失败 (${res.status})`
    try {
      const data = await res.json()
      msg = data?.error || data?.detail || msg
    } catch {
      // ignore
    }
    onError?.(new Error(msg))
    return
  }
  const reader = res.body?.getReader()
  if (!reader) {
    onError?.(new Error('浏览器不支持流式读取'))
    return
  }
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // SSE 事件以 \n\n 分隔
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''
      for (const evt of events) {
        // 解析 data: 行
        const dataLines = evt
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('')
        if (!dataLines) continue
        try {
          const obj = JSON.parse(dataLines)
          if (obj.type === 'token' && obj.content) {
            onToken?.(obj.content)
          } else if (obj.type === 'sources' && Array.isArray(obj.sources)) {
            onSources?.(obj.sources)
          } else if (obj.type === 'done') {
            onDone?.()
          } else if (obj.type === 'error' && obj.message) {
            onError?.(new Error(obj.message))
          }
        } catch {
          // 非 JSON 行：忽略
        }
      }
    }
    // 处理 buffer 中剩余事件
    if (buffer.trim()) {
      const dataLines = buffer
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('')
      if (dataLines) {
        try {
          const obj = JSON.parse(dataLines)
          if (obj.type === 'token' && obj.content) onToken?.(obj.content)
          else if (obj.type === 'sources') onSources?.(obj.sources)
          else if (obj.type === 'done') onDone?.()
          else if (obj.type === 'error') onError?.(new Error(obj.message))
        } catch {
          // ignore
        }
      }
    }
  } catch (e) {
    onError?.(new Error('流式读取中断：' + e.message))
  }
}

/* ===== 引用标记 → 可点击渲染 =====
 * 将答案文本中的 [1] [2] 替换为可点击的引用按钮
 */
function renderAnswerWithCitations(text, onCitationClick, sources) {
  if (!text) return null
  const parts = []
  const regex = /\[(\d+)\]/g
  let lastIndex = 0
  let m
  let key = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, m.index)}</span>)
    }
    const idx = parseInt(m[1], 10)
    parts.push(
      <button
        key={key++}
        type="button"
        className="smartkb-citation"
        data-idx={idx}
        onClick={(e) => {
          e.preventDefault()
          onCitationClick?.(idx)
        }}
        disabled={!sources || idx > sources.length}
      >
        [{idx}]
      </button>
    )
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>)
  }
  return parts
}

/* ===== 主组件 =====
 * Props:
 *   open: boolean        — 是否展开（由 App.jsx 的 kbOpen 控制）
 *   onClose: function     — 关闭浮窗
 */
function SmartKBWidget({ open, onClose }) {
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POS)
      return saved ? JSON.parse(saved) : DEFAULT_POS
    } catch {
      return DEFAULT_POS
    }
  })
  const [size, setSize] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SIZE)
      return saved ? JSON.parse(saved) : DEFAULT_SIZE
    } catch {
      return DEFAULT_SIZE
    }
  })
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(null)

  const widgetRef = useRef(null)
  const answerRef = useRef(null)
  const chunkRefs = useRef({})
  const abortRef = useRef(null)
  const dragState = useRef({ mode: null, startX: 0, startY: 0, startPos: null, startSize: null })

  /* ---- 挂载标记 ---- */
  useEffect(() => {
    setMounted(true)
  }, [])

  /* ---- 关闭浮窗时中断进行中的流 ---- */
  useEffect(() => {
    if (open) return
    if (abortRef.current) {
      abortRef.current.abort?.()
      abortRef.current = null
    }
    setStreaming(false)
  }, [open])

  /* ---- Esc 关闭 ---- */
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  /* ---- 拖动 / resize ---- */
  const handleDragStart = useCallback((e, mode) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    dragState.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startPos: { ...pos },
      startSize: { ...size },
    }

    const onMove = (ev) => {
      const ds = dragState.current
      if (!ds.mode) return
      const dx = ev.clientX - ds.startX
      const dy = ev.clientY - ds.startY
      if (ds.mode === 'move') {
        const maxX = window.innerWidth - 80
        const maxY = window.innerHeight - 60
        const newPos = {
          right: Math.max(0, Math.min(ds.startPos.right - dx, maxX)),
          bottom: Math.max(0, Math.min(ds.startPos.bottom - dy, maxY)),
        }
        setPos(newPos)
      } else if (ds.mode === 'resize') {
        const newWidth = Math.max(MIN_SIZE.width, ds.startSize.width + dx)
        const newHeight = Math.max(MIN_SIZE.height, ds.startSize.height + dy)
        // 限制不超过视口
        const maxW = window.innerWidth - ds.startPos.right - 16
        const maxH = window.innerHeight - ds.startPos.bottom - 16
        setSize({
          width: Math.min(newWidth, maxW),
          height: Math.min(newHeight, maxH),
        })
      }
    }

    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      const ds = dragState.current
      if (!ds.mode) return
      if (ds.mode === 'move') {
        setPos((p) => {
          localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(p))
          return p
        })
      } else if (ds.mode === 'resize') {
        setSize((s) => {
          localStorage.setItem(STORAGE_KEY_SIZE, JSON.stringify(s))
          return s
        })
      }
      dragState.current = { mode: null }
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [pos, size])

  /* ---- 引用点击 → 左侧高亮滚动 ---- */
  const handleCitationClick = useCallback((idx) => {
    if (!idx || idx < 1) return
    setHighlightIdx(idx)
    const ref = chunkRefs.current[idx]
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // 3 秒后取消高亮
    setTimeout(() => setHighlightIdx(null), 3000)
  }, [])

  /* ---- 提交查询（同时 search + chat） ---- */
  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault()
    const q = query.trim()
    if (!q || streaming) return
    setError('')
    setResults([])
    setAnswer('')
    setSources([])
    setSearching(true)
    setStreaming(true)

    // 1) 检索：直接 await
    apiSearch(q).then((data) => {
      const chunks = Array.isArray(data?.chunks) ? data.chunks
        : Array.isArray(data?.results) ? data.results
        : Array.isArray(data) ? data : []
      setResults(chunks)
    }).catch((err) => {
      console.error('search failed', err)
    }).finally(() => {
      setSearching(false)
    })

    // 2) chat：流式接收
    const controller = new AbortController()
    abortRef.current = controller
    let firstToken = true
    await streamChat(q, {
      onToken: (token) => {
        if (firstToken) {
          firstToken = false
          setSearching(false)
        }
        setAnswer((prev) => prev + token)
      },
      onSources: (srcs) => setSources(srcs),
      onDone: () => setStreaming(false),
      onError: (err) => {
        setError(err.message)
        setStreaming(false)
      },
    })
    setStreaming(false)
  }, [query, streaming])

  /* ---- 渲染答案含引用 ---- */
  const renderedAnswer = useMemo(
    () => renderAnswerWithCitations(answer, handleCitationClick, sources),
    [answer, sources, handleCitationClick]
  )

  /* ---- 自动滚动到答案底部（流式时） ---- */
  useEffect(() => {
    if (streaming && answerRef.current) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight
    }
  }, [answer, streaming])

  if (!mounted || !open) return null

  return createPortal(
    <div
      ref={widgetRef}
      className="smartkb-widget"
      style={{
        right: `${pos.right}px`,
        bottom: `${pos.bottom}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
      }}
      role="dialog"
      aria-label="SmartKB 知识库"
    >
      {/* 标题栏（拖动区） */}
      <div
        className="smartkb-widget-header"
        onPointerDown={(e) => handleDragStart(e, 'move')}
      >
        <span className="smartkb-widget-title">SmartKB 知识库</span>
        <button
          type="button"
          className="smartkb-widget-close"
          onClick={onClose}
          aria-label="关闭"
        >
          ×
        </button>
      </div>

      {/* 搜索框 */}
      <form className="smartkb-widget-search" onSubmit={handleSubmit}>
        <input
          type="text"
          className="smartkb-widget-input"
          placeholder="搜索或提问..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={streaming}
          autoFocus
        />
        <button
          type="submit"
          className="smartkb-widget-submit"
          disabled={!query.trim() || streaming}
        >
          {streaming ? '回答中…' : '发送'}
        </button>
      </form>

      {/* 双栏内容区 */}
      <div className="smartkb-widget-body">
        {/* 左：检索结果 */}
        <div className="smartkb-panel smartkb-panel--left">
          <div className="smartkb-panel-header">检索结果</div>
          <div className="smartkb-panel-content">
            {searching && results.length === 0 && (
              <div className="smartkb-loading">
                <div className="smartkb-spinner" />
                <span>检索中…</span>
              </div>
            )}
            {!searching && results.length === 0 && !streaming && (
              <div className="smartkb-empty">
                输入问题后，相关片段会显示在这里
              </div>
            )}
            {results.length > 0 && (
              <ul className="smartkb-chunk-list">
                {results.map((chunk, i) => {
                  const idx = i + 1
                  const title = chunk.title || chunk.source || `片段 ${idx}`
                  const content = chunk.content || chunk.text || ''
                  const url = chunk.url || chunk.link
                  return (
                    <li
                      key={i}
                      ref={(el) => { chunkRefs.current[idx] = el }}
                      className={`smartkb-chunk ${
                        highlightIdx === idx ? 'smartkb-chunk--highlight' : ''
                      }`}
                    >
                      <div className="smartkb-chunk-meta">
                        <span className="smartkb-chunk-idx">[{idx}]</span>
                        <span className="smartkb-chunk-title">{title}</span>
                      </div>
                      <p className="smartkb-chunk-content">{content}</p>
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="smartkb-chunk-link"
                        >
                          查看原文 →
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* 右：AI 回答 */}
        <div className="smartkb-panel smartkb-panel--right">
          <div className="smartkb-panel-header">
            AI 回答
            {streaming && <span className="smartkb-stream-indicator">流式中</span>}
          </div>
          <div className="smartkb-panel-content" ref={answerRef}>
            {error && (
              <div className="smartkb-error">{error}</div>
            )}
            {!error && !answer && !streaming && (
              <div className="smartkb-empty">
                AI 回答会在这里流式呈现
              </div>
            )}
            {answer && (
              <div className="smartkb-answer">
                {renderedAnswer}
                {streaming && <span className="smartkb-cursor">▊</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* resize handle */}
      <div
        className="smartkb-widget-resize"
        onPointerDown={(e) => handleDragStart(e, 'resize')}
      >
        <span className="smartkb-widget-resize-grip" aria-hidden="true">⤡</span>
      </div>
    </div>,
    document.body
  )
}

/* ===== 检索 API（平台 API，非工具 proxy） ===== */
async function apiSearch(query) {
  const res = await fetch('/api/smartkb/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() || ''}`,
      'X-Oxelia51-Access-Token': getToken() || '',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    let msg = `请求失败 (${res.status})`
    try {
      const data = await res.json()
      msg = data?.error || data?.detail || msg
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return res.json()
}

export default SmartKBWidget
