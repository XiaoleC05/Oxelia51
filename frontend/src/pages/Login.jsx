import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiPost, setToken } from '../api'

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      const data = await apiPost('/auth/login', { username, password })
      setToken(data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      navigate('/')  // 登录成功后跳转首页
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', textAlign: 'left' }}>
      <h1>登录</h1>
      <form onSubmit={handleSubmit}>
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}
        <div style={{ marginBottom: 16 }}>
          <label>用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
            style={{ display: 'block', width: '100%', padding: '8px', marginTop: 4 }}
          />
        </div>
        <button type="submit" style={{ padding: '10px 24px', cursor: 'pointer' }}>
          登录
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14 }}>
        没有账号？<Link to="/register">去注册</Link>
      </p>
    </div>
  )
}

export default Login