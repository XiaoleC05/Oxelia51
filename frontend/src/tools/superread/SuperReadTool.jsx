import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiProxy } from '../../api'
import './SuperReadTool.css'

const IconRss = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" />
  </svg>
)

const IconStar = ({ filled }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

const IconUpload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const IconSparkles = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" /><path d="M18 14l.6 2.4L21 17l-2.4.6L18 20l-.6-2.4L15 17l2.4-.6z" /><path d="M6 18l.4 1.6L8 20l-1.6.4L6 22l-.4-1.6L4 20l1.6-.4z" />
  </svg>
)

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  return d.toLocaleDateString('zh-CN')
}

const VALID_SIZES = [10, 20, 50]

function Pagination({ page, totalPages, pageSize, onPageChange, onSizeChange }) {
  return (
    <div className="sr-pagination">
      {totalPages > 1 && (
        <div className="sr-pagination-nav">
          <button className="sr-btn sr-btn--secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>上一页</button>
          <span className="sr-pagination-info">{page} / {totalPages}</span>
          <button className="sr-btn sr-btn--secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>下一页</button>
        </div>
      )}
      <div className="sr-pagination-size">
        <span>每页</span>
        <select className="sr-pagination-select" value={pageSize} onChange={e => onSizeChange(parseInt(e.target.value))}>
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
        </select>
        <span>条</span>
      </div>
    </div>
  )
}

export default function SuperReadTool() {
  const [searchParams, setSearchParams] = useSearchParams()
  const validTabs = ['feeds', 'articles', 'briefing', 'settings']
  const [activeTab, setActiveTabState] = useState(() => {
    const t = searchParams.get('tab')
    return t && validTabs.includes(t) ? t : 'feeds'
  })

  // Pagination state (URL-persisted: ?page=N&size=M)
  const [page, setPageState] = useState(() => {
    const p = parseInt(searchParams.get('page'))
    return p && p > 0 ? p : 1
  })
  const [pageSize, setPageSizeState] = useState(() => {
    const s = parseInt(searchParams.get('size'))
    return VALID_SIZES.includes(s) ? s : 20
  })

  // Helper: update URL params preserving siblings
  const updateUrlParams = (overrides) => {
    const next = new URLSearchParams(searchParams)
    if (overrides.tab != null) next.set('tab', overrides.tab)
    if (overrides.page != null) {
      if (overrides.page === 1) next.delete('page')
      else next.set('page', String(overrides.page))
    }
    if (overrides.size != null) {
      if (overrides.size === 20) next.delete('size')
      else next.set('size', String(overrides.size))
    }
    setSearchParams(next, { replace: true })
  }

  const setActiveTab = (next) => {
    setActiveTabState(next)
    setPageState(1) // reset page on tab switch
    updateUrlParams({ tab: next, page: 1 })
  }
  const setPage = (p) => { setPageState(p); updateUrlParams({ page: p }) }
  const setPageSize = (s) => { setPageSizeState(s); setPageState(1); updateUrlParams({ size: s, page: 1 }) }

  const [feeds, setFeeds] = useState([])
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showAddFeed, setShowAddFeed] = useState(false)
  const [newFeedUrl, setNewFeedUrl] = useState('')
  const [newFeedName, setNewFeedName] = useState('')
  const [feedActionBusy, setFeedActionBusy] = useState(null)
  const [fetchAllBusy, setFetchAllBusy] = useState(false)
  const [fetchAllResult, setFetchAllResult] = useState(null)
  const fetchAllResultTimerRef = useRef(null)

  const [articleFilter, setArticleFilter] = useState('all')
  const [filterFeedId, setFilterFeedId] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [expandedArticles, setExpandedArticles] = useState(new Set())
  const [readArticles] = useState(new Set())
  const [selectedArticles, setSelectedArticles] = useState(new Set())

  // Briefing list (per-day, accordion expand)
  const [briefList, setBriefList] = useState([])
  const [briefListLoading, setBriefListLoading] = useState(false)
  const [expandedDate, setExpandedDate] = useState(null)
  const [briefArticlesByDate, setBriefArticlesByDate] = useState({})
  const [briefArticlesLoading, setBriefArticlesLoading] = useState({})
  const [sendingEmailDate, setSendingEmailDate] = useState(null)
  const [emailResult, setEmailResult] = useState(null)
  const emailResultTimerRef = useRef(null)

  const [settingsForm, setSettingsForm] = useState({})
  const [showApiKey, setShowApiKey] = useState(false)
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false)
  const [apiKeyCopied, setApiKeyCopied] = useState(false)
  const copyTimeoutRef = useRef(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsResult, setSettingsResult] = useState(null)
  const [summarizing, setSummarizing] = useState(false)

  const fileInputRef = useRef(null)

  const loadFeeds = async () => {
    try { const data = await apiProxy('superread', 'api/feeds'); setFeeds(Array.isArray(data) ? data : data?.feeds || []) } catch (err) { console.error(err) }
  }

  const loadArticles = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (articleFilter === 'starred') params.append('starred', 'true')
      if (articleFilter === 'feed' && filterFeedId) params.append('feed_id', filterFeedId)
      if (articleFilter === 'tag' && filterTag) params.append('tag', filterTag)
      const query = params.toString() ? `?${params.toString()}` : ''
      const data = await apiProxy('superread', `api/articles${query}`)
      setArticles(Array.isArray(data) ? data : data?.articles || [])
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }, [articleFilter, filterFeedId, filterTag])

  const loadBriefList = useCallback(async () => {
    setBriefListLoading(true)
    try {
      const data = await apiProxy('superread', 'api/daily-brief/list?limit=30')
      setBriefList(Array.isArray(data) ? data : (data?.items || data?.list || []))
    } catch (err) { console.error(err) } finally { setBriefListLoading(false) }
  }, [])

  // Toggle brief expand: load related articles on first expand
  const toggleBriefExpand = useCallback(async (date) => {
    if (!date) return
    if (expandedDate === date) { setExpandedDate(null); return }
    setExpandedDate(date)
    if (briefArticlesByDate[date]) return
    setBriefArticlesLoading(prev => ({ ...prev, [date]: true }))
    try {
      const data = await apiProxy('superread', `api/daily-brief?date=${encodeURIComponent(date)}`)
      const arts = data?.articles || (Array.isArray(data) ? data : [])
      setBriefArticlesByDate(prev => ({ ...prev, [date]: arts }))
    } catch (err) {
      console.error(err)
      setBriefArticlesByDate(prev => ({ ...prev, [date]: [] }))
    } finally {
      setBriefArticlesLoading(prev => ({ ...prev, [date]: false }))
    }
  }, [expandedDate, briefArticlesByDate])

  const loadSettings = async () => {
    try {
      const data = await apiProxy('superread', 'api/settings')
      const s = data?.settings || data || {}
      // 反向转换：分钟 → 数值 + 单位
      const rawMin = s.fetch_interval_min || 30
      if (rawMin % 1440 === 0) {
        s.fetch_interval_min = rawMin / 1440
        s.fetch_interval_unit = 'days'
      } else if (rawMin % 60 === 0) {
        s.fetch_interval_min = rawMin / 60
        s.fetch_interval_unit = 'hours'
      } else {
        s.fetch_interval_unit = 'minutes'
      }
      setSettingsForm(s)
      setHasSavedApiKey(!!s.api_key && s.api_key.length > 0)
    } catch (err) { console.error(err) }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { loadFeeds(); loadArticles(); loadSettings(); loadBriefList() }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (activeTab !== 'articles') return; loadArticles() }, [articleFilter, filterFeedId, filterTag, activeTab, loadArticles])

  // Auto-dismiss settings feedback after 3 seconds
  useEffect(() => {
    if (!settingsResult) return
    const t = setTimeout(() => setSettingsResult(null), 3000)
    return () => clearTimeout(t)
  }, [settingsResult])

  const handleAddFeed = async () => {
    if (!newFeedUrl.trim()) return
    setFeedActionBusy('add')
    try {
      const body = { feed_url: newFeedUrl.trim() }
      if (newFeedName.trim()) body.title = newFeedName.trim()
      const result = await apiProxy('superread', 'api/feeds', { method: 'POST', body: JSON.stringify(body) })
      setNewFeedUrl(''); setNewFeedName(''); setShowAddFeed(false)
      await loadFeeds()
      // Auto-fetch the newly added source
      try {
        let feedId = result && result.id
        if (!feedId) {
          // Fallback: latest feed is the most recently added
          const fresh = await apiProxy('superread', 'api/feeds')
          const list = Array.isArray(fresh) ? fresh : fresh?.feeds || []
          if (list.length > 0) feedId = list[list.length - 1].id
        }
        if (feedId) await apiProxy('superread', `api/feeds/${feedId}/fetch`, { method: 'POST' })
      } catch { /* ignore auto-fetch failure */ }
      await loadFeeds()
      if (activeTab === 'articles') loadArticles()
    } catch (err) { alert('添加失败: ' + err.message) } finally { setFeedActionBusy(null) }
  }

  const handleFetchAll = async () => {
    if (feeds.length === 0) return
    setFetchAllBusy(true)
    setFetchAllResult(null)
    let totalAdded = 0, skipped = 0, failed = 0
    for (const feed of feeds) {
      // Per-feed status: mark as 'fetching' so UI can reflect in-progress state
      setFeeds(prev => prev.map(f => f.id === feed.id ? { ...f, _fetchStatus: 'fetching' } : f))
      try {
        const r = await apiProxy('superread', `api/feeds/${feed.id}/fetch`, { method: 'POST' })
        if (r?.skipped) { skipped++; setFeeds(prev => prev.map(f => f.id === feed.id ? { ...f, _fetchStatus: 'skipped' } : f)) }
        else { totalAdded += (r?.added || 0); setFeeds(prev => prev.map(f => f.id === feed.id ? { ...f, _fetchStatus: 'ok' } : f)) }
      } catch {
        failed++
        setFeeds(prev => prev.map(f => f.id === feed.id ? { ...f, _fetchStatus: 'failed' } : f))
      }
    }
    setFetchAllBusy(false)
    setFetchAllResult({ added: totalAdded, skipped, failed })
    if (fetchAllResultTimerRef.current) clearTimeout(fetchAllResultTimerRef.current)
    fetchAllResultTimerRef.current = setTimeout(() => setFetchAllResult(null), 5000)
    await loadFeeds()
    if (activeTab === 'articles') loadArticles()
  }

  const handleDeleteFeed = async (feedId) => {
    if (!confirm('确定删除此源？')) return
    setFeedActionBusy(feedId)
    try { await apiProxy('superread', `api/feeds/${feedId}`, { method: 'DELETE' }); await loadFeeds(); if (activeTab === 'articles') loadArticles() } catch (err) { alert('删除失败: ' + err.message) } finally { setFeedActionBusy(null) }
  }

  const handleFetchFeed = async (feedId) => {
    setFeedActionBusy(feedId)
    try { const r = await apiProxy('superread', `api/feeds/${feedId}/fetch`, { method: 'POST' }); alert(`抓取完成，新增 ${r?.added || 0} 篇文章`); await loadFeeds(); if (activeTab === 'articles') loadArticles() } catch (err) { alert('抓取失败: ' + err.message) } finally { setFeedActionBusy(null) }
  }

  const handleImportOPML = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setFeedActionBusy('import')
    try {
      const formData = new FormData(); formData.append('file', file)
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/tools/superread/proxy/api/feeds/import`, { method: 'POST', headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }, body: formData })
      if (!res.ok) throw new Error('导入失败')
      const data = await res.json(); alert(`导入成功，${data?.imported || 0} 个源`); await loadFeeds()
    } catch (err) { alert('导入失败: ' + err.message) } finally { setFeedActionBusy(null); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const toggleArticleExpand = (articleId) => { setExpandedArticles(prev => { const next = new Set(prev); if (next.has(articleId)) next.delete(articleId); else next.add(articleId); return next }) }

  const toggleArticleStar = async (article) => {
    try { await apiProxy('superread', `api/articles/${article.id}`, { method: 'PATCH', body: JSON.stringify({ is_starred: !article.is_starred }) }); setArticles(prev => prev.map(a => a.id === article.id ? { ...a, is_starred: !article.is_starred } : a)) } catch (err) { alert('操作失败: ' + err.message) }
  }

  const markArticleRead = async (article) => {
    try { await apiProxy('superread', `api/articles/${article.id}`, { method: 'PATCH', body: JSON.stringify({ is_read: true }) }); setArticles(prev => prev.map(a => a.id === article.id ? { ...a, is_read: true } : a)) } catch (err) { alert('操作失败: ' + err.message) }
  }

  const handleSaveSettings = async () => {
    setSettingsSaving(true); setSettingsResult(null)
    try {
      const body = { ...settingsForm }
      if (body.api_key && body.api_key.startsWith('sk-...') && body.api_key.length <= 12) delete body.api_key
      // Convert fetch_interval_min + fetch_interval_unit to minutes before sending to backend
      const unit = body.fetch_interval_unit || 'hours'
      const rawValue = parseInt(body.fetch_interval_min) || 6
      const factor = unit === 'minutes' ? 1 : unit === 'hours' ? 60 : 1440
      body.fetch_interval_min = rawValue * factor
      delete body.fetch_interval_unit
      await apiProxy('superread', 'api/settings', { method: 'PUT', body: JSON.stringify(body) })
      setSettingsResult({ type: 'success', message: '设置已保存' }); await loadSettings()
    } catch (err) { setSettingsResult({ type: 'error', message: err.message }) } finally { setSettingsSaving(false) }
  }

  const handleSummarize = async () => {
    setSummarizing(true)
    try {
      const range = settingsForm.briefing_range || '24h'
      const ids = [...selectedArticles].join(',')
      const idsParam = ids ? `&ids=${encodeURIComponent(ids)}` : ''
      const data = await apiProxy('superread', `api/daily-brief/generate?range=${encodeURIComponent(range)}&force=true${idsParam}`, { method: 'POST' })
      // 生成成功后清空选中并刷新简报列表
      setSelectedArticles(new Set())
      await loadBriefList()
      // 切换到简报 Tab
      setActiveTab('briefing')
    } catch (err) { alert('简报生成失败: ' + err.message) } finally { setSummarizing(false) }
  }

  const handleSendToEmail = async (date) => {
    if (!date) return
    setSendingEmailDate(date)
    try {
      const r = await apiProxy('superread', `api/daily-brief/send?date=${encodeURIComponent(date)}`, { method: 'POST' })
      setEmailResult(r?.sent ? { date, type: 'success', message: `已发送 ${r.count || 0} 篇文章到 ${r.to}` } : { date, type: 'error', message: r?.message || '发送失败' })
    } catch (err) {
      setEmailResult({ date, type: 'error', message: '发送失败: ' + err.message })
    } finally {
      setSendingEmailDate(null)
      if (emailResultTimerRef.current) clearTimeout(emailResultTimerRef.current)
      emailResultTimerRef.current = setTimeout(() => setEmailResult(null), 5000)
    }
  }

  const copyApiKey = async () => {
    try {
      const data = await apiProxy('superread', 'api/settings?full=true')
      const k = data?.settings?.api_key || data?.api_key || ''
      if (k && k.length > 4) {
        try { await navigator.clipboard.writeText(k) } catch {
          const ta = document.createElement('textarea')
          ta.value = k
          ta.style.cssText = 'position:fixed;left:-9999px'
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
        }
        setApiKeyCopied(true)
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
        copyTimeoutRef.current = setTimeout(() => setApiKeyCopied(false), 2000)
      }
    } catch { /* ignore */ }
  }

  const handleTabChange = (tab) => { setActiveTab(tab); if (tab === 'articles') loadArticles(); if (tab === 'briefing') loadBriefList(); if (tab === 'settings') loadSettings() }

  // Pagination derivation (per-tab, client-side)
  const articlesTotalPages = Math.ceil(articles.length / pageSize)
  const articlesSafePage = Math.min(page, Math.max(1, articlesTotalPages))
  const pagedArticles = articles.slice((articlesSafePage - 1) * pageSize, articlesSafePage * pageSize)

  const feedsTotalPages = Math.ceil(feeds.length / pageSize)
  const feedsSafePage = Math.min(page, Math.max(1, feedsTotalPages))
  const pagedFeeds = feeds.slice((feedsSafePage - 1) * pageSize, feedsSafePage * pageSize)

  if (loading && articles.length === 0) { return (<div className="sr-shell"><div className="sr-loading"><div className="sr-spinner" /><p>加载 SuperRead 数据…</p></div></div>) }

  return (
    <div className="sr-shell">
      <div className="sr-header"><div className="sr-title"><IconRss /><span>SuperRead</span></div>
        <div className="sr-tabs">
          <button className={`sr-tab ${activeTab === 'feeds' ? 'sr-tab--active' : ''}`} onClick={() => handleTabChange('feeds')}>源管理</button>
          <button className={`sr-tab ${activeTab === 'articles' ? 'sr-tab--active' : ''}`} onClick={() => handleTabChange('articles')}>文章列表</button>
          <button className={`sr-tab ${activeTab === 'briefing' ? 'sr-tab--active' : ''}`} onClick={() => handleTabChange('briefing')}>新闻简报</button>
          <button className={`sr-tab ${activeTab === 'settings' ? 'sr-tab--active' : ''}`} onClick={() => handleTabChange('settings')}><IconSettings /> 设置</button>
        </div>
      </div>

      {activeTab === 'feeds' && (
        <div className="sr-feeds">
          <div className="sr-feeds-actions"><button className="sr-btn sr-btn--primary" onClick={() => setShowAddFeed(true)}><IconPlus /> 添加源</button><label className="sr-btn sr-btn--secondary"><IconUpload /> 导入 OPML<input ref={fileInputRef} type="file" accept=".opml,.xml" onChange={handleImportOPML} style={{ display: 'none' }} /></label><button className="sr-btn sr-btn--secondary" onClick={handleFetchAll} disabled={fetchAllBusy || feeds.length === 0}><IconRefresh /> {fetchAllBusy ? '抓取中…' : '抓取全部'}</button>{fetchAllResult && (<span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>抓取完成：新增 {fetchAllResult.added} 篇，跳过 {fetchAllResult.skipped} 个，失败 {fetchAllResult.failed} 个</span>)}</div>
          {showAddFeed && (<div className="sr-modal-overlay" onClick={() => setShowAddFeed(false)}><div className="sr-modal" onClick={e => e.stopPropagation()}><h3>添加 RSS 源</h3><label className="sr-field-label">源名称（可选，留空则自动获取）</label><input type="text" placeholder="例如：阮一峰的网络日志" value={newFeedName} onChange={e => setNewFeedName(e.target.value)} className="sr-input" /><label className="sr-field-label" style={{ marginTop: 12 }}>RSS 地址</label><input type="url" placeholder="https://example.com/feed.xml" value={newFeedUrl} onChange={e => setNewFeedUrl(e.target.value)} className="sr-input" autoFocus /><p className="sr-feed-hint">示例：<code>https://feeds.feedburner.com/...</code></p><div className="sr-modal-actions"><button className="sr-btn sr-btn--secondary" onClick={() => setShowAddFeed(false)}>取消</button><button className="sr-btn sr-btn--primary" onClick={handleAddFeed} disabled={feedActionBusy === 'add'}>{feedActionBusy === 'add' ? '添加中…' : '添加'}</button></div></div></div>)}
          {feeds.length === 0 ? (<div className="sr-empty"><p>暂无订阅源</p><p className="sr-hint">添加 RSS 源或导入 OPML 文件开始使用</p><div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}><button className="sr-btn sr-btn--primary" onClick={() => setShowAddFeed(true)}><IconPlus /> 添加源</button><button className="sr-btn sr-btn--secondary" onClick={() => fileInputRef.current?.click()} disabled={feedActionBusy === 'import'}><IconUpload /> 导入 OPML</button></div></div>) : (<><div className="sr-feed-list">{pagedFeeds.map(feed => (<div key={feed.id} className="sr-feed-card"><div className="sr-feed-info"><div className="sr-feed-title">{feed.title || feed.feed_url}</div><div className="sr-feed-url">{feed.feed_url}</div><div className="sr-feed-meta">{feed.last_fetched_at && <span>上次抓取: {formatDate(feed.last_fetched_at)}</span>}{feed.last_error && <span className="sr-feed-error">错误: {feed.last_error}</span>}{feed._fetchStatus === 'fetching' && <span style={{ color: 'var(--text-muted)' }}>⏳ 抓取中…</span>}{feed._fetchStatus === 'ok' && <span style={{ color: 'var(--accent-2)' }}>✅ 成功</span>}{feed._fetchStatus === 'skipped' && <span style={{ color: 'var(--text-muted)' }}>⏭ 跳过</span>}{feed._fetchStatus === 'failed' && <span style={{ color: '#c44' }}>❌ 失败</span>}</div></div><div className="sr-feed-actions"><button className="sr-icon-btn" onClick={() => handleFetchFeed(feed.id)} disabled={feedActionBusy === feed.id} title="手动抓取"><IconRefresh /></button><button className="sr-icon-btn sr-icon-btn--danger" onClick={() => handleDeleteFeed(feed.id)} disabled={feedActionBusy === feed.id} title="删除"><IconTrash /></button></div></div>))}</div><Pagination page={feedsSafePage} totalPages={feedsTotalPages} pageSize={pageSize} onPageChange={setPage} onSizeChange={setPageSize} /></>)}
        </div>)}

      {activeTab === 'articles' && (
        <div className="sr-articles">
          <div className="sr-filters">
            <button className={`sr-filter-btn ${articleFilter === 'all' ? 'sr-filter-btn--active' : ''}`} onClick={() => { setArticleFilter('all'); setFilterFeedId(''); setFilterTag(''); setSelectedArticles(new Set()); setPage(1) }}>全部</button>
            <button className={`sr-filter-btn ${articleFilter === 'starred' ? 'sr-filter-btn--active' : ''}`} onClick={() => { setArticleFilter('starred'); setFilterFeedId(''); setFilterTag(''); setSelectedArticles(new Set()); setPage(1) }}><IconStar filled={articleFilter === 'starred'} /> 星标</button>
            <select className={`sr-filter-select ${articleFilter === 'feed' ? 'sr-filter-select--active' : ''}`} value={filterFeedId} onChange={e => { setArticleFilter('feed'); setFilterFeedId(e.target.value); setFilterTag(''); setSelectedArticles(new Set()); setPage(1) }}><option value="">按源筛选</option>{feeds.map(f => <option key={f.id} value={f.id}>{f.title || f.feed_url}</option>)}</select>
          </div>
          <div className="sr-feeds-actions" style={{ marginBottom: 12 }}>
            <label className="sr-select-all">
              <input type="checkbox" checked={pagedArticles.length > 0 && pagedArticles.every(a => selectedArticles.has(a.id))} onChange={e => {
                if (e.target.checked) setSelectedArticles(new Set([...selectedArticles, ...pagedArticles.map(a => a.id)]))
                else setSelectedArticles(new Set([...selectedArticles].filter(id => !pagedArticles.some(a => a.id === id))))
              }} />
              <span>全选当前页</span>
            </label>
            {selectedArticles.size > 0 && <span className="sr-select-count">已选 {selectedArticles.size} 篇</span>}
            <button className="sr-btn sr-btn--secondary" onClick={handleSummarize} disabled={summarizing}><IconSparkles /> {summarizing ? '生成中…' : '生成新闻简报'}</button>
          </div>
          {error && <div className="sr-error-banner">{error}</div>}
          {articles.length === 0 ? (<div className="sr-empty"><p>暂无文章</p><p className="sr-hint">在「源管理」中添加 RSS 源并抓取文章</p></div>) : (<><div className="sr-article-list">{pagedArticles.map(article => { const isExpanded = expandedArticles.has(article.id); const isRead = article.is_read || readArticles.has(article.id); const isSelected = selectedArticles.has(article.id); return (<div key={article.id} className={`sr-article-card ${isRead ? 'sr-article-card--read' : ''} ${isSelected ? 'sr-article-card--selected' : ''}`}><div className="sr-article-header" onClick={() => toggleArticleExpand(article.id)}><label className="sr-article-checkbox" onClick={e => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={e => { setSelectedArticles(prev => { const next = new Set(prev); if (e.target.checked) next.add(article.id); else next.delete(article.id); return next }) } } /></label><a href={article.url} target="_blank" rel="noopener noreferrer" className="sr-article-title" onClick={e => e.stopPropagation()}>{article.title}</a><div className="sr-article-meta"><span className="sr-article-source">{article.feed_title || '未知源'}</span><span className="sr-article-time">{formatDate(article.published_at)}</span><span className={`sr-summary-badge ${article.summary ? 'sr-summary-badge--done' : ''}`}>{article.summary ? '已摘要' : '未摘要'}</span></div><IconChevronDown /></div><div className="sr-article-summary">{article.summary}</div>{isExpanded && (<div className="sr-article-expanded"><div className="sr-article-content">{article.content_text}</div><div className="sr-article-actions"><button className="sr-action-btn" onClick={() => markArticleRead(article)} disabled={isRead}><IconCheck /> {isRead ? '已读' : '标记已读'}</button><button className="sr-action-btn" onClick={() => toggleArticleStar(article)}><IconStar filled={article.is_starred} /> {article.is_starred ? '取消星标' : '星标'}</button></div></div>)}</div>) })}</div><Pagination page={articlesSafePage} totalPages={articlesTotalPages} pageSize={pageSize} onPageChange={(p) => { setSelectedArticles(new Set()); setPage(p) }} onSizeChange={(s) => { setSelectedArticles(new Set()); setPageSize(s) }} /></>)}
        </div>)}

      {activeTab === 'briefing' && (
        <div className="sr-briefing">
          <div className="sr-briefing-header">
            <h3 className="sr-section-title">新闻简报</h3>
          </div>
          {briefListLoading ? (
            <div className="sr-loading"><div className="sr-spinner" /><p>加载简报列表…</p></div>
          ) : briefList.length === 0 ? (
            <div className="sr-empty"><p>暂无简报</p><p className="sr-hint">在「文章列表」中点击「生成新闻简报」创建第一份</p></div>
          ) : (
            <div className="sr-brief-list">
              {briefList.map(brief => {
                const date = brief.date || brief.brief_date
                const content = brief.content || brief.report || brief.briefing || brief.summary || ''
                const preview = content.replace(/\s+/g, ' ').trim().slice(0, 150)
                const articleCount = brief.article_count || brief.count || brief.articles_count || 0
                const isExpanded = expandedDate === date
                const articles = (date && briefArticlesByDate[date]) || []
                const articlesLoading = date && briefArticlesLoading[date]
                const isSending = sendingEmailDate === date
                const result = emailResult && emailResult.date === date ? emailResult : null
                return (
                  <div key={date} className={`sr-brief-item ${isExpanded ? 'sr-brief-item--expanded' : ''}`}>
                    <div className="sr-brief-item-header" onClick={() => toggleBriefExpand(date)}>
                      <span className="sr-brief-item-icon">📰</span>
                      <span className="sr-brief-item-date">{date}</span>
                      <span className="sr-brief-item-count">{articleCount} 篇文章</span>
                      {settingsForm.email && (
                        <button className="sr-icon-btn" onClick={e => { e.stopPropagation(); handleSendToEmail(date) }} disabled={isSending} title="发送到邮箱">{isSending ? '⏳' : '✉'}</button>
                      )}
                      {result && (<span className="sr-brief-item-result" style={{ color: result.type === 'success' ? 'var(--accent-2)' : '#c44' }}>{result.message}</span>)}
                      <span className="sr-brief-item-chevron"><IconChevronDown /></span>
                    </div>
                    {preview && <div className="sr-brief-item-preview">{preview}{preview.length >= 150 ? '…' : ''}</div>}
                    {isExpanded && (
                      <div className="sr-brief-item-detail">
                        <div className="sr-brief-item-content">{content}</div>
                        {articlesLoading ? (
                          <p className="sr-hint" style={{ marginTop: 12 }}>加载关联文章…</p>
                        ) : articles.length > 0 ? (
                          <details className="sr-brief-item-articles">
                            <summary>关联文章 ({articles.length})</summary>
                            <div className="sr-brief-item-articles-list">
                              {articles.map(a => (
                                <div key={a.id} className="sr-brief-item-article">
                                  <a href={a.url} target="_blank" rel="noopener noreferrer">{a.title}</a>
                                  {a.summary && <div className="sr-brief-item-article-summary">{a.summary}</div>}
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (<div className="sr-settings"><fieldset className="sr-fieldset"><legend className="sr-fieldset-legend">AI 配置</legend><label className="sr-field"><span className="sr-field-label">API Key</span><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type={showApiKey ? 'text' : 'password'} className="sr-input" style={{ flex: 1 }} value={settingsForm.api_key || ''} onChange={e => { setSettingsForm({ ...settingsForm, api_key: e.target.value }); setHasSavedApiKey(false) }} placeholder={hasSavedApiKey ? '已保存 (点击编辑)' : 'sk-...'} /><button className="sr-icon-btn" onClick={() => setShowApiKey(!showApiKey)} title={showApiKey ? '隐藏' : '显示'}>{showApiKey ? '🙈' : '👁️'}</button><button className={`sr-icon-btn ${apiKeyCopied ? 'sr-icon-btn--success' : ''}`} onClick={copyApiKey} title={apiKeyCopied ? '已复制' : '复制'}>{apiKeyCopied ? <IconCheck /> : <IconCopy />}</button></div></label><label className="sr-field"><span className="sr-field-label">API Base URL</span><input type="text" className="sr-input" value={settingsForm.api_base || ''} onChange={e => setSettingsForm({ ...settingsForm, api_base: e.target.value })} placeholder="https://api.openai.com/v1" /></label><label className="sr-field"><span className="sr-field-label">模型</span><input type="text" className="sr-input" value={settingsForm.model || ''} onChange={e => setSettingsForm({ ...settingsForm, model: e.target.value })} placeholder="gpt-4o-mini" /></label></fieldset><fieldset className="sr-fieldset"><legend className="sr-fieldset-legend">抓取配置</legend><div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}><label className="sr-field" style={{ flex: 1 }}><span className="sr-field-label">间隔数值</span><input type="number" className="sr-input" min="1" value={settingsForm.fetch_interval_min || 6} onChange={e => setSettingsForm({ ...settingsForm, fetch_interval_min: parseInt(e.target.value) || 6 })} /></label><label className="sr-field" style={{ flex: 1 }}><span className="sr-field-label">间隔单位</span><select className="sr-input" value={settingsForm.fetch_interval_unit || 'hours'} onChange={e => setSettingsForm({ ...settingsForm, fetch_interval_unit: e.target.value })}><option value="minutes">分钟</option><option value="hours">小时</option><option value="days">天</option></select></label></div></fieldset><fieldset className="sr-fieldset"><legend className="sr-fieldset-legend">通知</legend><label className="sr-field"><span className="sr-field-label">简报时间范围</span><select className="sr-input" value={settingsForm.briefing_range || '24h'} onChange={e => setSettingsForm({ ...settingsForm, briefing_range: e.target.value })}><option value="3h">最近 3 小时</option><option value="6h">最近 6 小时</option><option value="12h">最近 12 小时</option><option value="24h">最近 1 天</option><option value="48h">最近 2 天</option><option value="7d">最近 7 天</option></select></label><label className="sr-field"><span className="sr-field-label">接收简报邮箱</span><input type="email" className="sr-input" value={settingsForm.email || ''} onChange={e => setSettingsForm({ ...settingsForm, email: e.target.value })} placeholder="your@email.com" /></label></fieldset><div className="sr-settings-actions"><button className="sr-btn sr-btn--primary" onClick={handleSaveSettings} disabled={settingsSaving}>{settingsSaving ? '保存中…' : '保存设置'}</button></div>{settingsResult && (<div className={`sr-feedback sr-feedback--${settingsResult.type}`}>{settingsResult.message}</div>)}</div>)}
    </div>
  )
}
