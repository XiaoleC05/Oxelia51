import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import ScrollProgress from './components/ScrollProgress'
import BackToTop from './components/BackToTop'
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
import './App.css'

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
      </Routes>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ScrollProgress />
      <Navbar />
      <AnimatedRoutes />
      <BackToTop />
    </BrowserRouter>
  )
}

export default App
