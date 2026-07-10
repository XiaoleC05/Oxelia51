import { useEffect, useState, useCallback } from 'react'
import { apiProxy } from '../../api'
import './SecretStoreTool.css'

/* ===== Inline SVG Icons ===== */
function LockIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> }
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> }
function PlusIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function CopyIcon()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> }
function EyeIcon()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
function EyeOffIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="m14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> }
function Trash2Icon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> }
function Edit3Icon()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> }
function DownloadIcon(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
function FolderIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> }
function XIcon()      { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> }
function ChevronLeftIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> }
function CheckIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> }

/* ===== 8 Standard Templates ===== */
const BUILTIN_TEMPLATES = [
  { type: 'api-config', name: 'API 配置', fields: [
    { key: 'API Key', sensitive: true }, { key: 'Base URL' }, { key: 'Model Name' }, { key: 'Org ID' }
  ]},
  { type: 'login-credential', name: '登录凭证', fields: [
    { key: 'Website' }, { key: 'URL' }, { key: 'Username' }, { key: 'Password', sensitive: true }, { key: '2FA Secret', sensitive: true }
  ]},
  { type: 'database', name: '数据库连接', fields: [
    { key: 'Type' }, { key: 'Host' }, { key: 'Port' }, { key: 'Username' }, { key: 'Password', sensitive: true }, { key: 'DB Name' }
  ]},
  { type: 'ssh', name: '服务器 SSH', fields: [
    { key: 'Host' }, { key: 'Port' }, { key: 'Username' }, { key: 'Auth Type' }, { key: 'Password/Key', sensitive: true }
  ]},
  { type: 'cloud-key', name: '云服务密钥', fields: [
    { key: 'Provider' }, { key: 'Access Key', sensitive: true }, { key: 'Secret Key', sensitive: true }, { key: 'Region' }
  ]},
  { type: 'email', name: '邮箱账户', fields: [
    { key: 'Email' }, { key: 'Password', sensitive: true }, { key: 'SMTP Server' }, { key: 'Port' }, { key: 'SSL' }
  ]},
  { type: 'wifi', name: 'WiFi 网络', fields: [
    { key: 'SSID' }, { key: 'Password', sensitive: true }, { key: 'Security Type' }
  ]},
  { type: 'custom', name: '自定义', fields: [] },
]

function isSensitive(key) {
  const lower = key.toLowerCase()
  return lower.includes('password') || lower.includes('secret') || lower.includes('key') || lower.includes('2fa')
}

export default function SecretStoreTool() {
  // --- View ---
  const [viewMode, setViewMode] = useState('list') // list | editor | detail | combos
  const [error, setError] = useState('')

  // --- Entries ---
  const [entries, setEntries] = useState([])
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // --- Editor ---
  const [editingId, setEditingId] = useState(null)
  const [editorTitle, setEditorTitle] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [formFields, setFormFields] = useState([])
  const [saving, setSaving] = useState(false)
  const [addCustomKey, setAddCustomKey] = useState('')

  // --- Detail ---
  const [detailEntry, setDetailEntry] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [visibleFields, setVisibleFields] = useState({}) // key → bool
  const [showAllSensitive, setShowAllSensitive] = useState(false)

  // --- Combos ---
  const [combos, setCombos] = useState([])
  const [combosLoading, setCombosLoading] = useState(false)
  const [newComboName, setNewComboName] = useState('')
  const [comboEntries, setComboEntries] = useState(new Set())
  const [creatingCombo, setCreatingCombo] = useState(false)

  // --- Export ---
  const [exporting, setExporting] = useState(false)

  /* ===== Load entries ===== */
  const loadEntries = useCallback(async () => {
    setEntriesLoading(true)
    try {
      const data = await apiProxy('secretstore', 'api/entries')
      setEntries(Array.isArray(data) ? data : (data?.entries || []))
    } catch (err) { setError(err.message) }
    finally { setEntriesLoading(false) }
  }, [])

  /* ===== Delete entry ===== */
  const deleteEntry = useCallback(async (id) => {
    try {
      await apiProxy('secretstore', `api/entries/${id}`, { method: 'DELETE' })
      loadEntries()
    } catch (err) { setError(err.message) }
  }, [loadEntries])

  /* ===== Open editor ===== */
  const openNewEditor = useCallback(() => {
    setEditingId(null)
    setEditorTitle('')
    setSelectedTemplate(null)
    setFormFields([])
    setViewMode('editor')
  }, [])

  const openEditEditor = useCallback((entry) => {
    setEditingId(entry.id)
    setEditorTitle(entry.title || '')
    const tpl = BUILTIN_TEMPLATES.find((t) => t.type === entry.template_type)
    setSelectedTemplate(tpl || BUILTIN_TEMPLATES.find((t) => t.type === 'custom'))
    const fields = (entry.fields || []).map((f) => ({ key: f.key, value: f.value || '', sensitive: isSensitive(f.key) }))
    setFormFields(fields)
    setViewMode('editor')
  }, [])

  /* ===== Template selection ===== */
  const selectTemplate = useCallback((tpl) => {
    setSelectedTemplate(tpl)
    setFormFields(tpl.fields.map((f) => ({ key: f.key, value: '', sensitive: f.sensitive || isSensitive(f.key) })))
  }, [])

  /* ===== Form field operations ===== */
  const updateFieldValue = useCallback((idx, value) => {
    setFormFields((prev) => prev.map((f, i) => i === idx ? { ...f, value } : f))
  }, [])

  const addCustomField = useCallback(() => {
    const key = addCustomKey.trim()
    if (!key || formFields.some((f) => f.key === key)) return
    setFormFields((prev) => [...prev, { key, value: '', sensitive: isSensitive(key) }])
    setAddCustomKey('')
  }, [addCustomKey, formFields])

  const removeField = useCallback((idx) => {
    setFormFields((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  /* ===== Save ===== */
  const saveEntry = useCallback(async (e) => {
    e.preventDefault()
    if (!editorTitle.trim()) return
    setSaving(true)
    try {
      const fields = formFields.filter((f) => f.key).map((f) => ({ key: f.key, value: f.value }))
      const body = {
        title: editorTitle.trim(),
        template_type: selectedTemplate?.type || 'custom',
        fields,
      }
      if (editingId) {
        await apiProxy('secretstore', `api/entries/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await apiProxy('secretstore', 'api/entries', { method: 'POST', body: JSON.stringify(body) })
      }
      setViewMode('list')
      loadEntries()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }, [editorTitle, selectedTemplate, formFields, editingId, loadEntries])

  /* ===== Detail ===== */
  const openDetail = useCallback(async (id) => {
    setDetailLoading(true)
    setVisibleFields({})
    setShowAllSensitive(false)
    try {
      const data = await apiProxy('secretstore', `api/entries/${id}`)
      setDetailEntry(data?.entry || data)
      setViewMode('detail')
    } catch (err) { setError(err.message) }
    finally { setDetailLoading(false) }
  }, [])

  const toggleFieldVisible = useCallback((key) => {
    setVisibleFields((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  /* ===== Combos ===== */
  const loadCombos = useCallback(async () => {
    setCombosLoading(true)
    try {
      const data = await apiProxy('secretstore', 'api/combos')
      setCombos(Array.isArray(data) ? data : (data?.combos || []))
    } catch (err) { setError(err.message) }
    finally { setCombosLoading(false) }
  }, [])

  const createCombo = useCallback(async () => {
    if (!newComboName.trim() || comboEntries.size === 0) return
    setCreatingCombo(true)
    try {
      await apiProxy('secretstore', 'api/combos', {
        method: 'POST', body: JSON.stringify({ name: newComboName.trim(), entry_ids: [...comboEntries] }),
      })
      setNewComboName('')
      setComboEntries(new Set())
      loadCombos()
    } catch (err) { setError(err.message) }
    finally { setCreatingCombo(false) }
  }, [newComboName, comboEntries, loadCombos])

  const deleteCombo = useCallback(async (id) => {
    try {
      await apiProxy('secretstore', `api/combos/${id}`, { method: 'DELETE' })
      loadCombos()
    } catch (err) { setError(err.message) }
  }, [loadCombos])

  const toggleComboEntry = useCallback((id) => {
    setComboEntries((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  /* ===== Export ===== */
  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const data = await apiProxy('secretstore', 'api/vault/export', { method: 'POST' })
      if (data?.url) window.open(data.url, '_blank')
      else if (data?.content) {
        const blob = new Blob([data.content], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'secretstore-export.enc'; a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) { setError(err.message) }
    finally { setExporting(false) }
  }, [])

  /* ===== Init ===== */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadEntries() }, [loadEntries])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (viewMode === 'combos') { loadEntries(); loadCombos() } }, [viewMode, loadEntries, loadCombos])

  const filtered = entries.filter((e) =>
    !searchQuery || e.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text).catch(() => {}) }

  /* ===== Render ===== */
  return (
    <div className="ss-shell">

      {error && (
        <div className="ss-error-banner">
          <p>{error}</p>
          <button className="ss-close-btn" onClick={() => setError('')}><XIcon/></button>
        </div>
      )}

      {/* ===== Entry List ===== */}
      {viewMode === 'list' && (
        <div className="ss-list ss-view-transition">
          <div className="ss-list-toolbar">
            <div className="ss-search-wrap">
              <SearchIcon/>
              <input type="text" className="ss-search-input" placeholder="搜索条目…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
            </div>
            <div className="ss-list-actions">
              <button className="ss-action-btn" onClick={openNewEditor}><PlusIcon/> 新建</button>
              <button className="ss-tab-btn" onClick={() => setViewMode('combos')}><FolderIcon/> Combo</button>
              <button className="ss-tab-btn" onClick={handleExport} disabled={exporting}>
                <DownloadIcon/> {exporting ? '导出中…' : '导出'}
              </button>
            </div>
          </div>

          {entriesLoading ? (
            <div className="ss-loading"><div className="ss-spinner"/><p>解密中…</p></div>
          ) : filtered.length === 0 ? (
            <p className="ss-empty-text">{searchQuery ? '无匹配条目' : '还没有保存的密码，点击新建开始'}</p>
          ) : (
            <div className="ss-entry-list">
              {filtered.map((e) => (
                <div key={e.id} className="ss-entry-card" onClick={() => openDetail(e.id)}>
                  <div className="ss-entry-card-body">
                    <div className="ss-entry-card-head">
                      <LockIcon/>
                      <span className="ss-entry-card-title">{e.title}</span>
                      {e.template_type && <span className="ss-template-tag">{BUILTIN_TEMPLATES.find(t=>t.type===e.template_type)?.name || e.template_type}</span>}
                    </div>
                    <span className="ss-entry-card-time">
                      {e.updated_at ? new Date(e.updated_at).toLocaleDateString('zh-CN') : ''}
                    </span>
                  </div>
                  <div className="ss-entry-card-actions" onClick={(ev) => ev.stopPropagation()}>
                    <button className="ss-icon-btn" title="编辑" onClick={() => openEditEditor(e)}><Edit3Icon/></button>
                    <button className="ss-icon-btn ss-icon-btn--danger" title="删除" onClick={() => deleteEntry(e.id)}><Trash2Icon/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Editor ===== */}
      {viewMode === 'editor' && (
        <div className="ss-editor ss-view-transition">
          <div className="ss-editor-head">
            <button className="ss-back-btn" onClick={() => setViewMode('list')}><ChevronLeftIcon/> 返回</button>
            <span className="ss-editor-mode">{editingId ? '编辑条目' : '新建条目'}</span>
          </div>

          {/* Step 1: select template */}
          {!selectedTemplate ? (
            <div className="ss-template-picker">
              <h4 className="ss-section-title">选择模板</h4>
              <div className="ss-template-grid">
                {BUILTIN_TEMPLATES.map((tpl) => (
                  <button key={tpl.type} className="ss-template-card" onClick={() => selectTemplate(tpl)}>
                    <LockIcon/>
                    <span>{tpl.name}</span>
                    <span className="ss-template-fields-count">{tpl.fields.length > 0 ? `${tpl.fields.length} 个字段` : '自由定义'}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Step 2: fill fields */
            <form className="ss-editor-form" onSubmit={saveEntry}>
              <div className="ss-editor-template">
                <span className="ss-template-tag">{selectedTemplate.name}</span>
                <button type="button" className="ss-text-btn" onClick={() => setSelectedTemplate(null)}>更换模板</button>
              </div>

              <label className="ss-field">
                <span className="ss-field-label">标题</span>
                <input type="text" className="ss-input" placeholder="为这个条目命名" value={editorTitle} onChange={(e) => setEditorTitle(e.target.value)}/>
              </label>

              {formFields.map((f, i) => (
                <div key={i} className="ss-form-field">
                  <label className="ss-field">
                    <span className="ss-field-label">{f.key}{f.sensitive ? <span className="ss-sensitive-dot">●</span> : ''}</span>
                    <div className="ss-input-row">
                      <input
                        type="password" className="ss-input"
                        placeholder={f.key}
                        value={f.value}
                        onChange={(e) => updateFieldValue(i, e.target.value)}
                      />
                      {f.value && (
                        <button type="button" className="ss-icon-btn" title="复制" onClick={() => copyToClipboard(f.value)}>
                          <CopyIcon/>
                        </button>
                      )}
                    </div>
                  </label>
                  {selectedTemplate?.type === 'custom' && (
                    <button type="button" className="ss-remove-field-btn" onClick={() => removeField(i)}><XIcon/></button>
                  )}
                </div>
              ))}

              {selectedTemplate?.type === 'custom' && (
                <div className="ss-add-field">
                  <input type="text" className="ss-input" placeholder="字段名" value={addCustomKey}
                    onChange={(e) => setAddCustomKey(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomField() }}}/>
                  <button type="button" className="ss-action-btn" onClick={addCustomField}><PlusIcon/> 添加</button>
                </div>
              )}

              <div className="ss-editor-actions">
                <button type="submit" className="ss-save-btn" disabled={saving || !editorTitle.trim()}>
                  {saving ? '加密保存中…' : '保存'}
                </button>
                <button type="button" className="ss-cancel-btn" onClick={() => setViewMode('list')}>取消</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ===== Detail ===== */}
      {viewMode === 'detail' && (
        <div className="ss-detail ss-view-transition">
          {detailLoading ? (
            <div className="ss-loading"><div className="ss-spinner"/><p>加载详情…</p></div>
          ) : detailEntry ? (
            <>
              <div className="ss-detail-head">
                <button className="ss-back-btn" onClick={() => setViewMode('list')}><ChevronLeftIcon/> 返回</button>
                <div className="ss-detail-actions">
                  <button
                    className={`ss-toggle-all-btn ${showAllSensitive ? 'ss-toggle-all-btn--active' : ''}`}
                    onClick={() => setShowAllSensitive((v) => !v)}
                    title={showAllSensitive ? '隐藏全部敏感字段' : '显示全部敏感字段'}
                  >
                    {showAllSensitive ? <EyeOffIcon/> : <EyeIcon/>}
                    <span>{showAllSensitive ? '隐藏全部' : '显示全部'}</span>
                  </button>
                  <button className="ss-icon-btn" title="编辑" onClick={() => openEditEditor(detailEntry)}><Edit3Icon/></button>
                  <button className="ss-icon-btn ss-icon-btn--danger" title="删除" onClick={() => { deleteEntry(detailEntry.id); setViewMode('list') }}><Trash2Icon/></button>
                </div>
              </div>

              <h3 className="ss-detail-title">{detailEntry.title}</h3>
              {detailEntry.template_type && (
                <span className="ss-template-tag">{BUILTIN_TEMPLATES.find(t=>t.type===detailEntry.template_type)?.name || detailEntry.template_type}</span>
              )}

              <div className="ss-detail-fields">
                {(detailEntry.fields || []).map((f) => {
                  const sens = isSensitive(f.key)
                  const visible = showAllSensitive || visibleFields[f.key]
                  return (
                    <div key={f.key} className="ss-detail-field">
                      <span className="ss-detail-field-key">{f.key}</span>
                      <div className="ss-detail-field-val">
                        {sens && !visible ? (
                          <>
                            <span className="ss-masked">••••••••</span>
                            <button className="ss-icon-btn" title="显示" onClick={() => toggleFieldVisible(f.key)}><EyeIcon/></button>
                          </>
                        ) : (
                          <>
                            <span className="ss-field-value">{f.value || '—'}</span>
                            {sens && !showAllSensitive && <button className="ss-icon-btn" title="隐藏" onClick={() => toggleFieldVisible(f.key)}><EyeOffIcon/></button>}
                            {f.value && <button className="ss-icon-btn" title="复制" onClick={() => copyToClipboard(f.value)}><CopyIcon/></button>}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="ss-empty-text">条目不存在</p>
          )}
        </div>
      )}

      {/* ===== Combos ===== */}
      {viewMode === 'combos' && (
        <div className="ss-combos ss-view-transition">
          <div className="ss-combos-head">
            <button className="ss-back-btn" onClick={() => setViewMode('list')}><ChevronLeftIcon/> 返回</button>
            <h3 className="ss-section-title">Combo 管理</h3>
          </div>

          {/* Create combo */}
          <div className="ss-combo-create">
            <h4 className="ss-sub-title">新建 Combo</h4>
            <div className="ss-combo-create-form">
              <input type="text" className="ss-input" placeholder="Combo 名称" value={newComboName} onChange={(e) => setNewComboName(e.target.value)}/>
              <span className="ss-combo-count">{comboEntries.size} 条选中</span>
              <button className="ss-save-btn" onClick={createCombo} disabled={creatingCombo || !newComboName.trim() || comboEntries.size === 0}>
                <CheckIcon/> 创建
              </button>
            </div>
            <div className="ss-combo-select-grid">
              {entries.map((e) => (
                <label key={e.id} className={`ss-combo-select-card ${comboEntries.has(e.id) ? 'ss-combo-select-card--active' : ''}`}>
                  <input type="checkbox" checked={comboEntries.has(e.id)} onChange={() => toggleComboEntry(e.id)}/>
                  <span className="ss-combo-select-name">{e.title}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Existing combos */}
          <h4 className="ss-sub-title">已有 Combo</h4>
          {combosLoading ? (
            <div className="ss-loading"><div className="ss-spinner"/></div>
          ) : combos.length === 0 ? (
            <p className="ss-empty-text">暂无 Combo</p>
          ) : (
            <div className="ss-combo-list">
              {combos.map((c) => (
                <div key={c.id} className="ss-combo-card">
                  <div className="ss-combo-card-info">
                    <FolderIcon/>
                    <span className="ss-combo-card-name">{c.name}</span>
                    {c.entry_count != null && <span className="ss-combo-card-count">{c.entry_count} 条</span>}
                  </div>
                  <button className="ss-icon-btn ss-icon-btn--danger" title="删除" onClick={() => deleteCombo(c.id)}><Trash2Icon/></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
