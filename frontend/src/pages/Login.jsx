import { useState } from 'react'
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom'
import { apiPost, setToken, setRefreshToken } from '../api'
import AuthBrandPanel from '../components/AuthBrandPanel'
import './Auth.css'

function Login() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const from = searchParams.get('redirect') || location.state?.from || '/'
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const data = await apiPost('/auth/login', { account, password })
      setToken(data.token)
      if (data.refresh_token) setRefreshToken(data.refresh_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      navigate(from)
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setError('邮箱未验证，请检查邮箱并完成验证。')
      } else {
        setError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <AuthBrandPanel />
      <div className="auth-page">
        <h1>登录</h1>
        <form onSubmit={handleSubmit}>
          {error && <p className="auth-error">{error}</p>}
          <div className="auth-field">
            <label htmlFor="login-account">账号</label>
            <input
              id="login-account"
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              required
              placeholder="输入账号 ID 或邮箱"
              autoComplete="username"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="login-password">密码</label>
            <input
              id="login-password"
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
          {' · '}
        </p>
      </div>
    </div>
  )
}

export default Login
