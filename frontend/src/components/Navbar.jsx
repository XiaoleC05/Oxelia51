import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { getToken, logout, searchAll } from '../api'
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

const IconProfile = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/>
    <circle cx="8" cy="6" r="2"/>
    <path d="M5 12c0-1.66 1.34-3 3-3s3 1.34 3 3"/>
  </svg>
)

const IconBook = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 2h5l2 2h5v10H2V2z"/>
    <path d="M2 14V4"/>
  </svg>
)

const IconPerson = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="5" r="3"/>
    <path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6"/>
    <path d="M8 8v3M6.5 10h3"/>
  </svg>
)

const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="3"/>
    <path d="M8 1.5v1.5M8 13v1.5M3.05 3.05l1.06 1.06M11.9 11.9l1.06 1.06M1.5 8H3M13 8h1.5M3.05 12.95l1.06-1.06M11.9 4.1l1.06-1.06"/>
  </svg>
)

const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.5 9.5A5.5 5.5 0 016.5 2.5 5.5 5.5 0 1013.5 9.5z"/>
  </svg>
)

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6.5" cy="6.5" r="4.5"/>
    <path d="M10 10l3.5 3.5"/>
  </svg>
)

const IconLink = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 10a3 3 0 010-4.24L8 3.76a3 3 0 014.24 4.24L10 10.24"/>
    <path d="M10 6a3 3 0 010 4.24L8 12.24a3 3 0 01-4.24-4.24L6 5.76"/>
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
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  /* ---- Theme ---- */
  const getInitialTheme = () => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  }
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  /* ---- Search ---- */
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState({ tools: [], articles: [] })
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef(null)
  const searchInputRef = useRef(null)

  const doSearch = useCallback(async (q) => {
    if (q.length < 2) { setSearchResults({ tools: [], articles: [] }); return }
    setSearchLoading(true)
    try {
      const res = await searchAll(q)
      setSearchResults({ tools: res.tools || [], articles: res.articles || [] })
    } catch {
      setSearchResults({ tools: [], articles: [] })
    } finally {
      setSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, doSearch])

  // Close search on outside click or ESC
  useEffect(() => {
    if (!searchOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') }
    }
    const clickHandler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false); setSearchQuery('')
      }
    }
    document.addEventListener('keydown', handler)
    document.addEventListener('mousedown', clickHandler)
    return () => {
      document.removeEventListener('keydown', handler)
      document.removeEventListener('mousedown', clickHandler)
    }
  }, [searchOpen])

  const openSearch = () => {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  /* ---- Scroll ---- */

  useEffect(() => {
    const handleScroll = () => {
      // hero 高度改为 50vh，导航栏在滚过 hero 后变色
      const heroH = window.innerHeight * 0.5
      setScrolled(window.scrollY > heroH - 64)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
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

      <button
        className={`navbar-hamburger${mobileOpen ? ' navbar-hamburger--open' : ''}`}
        onClick={() => setMobileOpen((o) => !o)}
        aria-label={mobileOpen ? '关闭菜单' : '打开菜单'}
      >
        <span /><span /><span />
      </button>

      <div className={`navbar-links${mobileOpen ? ' navbar-links--open' : ''}`}>
        <NavItem to="/" icon={IconHome} label="首页" />
        <NavItem to="/tools" icon={IconTools} label="工具" />
        <NavItem to="/portfolio" icon={IconImage} label="资料" />
        <NavItem to="/blog" icon={IconBook} label="博客" />
        <NavItem to="/about" icon={IconPerson} label="关于开发者" />
        <NavItem to="/friends" icon={IconLink} label="友情链接" />
        {token && user?.role === 'admin' && (
          <NavItem to="/admin" icon={IconGear} label="管理" />
        )}
        {token && user ? (
          <>
            <span className="navbar-user">{user.username}</span>
            <NavItem to="/profile" icon={IconProfile} label="资料" />
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
        <button className="navbar-icon-btn" onClick={openSearch} aria-label="搜索">
          <IconSearch />
        </button>
        <button className="navbar-icon-btn" onClick={toggleTheme} aria-label="切换主题">
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
      </div>

      {/* ---- Search panel ---- */}
      {searchOpen && (
        <div className="navbar-search" ref={searchRef}>
          <input
            ref={searchInputRef}
            className="navbar-search-input"
            type="text"
            placeholder="搜索工具或文章…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchLoading && <span className="navbar-search-status">搜索中…</span>}
          {(searchResults.tools.length > 0 || searchResults.articles.length > 0) && (
            <div className="navbar-search-results">
              {searchResults.tools.length > 0 && (
                <div className="navbar-search-group">
                  <span className="navbar-search-label">工具</span>
                  {searchResults.tools.map((t) => (
                    <Link
                      key={t.slug}
                      to={`/tools/${t.slug}`}
                      className="navbar-search-item"
                      onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                    >
                      <span className="navbar-search-name">{t.name}</span>
                      <span className="navbar-search-desc">{t.description}</span>
                    </Link>
                  ))}
                </div>
              )}
              {searchResults.articles.length > 0 && (
                <div className="navbar-search-group">
                  <span className="navbar-search-label">文章</span>
                  {searchResults.articles.map((a) => (
                    <Link
                      key={a.id}
                      to={`/blog/${a.id}`}
                      className="navbar-search-item"
                      onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                    >
                      <span className="navbar-search-name">{a.title}</span>
                      <span className="navbar-search-desc">{a.summary}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          {!searchLoading && searchQuery.length >= 2 && searchResults.tools.length === 0 && searchResults.articles.length === 0 && (
            <span className="navbar-search-status">无结果</span>
          )}
        </div>
      )}
    </nav>
  )
}

export default Navbar
