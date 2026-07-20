import { useState, useEffect } from 'react'
import { apiGet, apiPatch } from '../api'
import AuthBrandPanel from '../components/AuthBrandPanel'
import './Auth.css'

function Profile() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    apiGet('/users/me', { auth: true })
      .then((data) => {
        setUser(data)
        setUsername(data.username || '')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const updated = await apiPatch('/auth/profile', { username })
      const merged = { ...user, ...updated }
      setUser(merged)
      localStorage.setItem('user', JSON.stringify(merged))
      setMessage('用户名已更新')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="auth-wrapper">
        <AuthBrandPanel />
        <div className="auth-page">
          <p className="auth-status">加载中…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrapper">
      <AuthBrandPanel />
      <div className="auth-page">
        <h1>个人资料</h1>
        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}
        <div className="auth-field auth-field--readonly">
          <label htmlFor="profile-account-id">账号 ID</label>
          <input
            id="profile-account-id"
            type="text"
            value={user?.account_id || ''}
            readOnly
            tabIndex={-1}
            aria-describedby="profile-account-id-hint"
          />
          <span className="auth-hint" id="profile-account-id-hint">注册后不可修改</span>
        </div>
        <div className="auth-field auth-field--readonly">
          <label htmlFor="profile-email">邮箱</label>
          <input
            id="profile-email"
            type="text"
            value={user?.email || ''}
            readOnly
            tabIndex={-1}
          />
        </div>
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="profile-username">用户名</label>
            <input
              id="profile-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={64}
              autoComplete="username"
            />
          </div>
          <button type="submit" className="auth-btn" disabled={saving}>
            {saving ? '保存中…' : '保存修改'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Profile
