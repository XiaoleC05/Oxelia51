import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPatch, getStoredUser, getToken, adminFetchHeroImages, adminCreateHeroImage, adminUpdateHeroImage, adminDeleteHeroImage, adminUploadHeroImage, adminUpdateCarouselSettings, adminFetchArticles, adminCreateArticle, adminUpdateArticle, adminDeleteArticle, fetchDeveloperProfile, adminPatchDeveloperProfile, adminUploadAvatar } from '../api'
import './Admin.css'

function Admin() {
  const user = useMemo(() => getStoredUser(), [])
  const token = useMemo(() => getToken(), [])
  const navigate = useNavigate()
  const [tab, setTab] = useState('dashboard')
  const [tools, setTools] = useState([])
  const [users, setUsers] = useState([])
  const [heroImages, setHeroImages] = useState([])
  const [articles, setArticles] = useState([])
  const [devProfile, setDevProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const tabRef = useRef(tab)
  const fetchingRef = useRef(false)

  useEffect(() => {
    tabRef.current = tab
  }, [tab])

  useEffect(() => {
    if (!token) {
      navigate('/login', { state: { from: '/admin' } })
    }
  }, [token, navigate])

  const loadData = useCallback(async () => {
    const currentTab = tabRef.current
    if (currentTab === 'server' || currentTab === 'dashboard') return
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    setError('')
    try {
      if (currentTab === 'tools') {
        const data = await apiGet('/admin/tools', { auth: true })
        setTools(data)
      } else if (currentTab === 'users') {
        const data = await apiGet('/admin/users', { auth: true })
        setUsers(data)
      } else if (currentTab === 'heroes') {
        const data = await adminFetchHeroImages()
        setHeroImages(data)
      } else if (currentTab === 'articles') {
        const data = await adminFetchArticles()
        setArticles(data)
      } else if (currentTab === 'profile') {
        const data = await fetchDeveloperProfile()
        setDevProfile(data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      fetchingRef.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user?.role === 'admin') { loadData() }
  }, [tab, user, loadData])

  if (user?.role !== 'admin') {
    return (
      <div className="admin-page">
        <h1>管理后台</h1>
        <p className="admin-error">仅管理员可访问此页面。</p>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>管理后台</h1>
      </header>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'dashboard' ? 'admin-tab--active' : ''}`}
          onClick={() => setTab('dashboard')}
        >
          概览
        </button>
        <button
          className={`admin-tab ${tab === 'tools' ? 'admin-tab--active' : ''}`}
          onClick={() => setTab('tools')}
        >
          工具
        </button>
        <button
          className={`admin-tab ${tab === 'users' ? 'admin-tab--active' : ''}`}
          onClick={() => setTab('users')}
        >
          用户
        </button>
        <button
          className={`admin-tab ${tab === 'heroes' ? 'admin-tab--active' : ''}`}
          onClick={() => setTab('heroes')}
        >
          头图
        </button>
        <button
          className={`admin-tab ${tab === 'articles' ? 'admin-tab--active' : ''}`}
          onClick={() => setTab('articles')}
        >
          文章
        </button>
        <button
          className={`admin-tab ${tab === 'profile' ? 'admin-tab--active' : ''}`}
          onClick={() => setTab('profile')}
        >
          资料
        </button>
        <button
          className={`admin-tab ${tab === 'server' ? 'admin-tab--active' : ''}`}
          onClick={() => setTab('server')}
        >
          服务器
        </button>
      </div>

      {tab === 'server' ? (
        <ServerTab />
      ) : tab === 'dashboard' ? (
        <DashboardTab />
      ) : (
        <>
          {loading && <p className="admin-status">加载中…</p>}
          {error && <p className="admin-error">{error}</p>}

          {!loading && !error && tab === 'tools' && (
            <ToolsTab tools={tools} onUpdated={loadData} />
          )}
          {!loading && !error && tab === 'users' && (
            <UsersTab users={users} onUpdated={loadData} />
          )}
          {!loading && !error && tab === 'heroes' && (
            <HeroImagesTab heroImages={heroImages} onUpdated={loadData} />
          )}
          {!loading && !error && tab === 'articles' && (
            <ArticlesTab articles={articles} onUpdated={loadData} />
          )}
          {!loading && !error && tab === 'profile' && (
            <ProfileTab profile={devProfile} onUpdated={loadData} />
          )}
        </>
      )}
    </div>
  )
}

// ===== 数据概览 =====
function DashboardIconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
function DashboardIconTools() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}
function DashboardIconArticles() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}
function DashboardIconPortfolio() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  )
}

function DashboardTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const d = new Date(); d.setDate(d.getDate() - 30)
  const [since, setSince] = useState(d.toISOString().slice(0, 10))

  const loadStats = useCallback(async (sinceVal) => {
    setLoading(true)
    try {
      const qs = '?since=' + encodeURIComponent(sinceVal)
      const data = await apiGet('/admin/dashboard-stats' + qs, { auth: true })
      setStats(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadStats(since) }, [since, loadStats])

  const setPreset = (days) => {
    const d = new Date(); d.setDate(d.getDate() - days)
    setSince(d.toISOString().slice(0, 10))
  }

  if (loading && !stats) return <p className="admin-status">加载中…</p>
  if (error) return <p className="admin-error">{error}</p>
  if (!stats) return null

  const cards = [
    { icon: <DashboardIconUsers />, title: '用户总数', value: stats.total_users ?? 0 },
    { icon: <DashboardIconUsers />, title: '新增用户', value: stats.new_users_since ?? 0 },
    { icon: <DashboardIconTools />, title: '工具数量', value: stats.total_tools ?? 0 },
    { icon: <DashboardIconArticles />, title: '文章数量', value: stats.total_articles ?? 0 },
    { icon: <DashboardIconPortfolio />, title: '作品数量', value: stats.total_portfolio ?? 0 },
  ]

  return (
    <div className="admin-section">
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>新增用户统计：</span>
        {[7, 30, 90].map(d => (
          <button key={d} onClick={() => setPreset(d)}
            style={{ fontSize: 12, padding: '3px 10px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }}>
            {d} 天
          </button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>或</span>
        <input type="date" value={since} onChange={e => setSince(e.target.value)}
          style={{ fontSize: 12, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' }} />
      </div>
      <div className="dashboard-grid">
        {cards.map((c) => (
          <div key={c.title} className="server-card dashboard-card">
            <div className="dashboard-card-header">
              <span className="dashboard-card-icon">{c.icon}</span>
              <h4 className="server-card-title">{c.title}</h4>
            </div>
            <p className="server-card-value dashboard-card-value">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ===== 工具管理 =====
function ToolsTab({ tools, onUpdated }) {
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiPatch(`/admin/tools/${editing.slug}`, editing.patch)
      setEditing(null)
      onUpdated()
    } catch (err) {
      setEditing({ ...editing, error: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-section">

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>名称</th>
              <th>在线</th>
              <th>用户可访问</th>
              <th>状态</th>
              <th>内网地址</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((t) => (
              <tr key={t.slug}>
                <td className="admin-mono">{t.slug}</td>
                <td>{t.name}</td>
                <td>{t.online_capable ? '✓' : '—'}</td>
                <td>
                  <span className={`admin-badge ${t.user_accessible ? 'admin-badge--ok' : 'admin-badge--off'}`}>
                    {t.user_accessible ? '可访问' : '不可访问'}
                  </span>
                </td>
                <td>
                  <span className={`admin-badge ${t.status === 'enabled' ? 'admin-badge--ok' : 'admin-badge--off'}`}>
                    {t.status === 'enabled' ? '使用' : '禁用'}
                  </span>
                </td>
                <td className="admin-mono admin-muted">{t.internal_api_base || '—'}</td>
                <td>
                  <button
                    className="admin-btn admin-btn--sm"
                    onClick={() => setEditing({
                      slug: t.slug,
                      patch: {
                        user_accessible: t.user_accessible,
                        status: t.status,
                        description_override: t.description_override || '',
                        internal_api_base: t.internal_api_base || '',
                      },
                    })}
                  >
                    编辑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="admin-modal">
          <form className="admin-modal-form" onSubmit={handleSave}>
            <h3>编辑工具：{editing.slug}</h3>
            {editing.error && <p className="admin-error">{editing.error}</p>}
            <label className="admin-field">
              <span>用户可访问</span>
              <input
                type="checkbox"
                checked={editing.patch.user_accessible}
                onChange={(e) => setEditing({
                  ...editing,
                  patch: { ...editing.patch, user_accessible: e.target.checked },
                })}
              />
            </label>
            <label className="admin-field">
              <span>状态</span>
              <select
                value={editing.patch.status}
                onChange={(e) => setEditing({
                  ...editing,
                  patch: { ...editing.patch, status: e.target.value },
                })}
              >
                <option value="enabled">使用</option>
                <option value="disabled">禁用</option>
              </select>
            </label>
            <label className="admin-field">
              <span>描述覆盖</span>
              <input
                type="text"
                value={editing.patch.description_override}
                onChange={(e) => setEditing({
                  ...editing,
                  patch: { ...editing.patch, description_override: e.target.value },
                })}
                placeholder="留空使用 manifest 原文"
              />
            </label>
            <label className="admin-field">
              <span>内网 API 地址</span>
              <input
                type="text"
                value={editing.patch.internal_api_base}
                onChange={(e) => setEditing({
                  ...editing,
                  patch: { ...editing.patch, internal_api_base: e.target.value },
                })}
                placeholder="如 http://127.0.0.1:8000"
              />
            </label>
            <div className="admin-modal-actions">
              <button type="submit" className="admin-btn" disabled={saving}>
                {saving ? '保存中…' : '保存'}
              </button>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setEditing(null)}>
                取消
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// ===== 用户管理 =====
function UsersTab({ users, onUpdated }) {
  const [patching, setPatching] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredUsers, setFilteredUsers] = useState(null)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  async function patchUser(id, patch) {
    setPatching(id)
    try {
      await apiPatch(`/admin/users/${id}`, patch)
      onUpdated()
    } catch (err) {
      alert(err.message)
    } finally {
      setPatching(null)
    }
  }

  // 防抖搜索：300ms
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = searchQuery.trim()
    if (!q) {
      setFilteredUsers(null)
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiGet(`/admin/users?q=${encodeURIComponent(q)}`, { auth: true })
        setFilteredUsers(Array.isArray(data) ? data : [])
      } catch {
        setFilteredUsers([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery])
  /* eslint-enable react-hooks/set-state-in-effect */

  const displayUsers = filteredUsers ?? users

  return (
    <div className="admin-section">
      <div className="users-search-bar">
        <input
          type="text"
          className="users-search-input"
          placeholder="搜索用户（账号/邮箱）"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searching && <span className="users-search-status">搜索中…</span>}
        {searchQuery && !searching && (
          <button className="users-search-clear" onClick={() => setSearchQuery('')}>清除</button>
        )}
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>邮箱验证</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {displayUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-muted" style={{ textAlign: 'center', padding: 32 }}>
                  {searchQuery ? '未找到匹配的用户' : '暂无用户'}
                </td>
              </tr>
            ) : displayUsers.map((u) => (
              <tr key={u.id}>
                <td className="admin-mono">{u.id}</td>
                <td>{u.username}</td>
                <td className="admin-mono admin-muted">{u.email}</td>
                <td>
                  <span className={`admin-badge ${u.role === 'admin' ? 'admin-badge--admin' : ''}`}>
                    {u.role}
                  </span>
                </td>
                <td>
                  <span className={`admin-badge ${u.email_verified ? 'admin-badge--ok' : 'admin-badge--off'}`}>
                    {u.email_verified ? '已验证' : '未验证'}
                  </span>
                </td>
                <td className="admin-muted">{new Date(u.created_at).toLocaleDateString('zh-CN')}</td>
                <td>
                  {!u.email_verified && (
                    <button
                      className="admin-btn admin-btn--sm"
                      onClick={() => patchUser(u.id, { email_verified: true })}
                      disabled={patching === u.id}
                    >
                      {patching === u.id ? '…' : '验证'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== 头图管理 =====
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function HeroImagesTab({ heroImages, onUpdated }) {
  const [modal, setModal] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  // 轮播间隔设置
  const [intervalMs, setIntervalMs] = useState(5000)
  const [savingInterval, setSavingInterval] = useState(false)
  const [intervalMsg, setIntervalMsg] = useState('')

  useEffect(() => {
    apiGet('/hero-images').then((data) => {
      if (data.autoplay_interval_ms) setIntervalMs(data.autoplay_interval_ms)
    }).catch(() => {})
  }, [])

  async function handleSaveInterval() {
    setSavingInterval(true)
    setIntervalMsg('')
    try {
      await adminUpdateCarouselSettings(Number(intervalMs))
      setIntervalMsg('已保存')
    } catch (err) {
      setIntervalMsg(err.message)
    } finally {
      setSavingInterval(false)
    }
  }

  // Upload modal state
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadPreview, setUploadPreview] = useState('')
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadSubtitle, setUploadSubtitle] = useState('')
  const [uploadOrder, setUploadOrder] = useState('')

  // URL modal state
  const [urlValue, setUrlValue] = useState('')
  const [urlTitle, setUrlTitle] = useState('')
  const [urlSubtitle, setUrlSubtitle] = useState('')
  const [urlOrder, setUrlOrder] = useState('')

  // Edit modal state
  const [editUrl, setEditUrl] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editSubtitle, setEditSubtitle] = useState('')
  const [editOrder, setEditOrder] = useState('')
  const [editEnabled, setEditEnabled] = useState(true)

  function openUpload() {
    setUploadFile(null)
    setUploadPreview('')
    setUploadTitle('')
    setUploadSubtitle('')
    setUploadOrder('')
    setUploadError('')
    setModal('upload')
  }

  function openUrl() {
    setUrlValue('')
    setUrlTitle('')
    setUrlSubtitle('')
    setUrlOrder('')
    setModal('url')
  }

  function openEdit(img) {
    setEditing(img)
    setEditUrl(img.image_url)
    setEditTitle(img.title || '')
    setEditSubtitle(img.subtitle || '')
    setEditOrder(String(img.display_order))
    setEditEnabled(img.enabled)
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setEditing(null)
    setUploadError('')
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      setUploadError('文件不能超过 10MB')
      return
    }

    setUploadFile(file)
    setUploadError('')

    const reader = new FileReader()
    reader.onload = () => setUploadPreview(reader.result)
    reader.readAsDataURL(file)
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!uploadFile) {
      setUploadError('请选择文件')
      return
    }

    setSaving(true)
    setUploadError('')
    try {
      const { url } = await adminUploadHeroImage(uploadFile)
      await adminCreateHeroImage({
        image_url: url,
        title: uploadTitle || '',
        subtitle: uploadSubtitle || '',
        display_order: parseInt(uploadOrder, 10) || 0,
      })
      closeModal()
      onUpdated()
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleUrlSubmit(e) {
    e.preventDefault()
    if (!urlValue.trim()) return

    setSaving(true)
    try {
      await adminCreateHeroImage({
        image_url: urlValue.trim(),
        title: urlTitle || '',
        subtitle: urlSubtitle || '',
        display_order: parseInt(urlOrder, 10) || 0,
      })
      closeModal()
      onUpdated()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await adminUpdateHeroImage(editing.id, {
        image_url: editUrl || undefined,
        title: editTitle || undefined,
        subtitle: editSubtitle || undefined,
        display_order: parseInt(editOrder, 10) || undefined,
        enabled: editEnabled,
      })
      closeModal()
      onUpdated()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(img) {
    try {
      await adminUpdateHeroImage(img.id, { enabled: !img.enabled })
      onUpdated()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDelete(img) {
    if (!window.confirm(`确认删除头图「${img.title || img.image_url}」？`)) return
    try {
      await adminDeleteHeroImage(img.id)
      onUpdated()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="admin-section">
      {/* 轮播间隔设置 */}
      <div className="hero-settings-bar">
        <label className="hero-settings-label">
          轮播间隔
          <input
            type="number"
            min="1000"
            max="60000"
            step="500"
            value={intervalMs}
            onChange={(e) => setIntervalMs(e.target.value)}
            className="hero-settings-input"
          />
          毫秒（1000-60000）
        </label>
        <button className="admin-btn" onClick={handleSaveInterval} disabled={savingInterval}>
          {savingInterval ? '保存中…' : '保存间隔'}
        </button>
        {intervalMsg && <span className="hero-settings-msg">{intervalMsg}</span>}
      </div>

      {/* Top action bar */}
      <div className="admin-section-actions">
        <button className="admin-btn" onClick={openUpload}>上传图片</button>
        <button className="admin-btn" onClick={openUrl}>添加 URL</button>
      </div>

      {/* Card grid */}
      {heroImages.length === 0 ? (
        <p className="admin-muted" style={{ paddingTop: 16 }}>暂无头图，点击上方按钮添加。</p>
      ) : (
        <div className="hero-card-grid">
          {heroImages.map((img) => (
            <div key={img.id} className={`hero-card ${!img.enabled ? 'hero-card--disabled' : ''}`}>
              <div className="hero-card-thumb">
                <img src={img.image_url} alt={img.title || ''} loading="lazy" />
              </div>
              <div className="hero-card-body">
                <div className="hero-card-info">
                  <h4 className="hero-card-title">{img.title || '（无标题）'}</h4>
                  {img.subtitle && <p className="hero-card-subtitle">{img.subtitle}</p>}
                  <span className="hero-card-order">排序：{img.display_order}</span>
                </div>
                <div className="hero-card-actions">
                  <label className="hero-card-toggle" title={img.enabled ? '已启用' : '已禁用'}>
                    <input
                      type="checkbox"
                      checked={img.enabled}
                      onChange={() => handleToggle(img)}
                    />
                    <span className="hero-card-toggle-label">{img.enabled ? '启用' : '禁用'}</span>
                  </label>
                  <button className="admin-btn admin-btn--sm" onClick={() => openEdit(img)}>编辑</button>
                  <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => handleDelete(img)}>删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {modal === 'upload' && (
        <div className="admin-modal">
          <form className="admin-modal-form" onSubmit={handleUpload}>
            <h3>上传头图</h3>
            {uploadError && <p className="admin-error">{uploadError}</p>}

            <label className="admin-field">
              <span>选择图片（支持 GIF，最大 10MB）</span>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </label>

            {uploadPreview && (
              <div className="hero-preview">
                <img src={uploadPreview} alt="预览" />
              </div>
            )}

            <label className="admin-field">
              <span>标题</span>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="显示在图片上的大标题"
              />
            </label>

            <label className="admin-field">
              <span>副标题</span>
              <input
                type="text"
                value={uploadSubtitle}
                onChange={(e) => setUploadSubtitle(e.target.value)}
                placeholder="标题下方的描述文字"
              />
            </label>

            <label className="admin-field">
              <span>排序号</span>
              <input
                type="number"
                value={uploadOrder}
                onChange={(e) => setUploadOrder(e.target.value)}
                placeholder="数字越小越靠前"
              />
            </label>

            <div className="admin-modal-actions">
              <button type="submit" className="admin-btn" disabled={saving || !uploadFile}>
                {saving ? '上传中…' : '上传并创建'}
              </button>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={closeModal}>
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* URL Modal */}
      {modal === 'url' && (
        <div className="admin-modal">
          <form className="admin-modal-form" onSubmit={handleUrlSubmit}>
            <h3>添加图片 URL</h3>

            <label className="admin-field">
              <span>图片 URL</span>
              <input
                type="text"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://example.com/hero.jpg"
                required
              />
            </label>

            {urlValue && (
              <div className="hero-preview">
                <img src={urlValue} alt="预览" onError={(e) => { e.target.style.display = 'none' }} />
              </div>
            )}

            <label className="admin-field">
              <span>标题</span>
              <input
                type="text"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
                placeholder="显示在图片上的大标题"
              />
            </label>

            <label className="admin-field">
              <span>副标题</span>
              <input
                type="text"
                value={urlSubtitle}
                onChange={(e) => setUrlSubtitle(e.target.value)}
                placeholder="标题下方的描述文字"
              />
            </label>

            <label className="admin-field">
              <span>排序号</span>
              <input
                type="number"
                value={urlOrder}
                onChange={(e) => setUrlOrder(e.target.value)}
                placeholder="数字越小越靠前"
              />
            </label>

            <div className="admin-modal-actions">
              <button type="submit" className="admin-btn" disabled={saving || !urlValue.trim()}>
                {saving ? '创建中…' : '创建'}
              </button>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={closeModal}>
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {modal === 'edit' && editing && (
        <div className="admin-modal">
          <form className="admin-modal-form" onSubmit={handleEdit}>
            <h3>编辑头图 #{editing.id}</h3>

            <div className="hero-preview">
              <img src={editUrl} alt="预览" onError={(e) => { e.target.style.display = 'none' }} />
            </div>

            <label className="admin-field">
              <span>图片 URL</span>
              <input
                type="text"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
              />
            </label>

            <label className="admin-field">
              <span>标题</span>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="显示在图片上的大标题"
              />
            </label>

            <label className="admin-field">
              <span>副标题</span>
              <input
                type="text"
                value={editSubtitle}
                onChange={(e) => setEditSubtitle(e.target.value)}
                placeholder="标题下方的描述文字"
              />
            </label>

            <label className="admin-field">
              <span>排序号</span>
              <input
                type="number"
                value={editOrder}
                onChange={(e) => setEditOrder(e.target.value)}
                placeholder="数字越小越靠前"
              />
            </label>

            <label className="admin-field admin-field--row">
              <span>启用状态</span>
              <input
                type="checkbox"
                checked={editEnabled}
                onChange={(e) => setEditEnabled(e.target.checked)}
              />
            </label>

            <div className="admin-modal-actions">
              <button type="submit" className="admin-btn" disabled={saving}>
                {saving ? '保存中…' : '保存'}
              </button>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={closeModal}>
                取消
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// ===== 文章管理 =====
function ArticlesTab({ articles, onUpdated }) {
  const [modal, setModal] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const emptyForm = {
    title: '',
    url: '',
    summary: '',
    content: '',
    category: '',
    tags: '',
    published_at: '',
    display_order: '0',
    enabled: true,
    is_draft: false,
  }

  const [form, setForm] = useState(emptyForm)

  function openCreate() {
    setForm(emptyForm)
    setEditing(null)
    setModal('create')
  }

  function openEdit(article) {
    setEditing(article)
    setForm({
      title: article.title || '',
      url: article.url || '',
      summary: article.summary || '',
      content: article.content || '',
      category: article.category || '',
      tags: Array.isArray(article.tags) ? article.tags.join(', ') : '',
      published_at: article.published_at ? article.published_at.slice(0, 10) : '',
      display_order: String(article.display_order ?? 0),
      enabled: article.enabled !== false,
      is_draft: article.is_draft === true,
    })
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setEditing(null)
  }

  function buildArticleData() {
    const tags = form.tags
      ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : undefined
    return {
      title: form.title,
      url: form.url || undefined,
      summary: form.summary || undefined,
      content: form.content || undefined,
      category: form.category || undefined,
      tags,
      published_at: form.published_at || undefined,
      display_order: parseInt(form.display_order, 10) || 0,
      enabled: form.enabled,
      is_draft: form.is_draft,
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await adminCreateArticle(buildArticleData())
      closeModal()
      onUpdated()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(e) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      await adminUpdateArticle(editing.id, buildArticleData())
      closeModal()
      onUpdated()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(article) {
    if (!window.confirm(`确认删除文章「${article.title}」？`)) return
    try {
      await adminDeleteArticle(article.id)
      onUpdated()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="admin-section">
      <div className="admin-section-actions">
        <button className="admin-btn" onClick={openCreate}>添加文章</button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>分类</th>
              <th>状态</th>
              <th>发布日期</th>
              <th>启用</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {articles.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-muted">暂无文章。</td>
              </tr>
            ) : (
              articles.map((a) => (
                <tr key={a.id}>
                  <td className="admin-mono" style={{ whiteSpace: 'normal', maxWidth: 280 }}>{a.title}</td>
                  <td className="admin-muted">{a.category || '\u2014'}</td>
                  <td>
                    <span className={`admin-badge ${a.is_draft ? 'admin-badge--off' : 'admin-badge--ok'}`}>
                      {a.is_draft ? '草稿' : '已发布'}
                    </span>
                  </td>
                  <td className="admin-muted">
                    {a.published_at ? new Date(a.published_at).toLocaleDateString('zh-CN') : '\u2014'}
                  </td>
                  <td>
                    <span className={`admin-badge ${a.enabled !== false ? 'admin-badge--ok' : 'admin-badge--off'}`}>
                      {a.enabled !== false ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td>
                    <button className="admin-btn admin-btn--sm" onClick={() => openEdit(a)} style={{ marginRight: 8 }}>
                      编辑
                    </button>
                    <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => handleDelete(a)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="admin-modal">
          <form className="admin-modal-form admin-modal-form--wide" onSubmit={modal === 'create' ? handleCreate : handleUpdate}>
            <h3>{modal === 'create' ? '添加文章' : '编辑文章'}</h3>

            <label className="admin-field">
              <span>标题</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="文章标题"
                required
              />
            </label>

            <label className="admin-field">
              <span>URL（可选，有正文可不填）</span>
              <input
                type="text"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
              />
            </label>

            <label className="admin-field">
              <span>摘要</span>
              <input
                type="text"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="文章摘要"
              />
            </label>

            <label className="admin-field">
              <span>正文</span>
              <textarea
                className="admin-textarea"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="支持 HTML 内容"
                rows={10}
              />
            </label>

            <label className="admin-field">
              <span>分类</span>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="如：技术、随笔"
              />
            </label>

            <label className="admin-field">
              <span>标签（逗号分隔）</span>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="React, Go, 教程"
              />
            </label>

            <label className="admin-field">
              <span>发布日期</span>
              <input
                type="date"
                value={form.published_at}
                onChange={(e) => setForm({ ...form, published_at: e.target.value })}
              />
            </label>

            <label className="admin-field">
              <span>排序号</span>
              <input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                placeholder="数字越小越靠前"
              />
            </label>

            <label className="admin-field admin-field--row">
              <span>启用</span>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
            </label>

            <label className="admin-field admin-field--row">
              <span>保存为草稿（不公开显示）</span>
              <input
                type="checkbox"
                checked={form.is_draft}
                onChange={(e) => setForm({ ...form, is_draft: e.target.checked })}
              />
            </label>

            <div className="admin-modal-actions">
              <button type="submit" className="admin-btn" disabled={saving}>
                {saving ? '保存中…' : '保存'}
              </button>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={closeModal}>
                取消
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// ===== 开发者资料管理 =====
function ProfileTab({ profile, onUpdated }) {
  const [editingField, setEditingField] = useState(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [avatarMode, setAvatarMode] = useState('upload')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const avatarInputRef = useRef(null)

  if (!profile) return <p className="admin-status">加载中…</p>

  function startEdit(field) {
    setDraft(profile[field] || '')
    setEditingField(field)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await adminPatchDeveloperProfile({ [editingField]: draft })
      setEditingField(null)
      onUpdated()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleAvatarFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('文件不能超过 10MB')
      return
    }
    setAvatarFile(file)
    setAvatarError('')
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result)
    reader.readAsDataURL(file)
  }

  async function handleAvatarUpload() {
    if (!avatarFile) {
      setAvatarError('请先选择文件')
      return
    }
    setSaving(true)
    setAvatarError('')
    try {
      const { url } = await adminUploadAvatar(avatarFile)
      await adminPatchDeveloperProfile({ avatar_url: url })
      setAvatarFile(null)
      onUpdated()
    } catch (err) {
      setAvatarError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarUrl() {
    setSaving(true)
    try {
      await adminPatchDeveloperProfile({ avatar_url: draft })
      setEditingField(null)
      onUpdated()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-section">
      <div className="profile-card">
        <div className="profile-card-header">
          <h3>头像</h3>
        </div>
        <div className="profile-avatar-area">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="头像" className="profile-avatar-img" />
          ) : (
            <div className="profile-avatar-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.42 3.58-8 8-8s8 3.58 8 8" />
              </svg>
            </div>
          )}

          {editingField !== 'avatar_url' ? (
            <button className="admin-btn admin-btn--sm" onClick={() => { setDraft(profile.avatar_url || ''); setAvatarPreview(profile.avatar_url || ''); setAvatarFile(null); setAvatarError(''); setAvatarMode('upload'); setEditingField('avatar_url') }}>
              更换头像
            </button>
          ) : (
            <div className="profile-avatar-edit">
              <div className="about-avatar-edit-tabs">
                <button
                  className={`about-avatar-edit-tab ${avatarMode === 'upload' ? 'about-avatar-edit-tab--active' : ''}`}
                  onClick={() => setAvatarMode('upload')}
                >
                  上传文件
                </button>
                <button
                  className={`about-avatar-edit-tab ${avatarMode === 'url' ? 'about-avatar-edit-tab--active' : ''}`}
                  onClick={() => setAvatarMode('url')}
                >
                  图片 URL
                </button>
              </div>

              {avatarError && <p className="about-avatar-edit-error">{avatarError}</p>}

              {avatarPreview && (
                <div className="about-avatar-edit-preview about-avatar-edit-preview--sm">
                  <img src={avatarPreview} alt="预览" />
                </div>
              )}

              {avatarMode === 'upload' ? (
                <>
                  <label className="about-avatar-edit-file">
                    <input
                      type="file"
                      accept="image/*"
                      ref={avatarInputRef}
                      onChange={handleAvatarFileChange}
                    />
                    <span>{avatarFile ? avatarFile.name : '选择图片（最大 10MB）'}</span>
                  </label>
                  <div className="admin-modal-actions" style={{ marginTop: 8 }}>
                    <button className="admin-btn" onClick={handleAvatarUpload} disabled={saving || !avatarFile}>
                      {saving ? '上传中…' : '上传并保存'}
                    </button>
                    <button className="admin-btn admin-btn--ghost" onClick={() => setEditingField(null)}>
                      取消
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); setAvatarPreview(e.target.value) }}
                    placeholder="头像图片 URL"
                    style={{ marginTop: 4 }}
                  />
                  <div className="admin-modal-actions" style={{ marginTop: 8 }}>
                    <button className="admin-btn" onClick={handleAvatarUrl} disabled={saving}>
                      {saving ? '保存中…' : '保存'}
                    </button>
                    <button className="admin-btn admin-btn--ghost" onClick={() => setEditingField(null)}>
                      取消
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="profile-card">
        <div className="profile-card-header">
          <h3>简介</h3>
          {editingField !== 'bio' && (
            <button className="admin-btn admin-btn--sm" onClick={() => startEdit('bio')}>编辑</button>
          )}
        </div>
        {editingField === 'bio' ? (
          <div className="profile-edit-area">
            <textarea
              className="admin-textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              placeholder="开发者简介…"
            />
            <div className="admin-modal-actions">
              <button className="admin-btn" onClick={handleSave} disabled={saving}>
                {saving ? '保存中…' : '保存'}
              </button>
              <button className="admin-btn admin-btn--ghost" onClick={() => setEditingField(null)}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <p className="profile-text">{profile.bio || <span className="admin-muted">暂无简介。</span>}</p>
        )}
      </div>

      <div className="profile-card">
        <div className="profile-card-header">
          <h3>履历</h3>
          {editingField !== 'resume' && (
            <button className="admin-btn admin-btn--sm" onClick={() => startEdit('resume')}>编辑</button>
          )}
        </div>
        {editingField === 'resume' ? (
          <div className="profile-edit-area">
            <textarea
              className="admin-textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={12}
              placeholder="开发者履历…"
            />
            <div className="admin-modal-actions">
              <button className="admin-btn" onClick={handleSave} disabled={saving}>
                {saving ? '保存中…' : '保存'}
              </button>
              <button className="admin-btn admin-btn--ghost" onClick={() => setEditingField(null)}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <p className="profile-text">{profile.resume || <span className="admin-muted">暂无履历。</span>}</p>
        )}
      </div>
    </div>
  )
}

// ===== 服务器监控 =====
function ProgressBar({ percent }) {
  const clamped = Math.min(100, Math.max(0, percent))
  const color = clamped >= 80 ? '#c8553d' : clamped >= 50 ? '#d4a843' : '#2c6e49'

  return (
    <div className="progress-bar">
      <div
        className="progress-bar__fill"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  )
}

function ServerTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshFeedback, setRefreshFeedback] = useState('')

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiGet('/admin/server-stats', { auth: true })
      setStats(data)
      setLoading(false)
      setError('')
      return true
    } catch (err) {
      setError(err.message)
      setLoading(false)
      return false
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function initialFetch() {
      const result = await fetchStats()
      if (cancelled) return
      if (!result) return
    }

    initialFetch()
    const interval = setInterval(async () => {
      if (!cancelled) await fetchStats()
    }, 10000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [fetchStats])

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshFeedback('')
    const ok = await fetchStats()
    setRefreshing(false)
    setRefreshFeedback(ok ? '已刷新' : '刷新失败')
    setTimeout(() => setRefreshFeedback(''), 2000)
  }

  if (loading && !stats) {
    return <p className="admin-status">加载中…</p>
  }

  if (error && !stats) {
    return <p className="admin-error">{error}</p>
  }

  if (!stats) return null

  return (
    <div className="admin-section">
      <div className="server-stats-header">
        <h2>服务器资源监控</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {refreshFeedback && (
            <span className="server-refresh-feedback">{refreshFeedback}</span>
          )}
          <button
            className="server-refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {refreshing ? '刷新中…' : '刷新'}
          </button>
        </div>
      </div>
      {error && <p className="admin-error" style={{ marginBottom: 12 }}>{error}</p>}
      <ServerStatsGrid stats={stats} label="阿里云" />
      {stats.remote ? <ServerStatsGrid stats={stats.remote} label="腾讯云" topMargin /> : null}
    </div>
  )
}

function ServerStatsGrid({ stats: s, label, topMargin }) {
  const memPct = s.memory_total_mb > 0 ? (s.memory_used_mb / s.memory_total_mb) * 100 : 0
  const days = Math.floor(s.uptime_seconds / 86400)
  const hours = Math.floor((s.uptime_seconds % 86400) / 3600)
  return (
    <div>
      <div className="server-stats-header" style={{ marginTop: topMargin ? 40 : 0 }}>
        <h3 className="server-stats-label">{label}</h3>
      </div>
      <div className="server-stats-grid">
        <div className="server-card"><h4 className="server-card-title">CPU 使用率</h4><p className="server-card-value">{s.cpu_percent.toFixed(1)}%</p><ProgressBar percent={s.cpu_percent} /></div>
        <div className="server-card"><h4 className="server-card-title">内存使用</h4><p className="server-card-value">{s.memory_used_mb} / {s.memory_total_mb} MB</p><ProgressBar percent={memPct} /></div>
        <div className="server-card"><h4 className="server-card-title">磁盘使用</h4><p className="server-card-value">{s.disk_used_percent.toFixed(1)}%</p><ProgressBar percent={s.disk_used_percent} /></div>
        <div className="server-card"><h4 className="server-card-title">运行时间</h4><p className="server-card-value">{days} 天 {hours} 小时</p></div>
        <div className="server-card"><h4 className="server-card-title">Go 协程数</h4><p className="server-card-value">{s.go_goroutines}</p></div>
        <div className="server-card"><h4 className="server-card-title">Go 内存分配</h4><p className="server-card-value">{s.go_alloc_mb} MB</p></div>
      </div>
    </div>
  )
}

export default Admin
