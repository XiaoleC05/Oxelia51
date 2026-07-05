import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPatch, getStoredUser, getToken } from '../api'
import './Admin.css'

function Admin() {
  const user = getStoredUser()
  const token = getToken()
  const navigate = useNavigate()
  const [tab, setTab] = useState('tools')
  const [tools, setTools] = useState([])
  const [users, setUsers] = useState([])
  const [portfolio, setPortfolio] = useState([])
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

export default Admin
