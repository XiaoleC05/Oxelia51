import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
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
  if (pathname === '/' || pathname === '/portfolio' || pathname === '/friends') return 'split'
  if (pathname.startsWith('/tools') || pathname.startsWith('/admin')) return 'diagonal'
  return 'expand'
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
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
  )
}

function LoaderGate() {
  const location = useLocation()
  const [visible, setVisible] = useState(true)
  const [variant, setVariant] = useState(variantFor(location.pathname))

  useEffect(() => {
    setVisible(true)
    setVariant(variantFor(location.pathname))
  }, [location.pathname])

  if (!visible) return null

  return (
    <PageLoader
      variant={variant}
      onDone={() => setVisible(false)}
    />
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
      <BackToTop />
    </BrowserRouter>
  )
}

export default App
