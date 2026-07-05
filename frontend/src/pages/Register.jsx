import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiPost } from '../api'
import './Auth.css'

function Register() {
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
        username,
        password,
        password_confirm: passwordConfirm,
        email,
      })
      if (data.smtp_configured) {
        setMessage('注册成功，请查收验证邮件后再登录。')
      } else {
        setMessage('注册成功。当前邮件服务未配置，请联系管理员在后台手动验证你的邮箱后登录。')
      }
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <h1>注册</h1>
      <form onSubmit={handleSubmit}>
        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}
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
  )
}

export default Register
