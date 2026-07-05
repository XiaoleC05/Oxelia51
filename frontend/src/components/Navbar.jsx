import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { getToken, logout } from '../api'
import './Navbar.css'

/* ===== Inline SVG icons (16x16, color inherits) ===== */

const IconHome = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 6l6-4.67L14 6v7.33a1 1 0 01-1 1H3a1 1 0 01-1-1V6z"/>
    <path d="M6 14.33V9.33h4v5"/>
  </svg>
)

const IconTools = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="6" height="6" rx="1"/>
    <rect x="9" y="1" width="6" height="6" rx="1"/>
    <rect x="1" y="9" width="6" height="6" rx="1"/>
    <rect x="9" y="9" width="6" height="6" rx="1"/>
  </svg>
)

const IconImage = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/>
    <circle cx="5" cy="6" r="1.5"/>
    <path d="M1.5 11.5l4-3 3 2.5 2.5-2 3.5 3"/>
  </svg>
)

const IconGear = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="2.5"/>
    <path d="M8 1.5v1.5M8 13v1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M1.5 8H3M13 8h1.5M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06"/>
  </svg>
)

const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="5" r="3"/>
    <path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6"/>
  </svg>
)

const IconUserPlus = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="5" r="3"/>
    <path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6M12 9v4M10 11h4"/>
  </svg>
)

const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6"/>
  </svg>
)

/* ===== Nav item with icon helper ===== */

function NavItem({ to, icon: Icon, label }) {
  return (
    <Link to={to} className="navbar-item">
      <span className="navbar-icon"><Icon /></span>
      <span>{label}</span>
    </Link>
  )
}

/* ===== Navbar ===== */

function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = getToken()
  const isHome = location.pathname === '/'

  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const heroH = window.innerHeight
      setScrolled(window.scrollY > heroH - 64)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    // init
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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

  // Class logic: home top → transparent hero; home scrolled → solid; other pages → solid
  let navClass = 'navbar'
  if (isHome && !scrolled) {
    navClass += ' navbar--hero'
  } else if (isHome && scrolled) {
    navClass += ' navbar--scrolled'
  }

  return (
    <nav className={navClass}>
      <Link to="/" className="navbar-brand">
        Oxelia51
      </Link>
      <div className="navbar-links">
        <NavItem to="/" icon={IconHome} label="首页" />
        <NavItem to="/tools" icon={IconTools} label="工具" />
        <NavItem to="/portfolio" icon={IconImage} label="作品" />
        {token && user?.role === 'admin' && (
          <NavItem to="/admin" icon={IconGear} label="管理" />
        )}
        {token && user ? (
          <>
            <span className="navbar-user">{user.username}</span>
            <button onClick={handleLogout} className="navbar-btn">
              <span className="navbar-icon"><IconLogout /></span>
              退出
            </button>
          </>
        ) : (
          <>
            <NavItem to="/login" icon={IconUser} label="登录" />
            <NavItem to="/register" icon={IconUserPlus} label="注册" />
          </>
        )}
      </div>
    </nav>
  )
}

export default Navbar
