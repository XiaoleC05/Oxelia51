import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { apiPost, setToken, setRefreshToken } from '../api'
import './Auth.css'

function Login() {
  const location = useLocation()
  const from = location.state?.from || '/'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const data = await apiPost('/auth/login', { username, password })
      setToken(data.token)
      if (data.refresh_token) setRefreshToken(data.refresh_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      navigate(from)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <h1>登录</h1>
      <form onSubmit={handleSubmit}>
        {error && <p className="auth-error">{error}</p>}
        <div className="auth-field">
          <label>用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div className="auth-field">
          <label>密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <button type="submit" className="auth-btn" disabled={submitting}>
          {submitting ? '登录中…' : '登录'}
        </button>
      </form>
      <p className="auth-footer">
        没有账号？<Link to="/register">去注册</Link>
        {' · '}
        <Link to="/forgot-password">忘记密码</Link>
      </p>
    </div>
  )
}

export default Login
