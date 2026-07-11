import { useEffect, useState, useCallback } from 'react'
import { apiProxy } from '../../api'
import './AIHelperTool.css'

/* ===== Inline SVG Icons (Lucide style, 16×16) ===== */
function SparklesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v2" /><path d="M12 19v2" /><path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" /><path d="M21 12h-2" /><path d="M5 12H3" />
      <path d="M6.34 17.66l-1.41 1.41" /><path d="M19.07 4.93l-1.41 1.41" />
      <circle cx="12" cy="12" r="3" /><circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="21" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="3" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function StarIcon({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
function Trash2Icon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}
function Edit3Icon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}
function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
function BookTemplateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}
function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}
function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
function TagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2H2v10l9.17 9.17a2 2 0 0 0 2.83 0l7-7a2 2 0 0 0 0-2.83L12 2z" />
      <path d="M7 7h.01" />
    </svg>
  )
}

/* ===== Constants ===== */
const CATEGORIES = ['编程', '写作', '翻译', '分析', '创意', '通用']
const CATEGORY_OPTIONS = ['全部', ...CATEGORIES]

function emptyPrompt() {
  return { title: '', content: '', category: '通用', tags: '', variables: '' }
}

export default function AIHelperTool() {
  // --- View ---
  const [viewMode, setViewMode] = useState('list') // list | templates | settings
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState(null) // null = creating
  const [error, setError] = useState('')

  // --- List ---
  const [prompts, setPrompts] = useState([])
  const [promptsLoading, setPromptsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('全部')
  const [filterTag, setFilterTag] = useState('')
  const [filterFavorite, setFilterFavorite] = useState(false)

  // --- Editor form ---
  const [form, setForm] = useState(emptyPrompt())
  const [saving, setSaving] = useState(false)
  const [enhancing, setEnhancing] = useState(false)

  // --- Templates ---
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateCategory, setTemplateCategory] = useState('全部')

  // --- Settings ---
  const [settings, setSettings] = useState({ api_key: '', api_base: '', model: '' })
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)

  /* ===== Load prompts ===== */
  const loadPrompts = useCallback(async (q, cat, tag, fav) => {
    setPromptsLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (cat && cat !== '全部') params.set('category', cat)
      if (tag) params.set('tag', tag)
      if (fav) params.set('favorite', '1')
      const qs = params.toString()
      const data = await apiProxy('aihelper', qs ? `api/prompts?${qs}` : 'api/prompts')
      setPrompts(Array.isArray(data) ? data : (data?.prompts || []))
    } catch (err) { setError(err.message) }
    finally { setPromptsLoading(false) }
  }, [])

  /* ===== Toggle favorite ===== */
  const toggleFavorite = useCallback(async (id, current) => {
    try {
      await apiProxy('aihelper', `api/prompts/${id}/favorite`, { method: 'PATCH' })
      setPrompts((prev) => prev.map((p) =>
        p.id === id ? { ...p, favorite: !current } : p
      ))
    } catch (err) { setError(err.message) }
  }, [])

  /* ===== Delete ===== */
  const deletePrompt = useCallback(async (id) => {
    try {
      await apiProxy('aihelper', `api/prompts/${id}`, { method: 'DELETE' })
      setPrompts((prev) => prev.filter((p) => p.id !== id))
    } catch (err) { setError(err.message) }
  }, [])

  /* ===== Open editor ===== */
  const openEditor = useCallback((prompt) => {
    if (prompt) {
      setEditingPrompt(prompt)
      setForm({
        title: prompt.title || '',
        content: prompt.content || '',
        category: prompt.category || '通用',
        tags: Array.isArray(prompt.tags) ? prompt.tags.join(', ') : (prompt.tags || ''),
        variables: Array.isArray(prompt.variables) ? prompt.variables.join(', ') : (prompt.variables || ''),
      })
    } else {
      setEditingPrompt(null)
      setForm(emptyPrompt())
    }
    setEditorOpen(true)
  }, [])

  /* ===== Save ===== */
  const savePrompt = useCallback(async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content,
        category: form.category,
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        variables: form.variables.split(',').map((s) => s.trim()).filter(Boolean),
      }
      if (editingPrompt) {
        await apiProxy('aihelper', `api/prompts/${editingPrompt.id}`, {
          method: 'PUT', body: JSON.stringify(payload),
        })
      } else {
        await apiProxy('aihelper', 'api/prompts', {
          method: 'POST', body: JSON.stringify(payload),
        })
      }
      setEditorOpen(false)
      loadPrompts(searchQuery, filterCategory, filterTag, filterFavorite)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }, [form, editingPrompt, searchQuery, filterCategory, filterTag, filterFavorite, loadPrompts])

  /* ===== AI Enhance ===== */
  const enhancePrompt = useCallback(async () => {
    if (!form.content.trim()) return
    setEnhancing(true)
    try {
      const data = await apiProxy('aihelper', 'api/enhance', {
        method: 'POST', body: JSON.stringify({ content: form.content }),
      })
      if (data?.enhanced || data?.content) {
        setForm((f) => ({ ...f, content: data.enhanced || data.content }))
      }
    } catch (err) { setError(err.message) }
    finally { setEnhancing(false) }
  }, [form.content])

  /* ===== Templates ===== */
  const loadTemplates = useCallback(async (cat) => {
    setTemplatesLoading(true)
    try {
      const qs = cat && cat !== '全部' ? `?category=${encodeURIComponent(cat)}` : ''
      const data = await apiProxy('aihelper', `api/templates${qs}`)
      setTemplates(Array.isArray(data) ? data : (data?.templates || []))
    } catch (err) { setError(err.message) }
    finally { setTemplatesLoading(false) }
  }, [])

  const applyTemplate = useCallback((tpl) => {
    setEditingPrompt(null)
    setForm({
      title: tpl.title || '',
      content: tpl.content || '',
      category: tpl.category || '通用',
      tags: Array.isArray(tpl.tags) ? tpl.tags.join(', ') : (tpl.tags || ''),
      variables: Array.isArray(tpl.variables) ? tpl.variables.join(', ') : (tpl.variables || ''),
    })
    setEditorOpen(true)
    setViewMode('list')
  }, [])

  /* ===== Settings ===== */
  const loadSettings = useCallback(async () => {
    setSettingsLoading(true)
    try {
      const data = await apiProxy('aihelper', 'api/settings')
      if (data) {
        setSettings({
          api_key: data.api_key || '',
          api_base: data.api_base || '',
          model: data.model || '',
        })
      }
    } catch { /* ignore */ }
    finally { setSettingsLoading(false) }
  }, [])

  const saveSettings = useCallback(async (e) => {
    e.preventDefault()
    setSettingsSaving(true)
    try {
      await apiProxy('aihelper', 'api/settings', {
        method: 'PUT', body: JSON.stringify(settings),
      })
    } catch (err) { setError(err.message) }
    finally { setSettingsSaving(false) }
  }, [settings])

  /* ===== Init ===== */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadPrompts('', '', '', false) }, [loadPrompts])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (viewMode === 'templates') loadTemplates(templateCategory)
  }, [viewMode, templateCategory, loadTemplates])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (viewMode === 'settings') loadSettings()
  }, [viewMode, loadSettings])

  const handleSearch = useCallback((e) => {
    e.preventDefault()
    loadPrompts(searchQuery, filterCategory, filterTag, filterFavorite)
  }, [searchQuery, filterCategory, filterTag, filterFavorite, loadPrompts])

  /* ===== Render ===== */
  return (
    <div className="ah-shell">

      {/* ---- Error Banner ---- */}
      {error && (
        <div className="ah-error-banner">
          <p>{error}</p>
          <button className="ah-close-btn" onClick={() => setError('')}><XIcon /></button>
        </div>
      )}

      {/* ---- Tabs ---- */}
      {!editorOpen && (
        <div className="ah-tabs">
          <button className={`ah-tab ${viewMode === 'list' ? 'ah-tab--active' : ''}`} onClick={() => setViewMode('list')}>
            <SparklesIcon /> 提示词
          </button>
          <button className={`ah-tab ${viewMode === 'templates' ? 'ah-tab--active' : ''}`} onClick={() => setViewMode('templates')}>
            <BookTemplateIcon /> 模板
          </button>
          <button className={`ah-tab ${viewMode === 'settings' ? 'ah-tab--active' : ''}`} onClick={() => setViewMode('settings')}>
            <SettingsIcon /> 设置
          </button>
        </div>
      )}

      {/* ===== Editor View ===== */}
      {editorOpen && (
        <div className="ah-editor">
          <div className="ah-editor-header">
            <button className="ah-back-btn" onClick={() => setEditorOpen(false)}>
              <ChevronLeftIcon /> 返回列表
            </button>
            <span className="ah-editor-mode">{editingPrompt ? '编辑提示词' : '新建提示词'}</span>
          </div>

          <form className="ah-editor-form" onSubmit={savePrompt}>
            <div className="ah-editor-fields">
              <input
                type="text"
                className="ah-input ah-input--lg"
                placeholder="提示词标题"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />

              <div className="ah-editor-row">
                <select
                  className="ah-select"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>

                <input
                  type="text"
                  className="ah-input"
                  placeholder="标签，逗号分隔"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                />
              </div>

              <input
                type="text"
                className="ah-input"
                placeholder="变量，逗号分隔（如：语言, 框架, 目标）"
                value={form.variables}
                onChange={(e) => setForm((f) => ({ ...f, variables: e.target.value }))}
              />

              <div className="ah-content-wrap">
                <div className="ah-content-toolbar">
                  <span className="ah-content-label">提示词内容</span>
                  <button
                    type="button"
                    className="ah-enhance-btn"
                    onClick={enhancePrompt}
                    disabled={enhancing || !form.content.trim()}
                  >
                    <SparklesIcon /> {enhancing ? '增强中…' : '一键增强'}
                  </button>
                </div>
                <textarea
                  className="ah-content-textarea"
                  placeholder="输入提示词内容…&#10;&#10;使用 {{变量名}} 标记可替换部分"
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={16}
                />
              </div>
            </div>

            <div className="ah-editor-actions">
              <button type="submit" className="ah-save-btn" disabled={saving || !form.title.trim() || !form.content.trim()}>
                {saving ? '保存中…' : '保存'}
              </button>
              <button type="button" className="ah-cancel-btn" onClick={() => setEditorOpen(false)}>
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== Prompt List ===== */}
      {!editorOpen && viewMode === 'list' && (
        <div className="ah-list">
          <div className="ah-list-toolbar">
            <form className="ah-search-form" onSubmit={handleSearch}>
              <div className="ah-search-wrap">
                <SearchIcon />
                <input
                  type="text"
                  className="ah-search-input"
                  placeholder="搜索提示词…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select className="ah-select ah-select--sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="text"
                className="ah-input ah-input--sm"
                placeholder="标签…"
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
              />
              <label className="ah-fav-toggle">
                <input type="checkbox" checked={filterFavorite} onChange={(e) => setFilterFavorite(e.target.checked)} />
                <StarIcon filled={filterFavorite} /> 收藏
              </label>
              <button type="submit" className="ah-search-btn">筛选</button>
            </form>
            <button className="ah-new-btn" onClick={() => openEditor(null)}>
              <PlusIcon /> 新建提示词
            </button>
          </div>

          {promptsLoading ? (
            <div className="ah-loading"><div className="ah-spinner" /><p>加载提示词…</p></div>
          ) : prompts.length === 0 ? (
            <p className="ah-empty-text">暂无提示词，点击「新建提示词」开始</p>
          ) : (
            <div className="ah-prompt-list">
              {prompts.map((p) => (
                <div key={p.id} className="ah-prompt-card">
                  <div className="ah-prompt-card-body">
                    <div className="ah-prompt-card-header">
                      <h3 className="ah-prompt-card-title">{p.title}</h3>
                      {p.category && <span className="ah-category-tag">{p.category}</span>}
                    </div>
                    <p className="ah-prompt-card-preview">
                      {p.content?.slice(0, 120)}{(p.content?.length > 120) ? '…' : ''}
                    </p>
                    <div className="ah-prompt-card-meta">
                      {p.variables && (Array.isArray(p.variables) ? p.variables : [p.variables]).filter(Boolean).length > 0 && (
                        <span className="ah-var-tag">
                          <TagIcon />
                          {(Array.isArray(p.variables) ? p.variables : String(p.variables).split(',').filter(Boolean).map(s => s.trim())).join(', ')}
                        </span>
                      )}
                      {p.tags && (Array.isArray(p.tags) ? p.tags : []).length > 0 && (
                        <span className="ah-tags">
                          {(Array.isArray(p.tags) ? p.tags : String(p.tags).split(',').filter(Boolean).map(s => s.trim())).map((t) => (
                            <span key={t} className="ah-tag">{t}</span>
                          ))}
                        </span>
                      )}
                      {p.updated_at && (
                        <span className="ah-time">{new Date(p.updated_at).toLocaleDateString('zh-CN')}</span>
                      )}
                    </div>
                  </div>
                  <div className="ah-prompt-card-actions">
                    <button className="ah-icon-btn" title={p.favorite ? '取消收藏' : '收藏'} onClick={() => toggleFavorite(p.id, p.favorite)}>
                      <StarIcon filled={!!p.favorite} />
                    </button>
                    <button className="ah-icon-btn" title="编辑" onClick={() => openEditor(p)}>
                      <Edit3Icon />
                    </button>
                    <button className="ah-icon-btn ah-icon-btn--danger" title="删除" onClick={() => deletePrompt(p.id)}>
                      <Trash2Icon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Templates View ===== */}
      {!editorOpen && viewMode === 'templates' && (
        <div className="ah-templates">
          <div className="ah-templates-filter">
            {CATEGORY_OPTIONS.map((c) => (
              <button
                key={c}
                className={`ah-cat-btn ${templateCategory === c ? 'ah-cat-btn--active' : ''}`}
                onClick={() => setTemplateCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {templatesLoading ? (
            <div className="ah-loading"><div className="ah-spinner" /><p>加载模板…</p></div>
          ) : templates.length === 0 ? (
            <p className="ah-empty-text">暂无模板</p>
          ) : (
            <div className="ah-template-list">
              {templates.map((tpl) => (
                <div key={tpl.id} className="ah-template-card" onClick={() => applyTemplate(tpl)}>
                  <div className="ah-template-card-header">
                    <h3 className="ah-template-card-title">{tpl.title}</h3>
                    {tpl.category && <span className="ah-category-tag">{tpl.category}</span>}
                  </div>
                  <p className="ah-template-card-preview">
                    {tpl.content?.slice(0, 100)}{(tpl.content?.length > 100) ? '…' : ''}
                  </p>
                  <span className="ah-template-hint">点击使用此模板</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Settings View ===== */}
      {!editorOpen && viewMode === 'settings' && (
        <div className="ah-settings">
          <h3 className="ah-section-title">增强设置</h3>

          {settingsLoading ? (
            <div className="ah-loading"><div className="ah-spinner" /></div>
          ) : (
            <form className="ah-settings-form" onSubmit={saveSettings}>
              <label className="ah-field">
                <span className="ah-field-label">API Key</span>
                <input
                  type="password"
                  className="ah-input"
                  placeholder="sk-…"
                  value={settings.api_key}
                  onChange={(e) => setSettings((s) => ({ ...s, api_key: e.target.value }))}
                />
              </label>

              <label className="ah-field">
                <span className="ah-field-label">API Base URL</span>
                <input
                  type="text"
                  className="ah-input"
                  placeholder="https://api.openai.com/v1"
                  value={settings.api_base}
                  onChange={(e) => setSettings((s) => ({ ...s, api_base: e.target.value }))}
                />
              </label>

              <label className="ah-field">
                <span className="ah-field-label">模型</span>
                <input
                  type="text"
                  className="ah-input"
                  placeholder="gpt-4o"
                  value={settings.model}
                  onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
                />
              </label>

              <button type="submit" className="ah-save-btn" disabled={settingsSaving}>
                {settingsSaving ? '保存中…' : '保存设置'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
