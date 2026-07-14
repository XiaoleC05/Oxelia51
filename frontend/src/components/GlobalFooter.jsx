import { useLocation, Link } from 'react-router-dom'

/* ===== 全局页脚 =====
 * 首页（/）不显示页脚——首页有自己的 Landing 内置页脚
 * 其他页面显示统一的 GlobalFooter
 */
function GlobalFooter() {
  const location = useLocation()
  if (location.pathname === '/') return null
  return (
    <footer className="landing-footer">
      <div className="landing-footer-bottom">
        <span>&copy; {new Date().getFullYear()} Oxelia51</span>
        <span className="landing-footer-sep">·</span>
        <span>集成·简洁·高效</span>
        <span className="landing-footer-sep">·</span>
        <Link to="/friends" className="landing-footer-link">友情链接</Link>
      </div>
      <div className="landing-footer-filing">
        <a
          href="https://beian.miit.gov.cn/"
          rel="noreferrer"
          target="_blank"
          className="landing-footer-filing-link"
        >
          鲁ICP备2026038838号-1
        </a>
      </div>
    </footer>
  )
}

export default GlobalFooter
