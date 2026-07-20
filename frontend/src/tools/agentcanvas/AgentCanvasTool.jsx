import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiProxy } from '../../api'
import './AgentCanvasTool.css'

/* ===== Node type presets ===== */
const NODE_TYPES = {
  input:    { icon: '📥', label: '输入',   color: '#4a90d9' },
  process:  { icon: '⚙️', label: '处理',   color: '#8e8e8e' },
  decision: { icon: '🔀', label: '决策',   color: '#e6a23c' },
  output:   { icon: '📤', label: '输出',   color: '#67c23a' },
  llm:      { icon: '🧠', label: 'LLM',    color: '#9b59b6' },
}

const NODE_W = 130
const NODE_H = 60

/* ===== Inline SVG Icons ===== */
function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function Trash2Icon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
}
function ChevronLeftIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
}
function XIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}

/* ===== Edge path: smooth cubic bezier ===== */
function edgePath(sx, sy, tx, ty) {
  const midX = (sx + tx) / 2
  return `M${sx},${sy} C${midX},${sy} ${midX},${ty} ${tx},${ty}`
}

function connPoint(node, side) {
  return {
    x: side === 'right' ? node.position_x + NODE_W : node.position_x,
    y: node.position_y + NODE_H / 2,
  }
}

export default function AgentCanvasTool() {
  // --- View (URL-persisted: projects | canvas) ---
  const [searchParams, setSearchParams] = useSearchParams()
  const validModes = ['projects', 'canvas']
  const viewMode = validModes.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'projects'
  const setViewMode = (mode) => {
    setSearchParams({ tab: mode }, { replace: true })
  }
  const [error, setError] = useState('')

  // --- Projects ---
  const [projects, setProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [newProjectName, setNewProjectName] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)

  // --- Canvas ---
  const [project, setProject] = useState(null)
  const [canvasLoading, setCanvasLoading] = useState(false)
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const canvasRef = useRef(null)

  // --- Selection ---
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)
  const [nodeForm, setNodeForm] = useState({ label: '', config: '' })

  // --- Drag ---
  const dragRef = useRef(null)
  const [draggingId, setDraggingId] = useState(null)

  // --- Connect ---
  const connectRef = useRef(null)
  const [connecting, setConnecting] = useState(null)

  // --- Add node popup ---
  const [addNodeOpen, setAddNodeOpen] = useState(false)
  const [addNodePos, setAddNodePos] = useState({ x: 100, y: 60 })

  /* ===== Projects ===== */
  const loadProjects = useCallback(async () => {
    setProjectsLoading(true)
    try {
      const data = await apiProxy('agentcanvas', 'api/projects')
      setProjects(Array.isArray(data) ? data : (data?.projects || []))
    } catch (err) { setError(err.message) }
    finally { setProjectsLoading(false) }
  }, [])

  /* ===== Open Canvas ===== */
  const openCanvas = useCallback(async (projectId) => {
    setCanvasLoading(true)
    setSelectedNodeId(null); setSelectedEdgeId(null)
    try {
      const data = await apiProxy('agentcanvas', `api/projects/${projectId}`)
      setProject(data?.project || data)
      setNodes(Array.isArray(data?.nodes) ? data.nodes : [])
      setEdges(Array.isArray(data?.edges) ? data.edges : [])
      setViewMode('canvas')
    } catch (err) { setError(err.message) }
    finally { setCanvasLoading(false) }
  }, [])

  const createProject = useCallback(async (e) => {
    e?.preventDefault()
    if (!newProjectName.trim()) return
    setCreatingProject(true)
    try {
      const data = await apiProxy('agentcanvas', 'api/projects', {
        method: 'POST', body: JSON.stringify({ name: newProjectName.trim() }),
      })
      setNewProjectName('')
      await loadProjects()
      const pid = data?.id || data?.project?.id
      if (pid) openCanvas(pid)
    } catch (err) { setError(err.message) }
    finally { setCreatingProject(false) }
  }, [newProjectName, loadProjects, openCanvas])

  const deleteProject = useCallback(async (id) => {
    try {
      await apiProxy('agentcanvas', `api/projects/${id}`, { method: 'DELETE' })
      loadProjects()
    } catch (err) { setError(err.message) }
  }, [loadProjects])

  /* ===== Node CRUD ===== */
  const saveNodePos = useCallback(async (nodeId, x, y) => {
    try {
      await apiProxy('agentcanvas', `api/nodes/${nodeId}`, {
        method: 'PUT', body: JSON.stringify({ position_x: Math.round(x), position_y: Math.round(y) }),
      })
    } catch { /* silent */ }
  }, [])

  const createNode = useCallback(async (type) => {
    if (!project) return
    try {
      const nt = NODE_TYPES[type]
      const data = await apiProxy('agentcanvas', `api/projects/${project.id}/nodes`, {
        method: 'POST', body: JSON.stringify({
          type, label: nt.label, config: '{}',
          position_x: addNodePos.x, position_y: addNodePos.y,
        }),
      })
      setNodes((prev) => [...prev, (data?.node || data)])
      setAddNodeOpen(false)
    } catch (err) { setError(err.message) }
  }, [project, addNodePos])

  const deleteNode = useCallback(async (id) => {
    try {
      await apiProxy('agentcanvas', `api/nodes/${id}`, { method: 'DELETE' })
      setNodes((prev) => prev.filter((n) => n.id !== id))
      setEdges((prev) => prev.filter((e) => e.source_node_id !== id && e.target_node_id !== id))
      if (selectedNodeId === id) setSelectedNodeId(null)
    } catch (err) { setError(err.message) }
  }, [selectedNodeId])

  /* ===== Edge CRUD ===== */
  const createEdge = useCallback(async (sourceId, targetId) => {
    if (sourceId === targetId) return
    if (!project) return
    if (edges.some((e) => e.source_node_id === sourceId && e.target_node_id === targetId)) return
    try {
      const data = await apiProxy('agentcanvas', `api/projects/${project.id}/edges`, {
        method: 'POST', body: JSON.stringify({ source_node_id: sourceId, target_node_id: targetId, label: '' }),
      })
      setEdges((prev) => [...prev, (data?.edge || data)])
    } catch (err) { setError(err.message) }
  }, [project, edges])

  const deleteEdge = useCallback(async (id) => {
    try {
      await apiProxy('agentcanvas', `api/edges/${id}`, { method: 'DELETE' })
      setEdges((prev) => prev.filter((e) => e.id !== id))
      if (selectedEdgeId === id) setSelectedEdgeId(null)
    } catch (err) { setError(err.message) }
  }, [selectedEdgeId])

  /* ===== Property panel ===== */
  useEffect(() => {
    if (selectedNodeId) {
      const n = nodes.find((nd) => nd.id === selectedNodeId)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (n) setNodeForm({ label: n.label || '', config: typeof n.config === 'string' ? n.config : JSON.stringify(n.config || {}, null, 2) })
    }
  }, [selectedNodeId, nodes])

  const saveNodeProps = useCallback(async (e) => {
    e?.preventDefault()
    if (!selectedNodeId) return
    try {
      await apiProxy('agentcanvas', `api/nodes/${selectedNodeId}`, {
        method: 'PUT', body: JSON.stringify({ label: nodeForm.label, config: nodeForm.config }),
      })
      setNodes((prev) => prev.map((n) =>
        n.id === selectedNodeId ? { ...n, label: nodeForm.label, config: nodeForm.config } : n
      ))
    } catch (err) { setError(err.message) }
  }, [selectedNodeId, nodeForm])

  /* ===== Drag handlers ===== */
  const handleNodeMouseDown = useCallback((e, node) => {
    if (e.button !== 0) return
    e.stopPropagation()
    setSelectedNodeId(node.id); setSelectedEdgeId(null)
    dragRef.current = { nodeId: node.id, sx: e.clientX, sy: e.clientY, ox: node.position_x, oy: node.position_y }
    setDraggingId(node.id)

    const onMove = (ev) => {
      if (!dragRef.current) return
      setNodes((prev) => prev.map((n) =>
        n.id === dragRef.current.nodeId
          ? { ...n, position_x: dragRef.current.ox + ev.clientX - dragRef.current.sx, position_y: dragRef.current.oy + ev.clientY - dragRef.current.sy }
          : n
      ))
    }
    const onUp = () => {
      const dr = dragRef.current
      dragRef.current = null; setDraggingId(null)
      if (dr) {
        const n = nodes.find((nd) => nd.id === dr.nodeId)
        if (n) saveNodePos(n.id, n.position_x, n.position_y)
      }
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }, [nodes, saveNodePos])

  /* ===== Connect handlers ===== */
  const handleConnMouseDown = useCallback((e, node) => {
    e.stopPropagation(); e.preventDefault()
    const pt = connPoint(node, 'right')
    const rect = canvasRef.current?.getBoundingClientRect()
    connectRef.current = { sourceNodeId: node.id, sx: pt.x, sy: pt.y }
    setConnecting({ sx: pt.x, sy: pt.y, ex: e.clientX - (rect?.left || 0), ey: e.clientY - (rect?.top || 0) })

    const onMove = (ev) => {
      const r = canvasRef.current?.getBoundingClientRect()
      setConnecting((prev) => prev ? {
        ...prev,
        ex: ev.clientX - (r?.left || 0) + (canvasRef.current?.scrollLeft || 0),
        ey: ev.clientY - (r?.top || 0) + (canvasRef.current?.scrollTop || 0),
      } : null)
    }
    const onUp = (ev) => {
      // check if mouse is over a target connector
      const target = document.elementFromPoint(ev.clientX, ev.clientY)
      if (target?.classList?.contains('ac-conn--left')) {
        const nodeEl = target.closest('.ac-node')
        if (nodeEl) {
          const idx = [...nodeEl.parentElement.children].filter((c) => c.classList.contains('ac-node')).indexOf(nodeEl)
          const targetNode = nodes[idx]
          if (targetNode && connectRef.current) {
            createEdge(connectRef.current.sourceNodeId, targetNode.id)
          }
        }
      }
      connectRef.current = null; setConnecting(null)
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }, [nodes, createEdge])

  /* ===== Canvas click ===== */
  const handleCanvasMouseDown = useCallback((e) => {
    if (e.target === canvasRef.current || e.target.classList.contains('ac-canvas-sheet')) {
      setSelectedNodeId(null); setSelectedEdgeId(null)
      const rect = canvasRef.current?.getBoundingClientRect()
      setAddNodePos({
        x: e.clientX - (rect?.left || 0) + (canvasRef.current?.scrollLeft || 0) - 65,
        y: e.clientY - (rect?.top || 0) + (canvasRef.current?.scrollTop || 0) - 30,
      })
      setAddNodeOpen(true)
    }
  }, [])

  /* ===== Init ===== */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadProjects() }, [loadProjects])

  // canvas view fallback: URL says canvas but no project loaded → return to projects list
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (viewMode === 'canvas' && !project) {
      setViewMode('projects')
    }
  }, [viewMode, project])

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  /* ===== Render ===== */
  return (
    <div className="ac-shell">

      {error && (
        <div className="ac-error-banner">
          <p>{error}</p>
          <button className="ac-close-btn" onClick={() => setError('')}><XIcon /></button>
        </div>
      )}

      {/* ========== PROJECT LIST ========== */}
      {viewMode === 'projects' && (
        <div className="ac-projects">
          <div className="ac-projects-head">
            <h3 className="ac-section-title">我的画布</h3>
            <form className="ac-create-form" onSubmit={createProject}>
              <input
                type="text" className="ac-input-inline" placeholder="新画布名称"
                aria-label="新画布名称"
                value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
              />
              <button type="submit" className="ac-action-btn" disabled={creatingProject || !newProjectName.trim()}>
                <PlusIcon/> 新建
              </button>
            </form>
          </div>

          {projectsLoading ? (
            <div className="ac-loading"><div className="ac-spinner"/><p>加载中…</p></div>
          ) : projects.length === 0 ? (
            <p className="ac-empty-text">暂无画布</p>
          ) : (
            <div className="ac-project-list">
              {projects.map((p) => (
                <div key={p.id} className="ac-project-card" onClick={() => openCanvas(p.id)}>
                  <div className="ac-project-card-info">
                    <span className="ac-project-card-name">{p.name}</span>
                    {p.updated_at && <span className="ac-project-card-time">{new Date(p.updated_at).toLocaleDateString('zh-CN')}</span>}
                  </div>
                  <button className="ac-icon-btn ac-icon-btn--danger" title="删除" onClick={(e) => { e.stopPropagation(); deleteProject(p.id) }}>
                    <Trash2Icon/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== CANVAS VIEW ========== */}
      {viewMode === 'canvas' && (
        <div className="ac-canvas-layout">
          {/* Toolbar */}
          <div className="ac-toolbar">
            <button className="ac-back-btn" onClick={() => { setViewMode('projects'); setProject(null) }}>
              <ChevronLeftIcon/> 返回
            </button>
            <span className="ac-project-name">{project?.name}</span>
            <button className="ac-action-btn" onClick={() => { setAddNodePos({ x: 200, y: 60 }); setAddNodeOpen(true) }}>
              <PlusIcon/> 添加节点
            </button>
          </div>

          <div className="ac-canvas-body">
            {canvasLoading ? (
              <div className="ac-loading"><div className="ac-spinner"/><p>加载画布…</p></div>
            ) : (
              <>
                <div className="ac-canvas-area" ref={canvasRef} onMouseDown={handleCanvasMouseDown}>
                  <div className="ac-canvas-sheet">
                    {/* SVG edges */}
                    <svg className="ac-edges" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                      {edges.map((e) => {
                        const src = nodes.find((n) => n.id === e.source_node_id)
                        const tgt = nodes.find((n) => n.id === e.target_node_id)
                        if (!src || !tgt) return null
                        const sp = connPoint(src, 'right')
                        const tp = connPoint(tgt, 'left')
                        const sel = selectedEdgeId === e.id
                        return (
                          <g key={e.id}>
                            <path
                              d={edgePath(sp.x, sp.y, tp.x, tp.y)}
                              fill="none" stroke={sel ? 'var(--accent)' : 'var(--text-muted)'}
                              strokeWidth={sel ? 2.5 : 1.5}
                              markerEnd={sel ? 'url(#ac-arrow-sel)' : 'url(#ac-arrow)'}
                              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                              onClick={(ev) => { ev.stopPropagation(); setSelectedEdgeId(e.id); setSelectedNodeId(null) }}
                            />
                            {sel && (
                              <foreignObject x={(sp.x + tp.x) / 2 - 12} y={(sp.y + tp.y) / 2 - 12} width="24" height="24">
                                <button className="ac-edge-del" onClick={(ev) => { ev.stopPropagation(); deleteEdge(e.id) }}><Trash2Icon/></button>
                              </foreignObject>
                            )}
                          </g>
                        )
                      })}
                      {connecting && (
                        <path
                          d={edgePath(connecting.sx, connecting.sy, connecting.ex, connecting.ey)}
                          fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="6 3"
                        />
                      )}
                      <defs>
                        <marker id="ac-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                          <path d="M0,0 L10,5 L0,10 z" fill="var(--text-muted)"/>
                        </marker>
                        <marker id="ac-arrow-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)"/>
                        </marker>
                      </defs>
                    </svg>

                    {/* Nodes */}
                    {nodes.map((n) => {
                      const nt = NODE_TYPES[n.type] || NODE_TYPES.process
                      const sel = selectedNodeId === n.id
                      return (
                        <div
                          key={n.id}
                          className={`ac-node ${sel ? 'ac-node--selected' : ''} ${draggingId === n.id ? 'ac-node--dragging' : ''}`}
                          style={{ left: n.position_x, top: n.position_y, borderColor: sel ? nt.color : undefined }}
                          onMouseDown={(e) => handleNodeMouseDown(e, n)}
                        >
                          <span className="ac-node-icon" style={{ background: nt.color + '20', color: nt.color }}>{nt.icon}</span>
                          <span className="ac-node-label">{n.label || nt.label}</span>
                          <div className="ac-conn ac-conn--left" title="连接目标"/>
                          <div className="ac-conn ac-conn--right" title="拖拽连线" onMouseDown={(e) => handleConnMouseDown(e, n)}/>
                        </div>
                      )
                    })}

                    {/* Add node popup */}
                    {addNodeOpen && (
                      <div className="ac-add-popup" style={{ left: addNodePos.x + 65, top: addNodePos.y + 30 }}>
                        <div className="ac-add-popup-head">
                          <span>添加节点</span>
                          <button className="ac-close-btn" onClick={() => setAddNodeOpen(false)}><XIcon/></button>
                        </div>
                        {Object.entries(NODE_TYPES).map(([type, nt]) => (
                          <button key={type} className="ac-add-item" onClick={() => createNode(type)}>
                            <span className="ac-add-dot" style={{ background: nt.color }}/> {nt.icon} {nt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Property panel */}
                {selectedNode && (
                  <div className="ac-panel">
                    <div className="ac-panel-head">
                      <h4>属性</h4>
                      <button className="ac-close-btn" onClick={() => setSelectedNodeId(null)}><XIcon/></button>
                    </div>
                    <div className="ac-panel-body">
                      <div className="ac-panel-type">
                        {NODE_TYPES[selectedNode.type]?.icon} {NODE_TYPES[selectedNode.type]?.label || selectedNode.type}
                      </div>
                      <label className="ac-field">
                        <span className="ac-field-label">标签</span>
                        <input type="text" className="ac-input" value={nodeForm.label}
                          onChange={(e) => setNodeForm((f) => ({ ...f, label: e.target.value }))}/>
                      </label>
                      <label className="ac-field">
                        <span className="ac-field-label">配置 (JSON)</span>
                        <textarea className="ac-textarea" rows={8} value={nodeForm.config}
                          onChange={(e) => setNodeForm((f) => ({ ...f, config: e.target.value }))}/>
                      </label>
                      <div className="ac-panel-actions">
                        <button className="ac-save-btn" onClick={saveNodeProps}>保存</button>
                        <button className="ac-delete-btn" onClick={() => deleteNode(selectedNode.id)}>
                          <Trash2Icon/> 删除节点
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
