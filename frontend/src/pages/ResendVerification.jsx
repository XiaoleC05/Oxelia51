import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiPost } from '../api'
import './Auth.css'

function ResendVerification() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await apiPost('/auth/resend-verification', { email })
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <h1>重发验证邮件</h1>
      {sent ? (
        <div className="auth-status">
          <p className="auth-success">
            若该邮箱已注册且未验证，验证邮件已重新发送。请在 24 小时内完成验证。
          </p>
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
              autoComplete="email"
            />
          </div>
          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? '发送中…' : '发送验证邮件'}
          </button>
        </form>
      )}
      <p className="auth-footer">
        <Link to="/login">返回登录</Link>
      </p>
    </div>
  )
}

export default ResendVerification
