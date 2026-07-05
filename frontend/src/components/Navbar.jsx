import { Link, useNavigate } from 'react-router-dom'
import { getToken, logout } from '../api'
import './Navbar.css'

function Navbar() {
  const navigate = useNavigate()
  const token = getToken()

  const user = (() => {
    try {
      const raw = localStorage.getItem('user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        Oxelia<sup>51</sup>
      </Link>
      <div className="navbar-links">
        <Link to="/tools">工具</Link>
        <Link to="/portfolio">作品</Link>
        {token && user?.role === 'admin' && (
          <Link to="/admin">管理</Link>
        )}
        {token && user ? (
          <>
            <span className="navbar-user">{user.username}</span>
            <button onClick={handleLogout} className="navbar-btn">退出</button>
          </>
        ) : (
          <>
            <Link to="/login">登录</Link>
            <Link to="/register">注册</Link>
          </>
        )}
      </div>
    </nav>
  )
}

export default Navbar
