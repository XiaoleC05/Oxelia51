import { Link, useNavigate } from 'react-router-dom'
import { getToken, clearToken } from '../api'
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

  const handleLogout = () => {
    clearToken()
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">Oxelia51</Link>
      <div className="navbar-links">
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
