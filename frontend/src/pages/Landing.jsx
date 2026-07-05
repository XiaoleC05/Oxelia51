import { Link } from 'react-router-dom'
import './Landing.css'

function Landing() {
  return (
    <main className="landing">
      {/* ---- Hero: full-width dark section ---- */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <p className="landing-hero-chapter">一</p>
          <h1 className="landing-hero-title">Oxelia<span className="landing-hero-sup">51</span></h1>
          <p className="landing-hero-sub">统一在线工具平台</p>
          <p className="landing-hero-desc">
            一个账号，探索全部在线工具。<br />
            不追逐潮流，只做好用的小工具。
          </p>
          <nav className="landing-hero-actions">
            <Link to="/tools" className="landing-hero-cta">浏览工具</Link>
            <Link to="/portfolio" className="landing-hero-link">作品集</Link>
          </nav>
        </div>
      </section>

      {/* ---- Light content section ---- */}
      <section className="landing-body">
        <div className="landing-body-inner">
          <p className="landing-body-lead">
            作品集展示 <code>code</code> 目录下的全部项目，
            每个工具均为独立开源仓库，可独立部署与使用。
          </p>
          <div className="landing-body-links">
            <a href="https://github.com/XiaoleC05/Oxelia51" target="_blank" rel="noreferrer" className="landing-footnote-link">
              GitHub &rarr;
            </a>
            <a href="https://xiaolec05.github.io" target="_blank" rel="noreferrer" className="landing-footnote-link">
              Blog &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* ---- Dark footer ---- */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <p className="landing-footer-links">
            <a href="https://github.com/XiaoleC05/Oxelia51" target="_blank" rel="noreferrer">GitHub</a>
            <span className="landing-sep">/</span>
            <a href="https://xiaolec05.github.io" target="_blank" rel="noreferrer">Blog</a>
          </p>
          <p className="landing-signature"><em>by ChenXiaole</em></p>
        </div>
      </footer>
    </main>
  )
}

export default Landing
