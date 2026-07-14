import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { Component, Suspense, useState } from 'react'
import Navbar from './components/Navbar'
import ScrollProgress from './components/ScrollProgress'
import BackToTop from './components/BackToTop'
import SmartKBFAB from './components/SmartKBFAB'
import SmartKBWidget from './components/SmartKBWidget'
import GlobalFooter from './components/GlobalFooter'
import PageSkeleton from './components/Skeleton'
import BackgroundWave from './components/BackgroundWave'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Tools from './pages/Tools'
import ToolShell from './pages/ToolShell'
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
import ApiKeysPage from './pages/ApiKeysPage'
import './App.css'

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

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
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
            <Route path="/portfolio" element={<Navigate to="/tools" replace />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:id" element={<ArticleDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings/keys" element={<ApiKeysPage />} />
          </Routes>
        </div>
      </Suspense>
    </ErrorBoundary>
  )
}

function App() {
  const [kbOpen, setKbOpen] = useState(false)
  return (
    <BrowserRouter>
      <BackgroundWave />
      <ScrollProgress />
      <Navbar />
      <AnimatedRoutes />
      <GlobalFooter />
      <BackToTop />
      <SmartKBFAB onToggle={() => setKbOpen((o) => !o)} />
      <SmartKBWidget open={kbOpen} onClose={() => setKbOpen(false)} />
    </BrowserRouter>
  )
}

export default App
