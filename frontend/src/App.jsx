import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useMemo, Component, Suspense } from 'react'
import Navbar from './components/Navbar'
import ScrollProgress from './components/ScrollProgress'
import BackToTop from './components/BackToTop'
import PageLoader from './components/PageLoader'
import BackgroundWave from './components/BackgroundWave'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Tools from './pages/Tools'
import ToolShell from './pages/ToolShell'
import Portfolio from './pages/Portfolio'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ResendVerification from './pages/ResendVerification'
import Admin from './pages/Admin'
import Blog from './pages/Blog'
import ArticleDetail from './pages/ArticleDetail'
import About from './pages/About'
import Friends from './pages/Friends'
import Profile from './pages/Profile'
import './App.css'

function variantFor(pathname) {
  if (pathname === '/') return 'split'
  if (pathname === '/blog' || pathname.startsWith('/blog/')) return 'ink'
  if (pathname === '/tools' || pathname.startsWith('/tools/')) return 'mist'
  if (pathname === '/portfolio' || pathname === '/friends' || pathname === '/about') return 'light'
  return 'none'
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h2>页面出错了</h2>
            <p>{this.state.error?.message || '发生了未知错误'}</p>
            <button onClick={() => window.location.reload()}>刷新页面</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function RouteFallback() {
  return (
    <div className="route-fallback">
      <div className="route-fallback-spinner" />
    </div>
  )
}

function GlobalFooter() {
  const location = useLocation()
  if (location.pathname === '/') return null
  return (
    <footer className="landing-footer">
      <div className="landing-footer-bottom">
        <span>&copy; {new Date().getFullYear()} Oxelia51</span>
        <span className="landing-footer-sep">·</span>
        <span>集成 · 简洁 · 高效</span>
      </div>
      <div className="landing-footer-filing">
        <span>ICP备案号：蜀ICP备XXXXXXXX号-1</span>
        <span className="landing-footer-sep">|</span>
        <span>公安部备案号：川公网安备 XXXXXXXXXXXX号</span>
      </div>
    </footer>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <div key={location.pathname} className="route-fade">
          <Routes location={location}>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/resend-verification" element={<ResendVerification />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/tools/:slug" element={<ToolShell />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:id" element={<ArticleDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </div>
      </Suspense>
    </ErrorBoundary>
  )
}

function LoaderGate() {
  const location = useLocation()
  const variant = useMemo(() => variantFor(location.pathname), [location.pathname])

  if (variant === 'none') return null

  return (
    <PageLoader key={location.pathname} variant={variant} />
  )
}

function App() {
  return (
    <BrowserRouter>
      <BackgroundWave />
      <ScrollProgress />
      <Navbar />
      <LoaderGate />
      <AnimatedRoutes />
      <GlobalFooter />
      <BackToTop />
    </BrowserRouter>
  )
}

export default App
