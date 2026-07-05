import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPatch, getStoredUser, getToken, adminFetchHeroImages, adminCreateHeroImage, adminUpdateHeroImage, adminDeleteHeroImage, adminUploadHeroImage, adminUpdateCarouselSettings } from '../api'
import './Admin.css'

function Admin() {
  const user = getStoredUser()
  const token = getToken()
  const navigate = useNavigate()
  const [tab, setTab] = useState('tools')
  const [tools, setTools] = useState([])
  const [users, setUsers] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [heroImages, setHeroImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 登录守卫：未登录跳转登录页
  useEffect(() => {
    if (!token) {
      navigate('/login', { state: { from: '/admin' } })
    }
  }, [token, navigate])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (tab === 'tools') {
        const data = await apiGet('/admin/tools', { auth: true })
        setTools(data)
      } else if (tab === 'users') {
        const data = await apiGet('/admin/users', { auth: true })
        setUsers(data)
      } else if (tab === 'portfolio') {
        const data = await apiGet('/admin/portfolio', { auth: true })
        setPortfolio(data)
      } else if (tab === 'heroes') {
        const data = await adminFetchHeroImages()
        setHeroImages(data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    loadData()
  }, [loadData])

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
        <p className="chapter-num">管</p>
        <h1>管理后台</h1>
      </header>

      <div className="admin-tabs">
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
          className={`admin-tab ${tab === 'portfolio' ? 'admin-tab--active' : ''}`}
          onClick={() => setTab('portfolio')}
        >
          作品集
        </button>
        <button
          className={`admin-tab ${tab === 'heroes' ? 'admin-tab--active' : ''}`}
          onClick={() => setTab('heroes')}
        >
          头图
        </button>
      </div>

      {loading && <p className="admin-status">加载中…</p>}
      {error && <p className="admin-error">{error}</p>}

      {!loading && !error && tab === 'tools' && (
        <ToolsTab tools={tools} onUpdated={loadData} />
      )}
      {!loading && !error && tab === 'users' && (
        <UsersTab users={users} onUpdated={loadData} />
      )}
      {!loading && !error && tab === 'portfolio' && (
        <PortfolioTab portfolio={portfolio} />
      )}
      {!loading && !error && tab === 'heroes' && (
        <HeroImagesTab heroImages={heroImages} onUpdated={loadData} />
      )}
    </div>
  )
}

// ===== 工具管理 =====
function ToolsTab({ tools, onUpdated }) {
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleScan() {
    setScanning(true)
    setScanResult(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 65000)
    try {
      const result = await apiPost('/admin/tools/scan-local', {}, { signal: controller.signal })
      setScanResult(result)
      onUpdated()
    } catch (err) {
      if (err.name === 'AbortError') {
        setScanResult({ error: '扫描超时（65秒），请检查本地 manifest 目录' })
      } else {
        setScanResult({ error: err.message })
      }
    } finally {
      clearTimeout(timeout)
      setScanning(false)
    }
  }

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
      <div className="admin-section-actions">
        <button className="admin-btn" onClick={handleScan} disabled={scanning}>
          {scanning ? '扫描中…' : '扫描本地 manifest'}
        </button>
        {scanResult && (
          <div className="admin-feedback">
            {scanResult.error ? (
              <p className="admin-feedback--error">{scanResult.error}</p>
            ) : (
              <p className="admin-feedback--ok">
                扫描完成：{scanResult.scanned || 0} 个工具，{scanResult.inserted || 0} 个新增，{scanResult.updated || 0} 个更新
              </p>
            )}
          </div>
        )}
      </div>

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
                    {t.user_accessible ? '开放' : '关闭'}
                  </span>
                </td>
                <td>
                  <span className={`admin-badge ${t.status === 'enabled' ? 'admin-badge--ok' : 'admin-badge--off'}`}>
                    {t.status}
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
                <option value="enabled">enabled</option>
                <option value="disabled">disabled</option>
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

  return (
    <div className="admin-section">
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
            {users.map((u) => (
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

// ===== 作品集管理 =====
function PortfolioTab({ portfolio }) {
  return (
    <div className="admin-section">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>名称</th>
              <th>描述</th>
              <th>GitHub</th>
              <th>关联工具</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.map((p) => (
              <tr key={p.slug}>
                <td className="admin-mono">{p.slug}</td>
                <td>{p.name}</td>
                <td className="admin-muted">{p.description || '—'}</td>
                <td className="admin-mono admin-muted">{p.github_repo || '—'}</td>
                <td className="admin-mono admin-muted">{p.linked_tool_slug || '—'}</td>
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

export default Admin
