import { Link } from 'react-router-dom'
import './Landing.css'

function Landing() {
  return (
    <main className="landing">
      <header className="landing-head">
        <p className="chapter-num landing-num">一</p>
        <h1>Oxelia51
          <span className="landing-subtitle">统一在线工具平台</span>
        </h1>
      </header>

      <section className="landing-body">
        <p>
          一个账号，探索全部在线工具；作品集展示 <code>code</code> 目录下的全部项目。
          不追逐潮流，只做好用的小工具。
        </p>
      </section>

      <nav className="landing-actions">
        <Link to="/tools" className="landing-link">浏览工具 &rarr;</Link>
        <Link to="/portfolio" className="landing-link">作品集 &rarr;</Link>
      </nav>

      <footer className="landing-footer">
        <p>
          <a href="https://github.com/XiaoleC05/Oxelia51" target="_blank" rel="noreferrer">GitHub</a>
          <span className="landing-sep">/</span>
          <a href="https://xiaolec05.github.io" target="_blank" rel="noreferrer">Blog</a>
        </p>
        <p className="landing-signature"><em>by ChenXiaole</em></p>
      </footer>
    </main>
  )
}

export default Landing
