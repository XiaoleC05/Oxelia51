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
        <span className="landing-footer-sep">·</span>
        <a
          href="https://beian.mps.gov.cn/#/query/webSearch?code=37028202001309"
          rel="noreferrer"
          target="_blank"
          className="landing-footer-filing-link filing-gongan"
        >
          <img
            src="/gongan.png"
            alt="公安备案图标"
            className="filing-gongan-icon"
          />
          鲁公网安备37028202001309号
        </a>
      </div>
    </footer>
  )
}

export default GlobalFooter
