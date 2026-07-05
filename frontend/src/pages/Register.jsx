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
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (password !== passwordConfirm) {
      setError('两次密码不一致')
      return
    }
    try {
      await apiPost('/auth/register', {
        username,
        password,
        password_confirm: passwordConfirm,
        email,
      })
      setMessage('注册成功，请查收验证邮件后再登录。')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.message)
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
          />
        </div>
        <div className="auth-field">
          <label>邮箱</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
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
          />
        </div>
        <button type="submit" className="auth-btn">注册</button>
      </form>
      <p className="auth-footer">
        已有账号？<Link to="/login">去登录</Link>
      </p>
    </div>
  )
}

export default Register
