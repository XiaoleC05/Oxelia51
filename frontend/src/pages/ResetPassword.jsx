import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiPost } from '../api'
import './Auth.css'

function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== passwordConfirm) {
      setError('两次密码不一致')
      return
    }
    try {
      await apiPost('/auth/reset-password', {
        token,
        password,
        password_confirm: passwordConfirm,
      })
      setDone(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.message)
    }
  }

  if (!token) {
    return (
      <div className="auth-page">
        <h1>重置密码</h1>
        <p className="auth-error">链接无效，缺少 token。</p>
        <p className="auth-footer">
          <Link to="/forgot-password">重新申请</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <h1>重置密码</h1>
      {done ? (
        <p className="auth-success">密码已更新，正在跳转登录…</p>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <p className="auth-error">{error}</p>}
          <div className="auth-field">
            <label>新密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label>确认密码</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="auth-btn">更新密码</button>
        </form>
      )}
    </div>
  )
}

export default ResetPassword
