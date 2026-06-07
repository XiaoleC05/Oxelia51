import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiPost } from '../api'

function Register() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      await apiPost('/auth/register', { username, password, email })
      navigate('/login')  // 注册成功跳登录页
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', textAlign: 'left' }}>
      <h1>注册</h1>
      <form onSubmit={handleSubmit}>
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}
        <div style={{ marginBottom: 16 }}>
          <label>用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={64}
            style={{ display: 'block', width: '100%', padding: '8px', marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>邮箱</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: '8px', marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            maxLength={128}
            style={{ display: 'block', width: '100%', padding: '8px', marginTop: 4 }}
          />
        </div>
        <button type="submit" style={{ padding: '10px 24px', cursor: 'pointer' }}>
          注册
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14 }}>
        已有账号？<Link to="/login">去登录</Link>
      </p>
    </div>
  )
}

export default Register
