import { useEffect, useState, useCallback, useRef } from 'react'
import { apiProxy } from '../../api'
import './SuperReadTool.css'

// Icon components (Lucide-style inline SVGs)
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

// Utility functions
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

function extractAllTags(articles) {
  const tagSet = new Set()
  articles.forEach(a => {
    if (Array.isArray(a.tags)) a.tags.forEach(t => tagSet.add(t))
    else if (typeof a.tags === 'string' && a.tags) a.tags.split(',').forEach(t => tagSet.add(t.trim()))
  })
  return Array.from(tagSet).sort()
}

export default function SuperReadTool() {
  const [activeTab, setActiveTab] = useState('feeds')
  const [feeds, setFeeds] = useState([])
  const [articles, setArticles] = useState([])
  const [briefing, setBriefing] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Feed management state
  const [showAddFeed, setShowAddFeed] = useState(false)
  const [newFeedUrl, setNewFeedUrl] = useState('')
  const [feedActionBusy, setFeedActionBusy] = useState(null)

  // Article filters
  const [articleFilter, setArticleFilter] = useState('all')
  const [filterFeedId, setFilterFeedId] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [expandedArticles, setExpandedArticles] = useState(new Set())
  const [readArticles, setReadArticles] = useState(new Set())

  // Settings form
  const [settingsForm, setSettingsForm] = useState({})
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsResult, setSettingsResult] = useState(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyCopied, setApiKeyCopied] = useState(false)

  const fileInputRef = useRef(null)

  const loadFeeds = async () => {
    try {
      const data = await apiProxy('superread', 'api/feeds')
      setFeeds(Array.isArray(data) ? data : data?.feeds || [])
    } catch (err) {
      console.error('Failed to load feeds:', err)
    }
  }

  const loadArticles = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (articleFilter === 'starred') params.append('starred', 'true')
      if (articleFilter === 'feed' && filterFeedId) params.append('feed_id', filterFeedId)
      if (articleFilter === 'tag' && filterTag) params.append('tag', filterTag)
      const query = params.toString() ? `?${params.toString()}` : ''
      const data = await apiProxy('superread', `api/articles${query}`)
      setArticles(Array.isArray(data) ? data : data?.articles || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadSettings = async () => {
    try {
      const data = await apiProxy('superread', 'api/settings')
      setSettingsForm(data || {})
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    loadFeeds()
    loadArticles()
    loadSettings()
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */
  /* eslint-enable react-hooks/exhaustive-deps */

  const loadBriefing = useCallback(async () => {
    try {
      const data = await apiProxy('superread', 'api/daily-brief')
      setBriefing(Array.isArray(data) ? data : data?.articles || [])
    } catch (err) {
      console.error('Failed to load briefing:', err)
    }
  }, [])

  // Feed handlers
  const handleAddFeed = async () => {
    if (!newFeedUrl.trim()) return
    setFeedActionBusy('add')
    try {
      await apiProxy('superread', 'api/feeds', {
        method: 'POST',
        body: JSON.stringify({ feed_url: newFeedUrl.trim() })
      })
      setNewFeedUrl('')
      setShowAddFeed(false)
      await loadFeeds()
    } catch (err) {
      alert('添加失败: ' + err.message)
    } finally {
      setFeedActionBusy(null)
    }
  }

  const handleDeleteFeed = async (feedId) => {
    if (!confirm('确定删除此源？')) return
    setFeedActionBusy(feedId)
    try {
      await apiProxy('superread', `api/feeds/${feedId}`, { method: 'DELETE' })
      await loadFeeds()
    } catch (err) {
      alert('删除失败: ' + err.message)
    } finally {
      setFeedActionBusy(null)
    }
  }

  const handleFetchFeed = async (feedId) => {
    setFeedActionBusy(feedId)
    try {
      await apiProxy('superread', `api/feeds/${feedId}/fetch`, { method: 'POST' })
      alert('抓取成功')
      await loadFeeds()
      await loadArticles()
    } catch (err) {
      alert('抓取失败: ' + err.message)
    } finally {
      setFeedActionBusy(null)
    }
  }

  const handleImportOPML = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFeedActionBusy('import')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/tools/superread/proxy/api/feeds/import`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      })
      if (!res.ok) throw new Error('导入失败')
      alert('导入成功')
      await loadFeeds()
    } catch (err) {
      alert('导入失败: ' + err.message)
    } finally {
      setFeedActionBusy(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Article handlers
  const toggleArticleExpand = (articleId) => {
    setExpandedArticles(prev => {
      const next = new Set(prev)
      if (next.has(articleId)) next.delete(articleId)
      else next.add(articleId)
      return next
    })
  }

  const toggleArticleStar = async (article) => {
    try {
      await apiProxy('superread', `api/articles/${article.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_starred: !article.is_starred })
      })
      setArticles(prev => prev.map(a =>
        a.id === article.id ? { ...a, is_starred: !a.is_starred } : a
      ))
    } catch (err) {
      alert('操作失败: ' + err.message)
    }
  }

  const markArticleRead = async (article) => {
    try {
      await apiProxy('superread', `api/articles/${article.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_read: true })
      })
      setArticles(prev => prev.map(a =>
        a.id === article.id ? { ...a, is_read: true } : a
      ))
      setReadArticles(prev => new Set(prev).add(article.id))
    } catch (err) {
      alert('操作失败: ' + err.message)
    }
  }

  const updateArticleTags = async (article, newTags) => {
    try {
      await apiProxy('superread', `api/articles/${article.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ tags: newTags })
      })
      setArticles(prev => prev.map(a =>
        a.id === article.id ? { ...a, tags: newTags } : a
      ))
    } catch (err) {
      alert('更新标签失败: ' + err.message)
    }
  }

  // Settings handler
  const handleSaveSettings = async () => {
    setSettingsSaving(true)
    setSettingsResult(null)
    try {
      await apiProxy('superread', 'api/settings', {
        method: 'PUT',
        body: JSON.stringify(settingsForm)
      })
      setSettingsResult({ type: 'success', message: '设置已保存' })
      await loadSettings()
    } catch (err) {
      setSettingsResult({ type: 'error', message: err.message })
    } finally {
      setSettingsSaving(false)
    }
  }

  // Tab change handler
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    if (tab === 'articles') loadArticles()
    if (tab === 'briefing') loadBriefing()
    if (tab === 'settings') loadSettings()
  }

  const allTags = extractAllTags(articles)

  if (loading && activeTab === 'articles' && articles.length === 0) {
    return (
      <div className="sr-shell">
        <div className="sr-loading">
          <div className="sr-spinner" />
          <p>加载 SuperRead 数据…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="sr-shell">
      {/* Header */}
      <div className="sr-header">
        <div className="sr-title">
          <IconRss />
          <span>SuperRead</span>
        </div>
        <div className="sr-tabs">
          <button className={`sr-tab ${activeTab === 'feeds' ? 'sr-tab--active' : ''}`} onClick={() => handleTabChange('feeds')}>
            源管理
          </button>
          <button className={`sr-tab ${activeTab === 'articles' ? 'sr-tab--active' : ''}`} onClick={() => handleTabChange('articles')}>
            文章列表
          </button>
          <button className={`sr-tab ${activeTab === 'briefing' ? 'sr-tab--active' : ''}`} onClick={() => handleTabChange('briefing')}>
            每日简报
          </button>
          <button className={`sr-tab ${activeTab === 'settings' ? 'sr-tab--active' : ''}`} onClick={() => handleTabChange('settings')}>
            <IconSettings />
            设置
          </button>
        </div>
      </div>

      {/* Feeds Tab */}
      {activeTab === 'feeds' && (
        <div className="sr-feeds">
          <div className="sr-feeds-actions">
            <button className="sr-btn sr-btn--primary" onClick={() => setShowAddFeed(true)}>
              <IconPlus />
              添加源
            </button>
            <label className="sr-btn sr-btn--secondary">
              <IconUpload />
              导入 OPML
              <input ref={fileInputRef} type="file" accept=".opml,.xml" onChange={handleImportOPML} style={{ display: 'none' }} />
            </label>
          </div>

          {showAddFeed && (
            <div className="sr-modal-overlay" onClick={() => setShowAddFeed(false)}>
              <div className="sr-modal" onClick={e => e.stopPropagation()}>
                <h3>添加 RSS 源</h3>
                <input
                  type="url"
                  placeholder="https://example.com/feed.xml"
                  value={newFeedUrl}
                  onChange={e => setNewFeedUrl(e.target.value)}
                  className="sr-input"
                  autoFocus
                />
                <p className="sr-feed-hint">
                  示例：<code>https://feeds.feedburner.com/...</code> 或 <code>https://example.com/rss</code>
                </p>
                <div className="sr-modal-actions">
                  <button className="sr-btn sr-btn--secondary" onClick={() => setShowAddFeed(false)}>取消</button>
                  <button className="sr-btn sr-btn--primary" onClick={handleAddFeed} disabled={feedActionBusy === 'add'}>
                    {feedActionBusy === 'add' ? '添加中…' : '添加'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {feeds.length === 0 ? (
            <div className="sr-empty">
              <p>暂无订阅源</p>
              <p className="sr-hint">点击上方按钮添加 RSS 源或导入 OPML 文件</p>
            </div>
          ) : (
            <div className="sr-feed-list">
              {feeds.map(feed => (
                <div key={feed.id} className="sr-feed-card">
                  <div className="sr-feed-info">
                    <div className="sr-feed-title">{feed.title || feed.feed_url}</div>
                    <div className="sr-feed-url">{feed.feed_url}</div>
                    <div className="sr-feed-meta">
                      {feed.last_fetched_at && <span>上次抓取: {formatDate(feed.last_fetched_at)}</span>}
                      {feed.last_error && <span className="sr-feed-error">错误: {feed.last_error}</span>}
                    </div>
                  </div>
                  <div className="sr-feed-actions">
                    <button
                      className="sr-icon-btn"
                      onClick={() => handleFetchFeed(feed.id)}
                      disabled={feedActionBusy === feed.id}
                      title="手动抓取"
                    >
                      <IconRefresh />
                    </button>
                    <button
                      className="sr-icon-btn sr-icon-btn--danger"
                      onClick={() => handleDeleteFeed(feed.id)}
                      disabled={feedActionBusy === feed.id}
                      title="删除"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Articles Tab */}
      {activeTab === 'articles' && (
        <div className="sr-articles">
          <div className="sr-filters">
            <button className={`sr-filter-btn ${articleFilter === 'all' ? 'sr-filter-btn--active' : ''}`} onClick={() => { setArticleFilter('all'); setFilterFeedId(''); setFilterTag('') }}>
              全部
            </button>
            <button className={`sr-filter-btn ${articleFilter === 'starred' ? 'sr-filter-btn--active' : ''}`} onClick={() => { setArticleFilter('starred'); setFilterFeedId(''); setFilterTag('') }}>
              <IconStar filled={articleFilter === 'starred'} />
              星标
            </button>
            <select
              className={`sr-filter-select ${articleFilter === 'feed' ? 'sr-filter-select--active' : ''}`}
              value={filterFeedId}
              onChange={e => { setArticleFilter('feed'); setFilterFeedId(e.target.value); setFilterTag('') }}
            >
              <option value="">按源筛选</option>
              {feeds.map(f => <option key={f.id} value={f.id}>{f.title || f.feed_url}</option>)}
            </select>
            <select
              className={`sr-filter-select ${articleFilter === 'tag' ? 'sr-filter-select--active' : ''}`}
              value={filterTag}
              onChange={e => { setArticleFilter('tag'); setFilterTag(e.target.value); setFilterFeedId('') }}
            >
              <option value="">按标签筛选</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {error && <div className="sr-error-banner">{error}</div>}

          {articles.length === 0 ? (
            <div className="sr-empty">
              <p>暂无文章</p>
              <p className="sr-hint">在「源管理」中添加 RSS 源并抓取文章</p>
            </div>
          ) : (
            <div className="sr-article-list">
              {articles.map(article => {
                const isExpanded = expandedArticles.has(article.id)
                const isRead = article.is_read || readArticles.has(article.id)
                const tags = Array.isArray(article.tags) ? article.tags : (article.tags ? article.tags.split(',').map(t => t.trim()) : [])

                return (
                  <div key={article.id} className={`sr-article-card ${isRead ? 'sr-article-card--read' : ''}`}>
                    <div className="sr-article-header" onClick={() => toggleArticleExpand(article.id)}>
                      <div className="sr-article-title">{article.title}</div>
                      <div className="sr-article-meta">
                        <span className="sr-article-source">{article.feed_title || '未知源'}</span>
                        <span className="sr-article-time">{formatDate(article.published_at)}</span>
                      </div>
                      <IconChevronDown />
                    </div>

                    <div className="sr-article-summary">{article.ai_summary}</div>

                    {tags.length > 0 && (
                      <div className="sr-article-tags">
                        {tags.map((tag, i) => <span key={i} className="sr-tag">{tag}</span>)}
                      </div>
                    )}

                    {isExpanded && (
                      <div className="sr-article-expanded">
                        <div className="sr-article-content">{article.content}</div>
                        <div className="sr-article-actions">
                          <button className="sr-action-btn" onClick={() => markArticleRead(article)} disabled={isRead}>
                            <IconCheck />
                            {isRead ? '已读' : '标记已读'}
                          </button>
                          <button className="sr-action-btn" onClick={() => toggleArticleStar(article)}>
                            <IconStar filled={article.is_starred} />
                            {article.is_starred ? '取消星标' : '星标'}
                          </button>
                          <div className="sr-tag-input-group">
                            <input
                              type="text"
                              placeholder="添加标签后回车"
                              className="sr-tag-input"
                              onKeyDown={e => {
                                if (e.key === 'Enter' && e.target.value.trim()) {
                                  const newTags = [...tags, e.target.value.trim()]
                                  updateArticleTags(article, newTags)
                                  e.target.value = ''
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Briefing Tab */}
      {activeTab === 'briefing' && (
        <div className="sr-briefing">
          {briefing.length === 0 ? (
            <div className="sr-empty">
              <p>今日暂无新文章</p>
              <p className="sr-hint">抓取订阅源后，今日新文章将在此汇总</p>
            </div>
          ) : (
            <div className="sr-briefing-list">
              {briefing.map(article => (
                <div key={article.id} className="sr-briefing-card">
                  <div className="sr-briefing-title">{article.title}</div>
                  <div className="sr-briefing-meta">
                    <span>{article.feed_title}</span>
                    <span>{formatDate(article.published_at)}</span>
                  </div>
                  <div className="sr-briefing-summary">{article.ai_summary}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="sr-settings">
          <fieldset className="sr-fieldset">
            <legend className="sr-fieldset-legend">高级设置</legend>
            <label className="sr-field">
              <span className="sr-field-label">API Key</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  className="sr-input"
                  value={settingsForm.api_key || ''}
                  onChange={e => setSettingsForm({ ...settingsForm, api_key: e.target.value })}
                  placeholder="sk-..."
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="sr-icon-btn"
                  title={showApiKey ? '隐藏' : '显示'}
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
                <button
                  type="button"
                  className="sr-icon-btn"
                  title="复制"
                  onClick={() => {
                    navigator.clipboard.writeText(settingsForm.api_key || '')
                    setApiKeyCopied(true)
                    setTimeout(() => setApiKeyCopied(false), 2000)
                  }}
                >
                  {apiKeyCopied ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  )}
                </button>
              </div>
            </label>
            <label className="sr-field">
              <span className="sr-field-label">API Base URL</span>
              <input
                type="text"
                className="sr-input"
                value={settingsForm.api_base || ''}
                onChange={e => setSettingsForm({ ...settingsForm, api_base: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </label>
            <label className="sr-field">
              <span className="sr-field-label">模型</span>
              <input
                type="text"
                className="sr-input"
                value={settingsForm.model || ''}
                onChange={e => setSettingsForm({ ...settingsForm, model: e.target.value })}
                placeholder="gpt-4o-mini"
              />
            </label>
          </fieldset>

          <fieldset className="sr-fieldset">
            <legend className="sr-fieldset-legend">抓取配置</legend>
            <label className="sr-field">
              <span className="sr-field-label">抓取间隔（分钟）</span>
              <input
                type="number"
                className="sr-input"
                value={settingsForm.fetch_interval_minutes || ''}
                onChange={e => setSettingsForm({ ...settingsForm, fetch_interval_minutes: parseInt(e.target.value) || 0 })}
                placeholder="60"
              />
            </label>
          </fieldset>

          <div className="sr-settings-actions">
            <button className="sr-btn sr-btn--primary" onClick={handleSaveSettings} disabled={settingsSaving}>
              {settingsSaving ? '保存中…' : '保存设置'}
            </button>
          </div>

          {settingsResult && (
            <div className={`sr-feedback sr-feedback--${settingsResult.type}`}>
              {settingsResult.message}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
