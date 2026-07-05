import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import './Auth.css'

function VerifyEmail() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState('loading')
  const token = params.get('token')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          setStatus('success')
        } else {
          setStatus('invalid')
        }
      })
      .catch(() => setStatus('network-error'))
  }, [token])

  return (
    <div className="auth-page">
      <h1>邮箱验证</h1>
      <div className="auth-status">
        {status === 'loading' && <p>验证中...</p>}
        {status === 'success' && (
          <>
            <p className="auth-success">邮箱验证成功，现在可以登录。</p>
            <p><Link to="/login">去登录</Link></p>
          </>
        )}
        {status === 'invalid' && (
          <>
            <p className="auth-error">验证链接无效或已过期。</p>
            <p><Link to="/login">返回登录</Link></p>
          </>
        )}
        {status === 'network-error' && (
          <>
            <p className="auth-error">网络连接失败，请检查网络后刷新重试。</p>
            <p><Link to="/login">返回登录</Link></p>
          </>
        )}
      </div>
    </div>
  )
}

export default VerifyEmail
