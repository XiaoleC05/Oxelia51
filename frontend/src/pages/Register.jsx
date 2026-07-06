import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiPost } from '../api'
import './Auth.css'

function Register() {
  const [accountId, setAccountId] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (password !== passwordConfirm) {
      setError('两次密码不一致')
      return
    }
    setSubmitting(true)
    try {
      const data = await apiPost('/auth/register', {
        account_id: accountId,
        username,
        password,
        password_confirm: passwordConfirm,
        email,
      })
      if (data.smtp_configured) {
        setMessage('注册成功，请查收验证邮件后再登录。')
      } else {
        setMessage('注册成功。请查收验证邮件完成验证后登录。若未收到邮件，请稍后重试或联系站长。')
      }
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <aside className="auth-brand">
        <div className="auth-brand-bg" />
        <div className="auth-brand-shape auth-brand-shape--1" />
        <div className="auth-brand-shape auth-brand-shape--2" />
        <div className="auth-brand-shape auth-brand-shape--3" />
        <div className="auth-brand-content">
          <span className="auth-brand-logo">Oxelia51</span>
          <p className="auth-brand-tagline">探索 · 创造 · 分享</p>
        </div>
      </aside>
      <div className="auth-page">
        <h1>注册</h1>
        <form onSubmit={handleSubmit}>
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-success">{message}</p>}
          <div className="auth-field">
            <label>账号 ID</label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              pattern="[a-zA-Z0-9_]+"
              minLength={4}
              maxLength={32}
              placeholder="字母、数字或下划线"
              autoComplete="off"
            />
            <span className="auth-hint">4-32位字母、数字或下划线，注册后不可修改</span>
          </div>
          <div className="auth-field">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={64}
              autoComplete="username"
            />
          </div>
          <div className="auth-field">
            <label>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </div>
          <div className="auth-field">
            <label>确认密码</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? '注册中…' : '注册'}
          </button>
        </form>
        <p className="auth-footer">
          已有账号？<Link to="/login">去登录</Link>
        </p>
      </div>
    </div>
  )
}

export default Register
