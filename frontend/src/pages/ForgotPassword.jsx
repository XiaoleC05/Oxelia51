import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiPost } from '../api'
import './Auth.css'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await apiPost('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="auth-page">
      <h1>忘记密码</h1>
      {sent ? (
        <div className="auth-status">
          <p className="auth-success">若该邮箱已注册，重置链接已发送（开发模式请查看后端日志）。</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <p className="auth-error">{error}</p>}
          <div className="auth-field">
            <label>注册邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="auth-btn">发送重置邮件</button>
        </form>
      )}
      <p className="auth-footer">
        <Link to="/login">返回登录</Link>
      </p>
    </div>
  )
}

export default ForgotPassword
