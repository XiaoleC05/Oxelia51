import { Link } from 'react-router-dom'
import './Landing.css'

function Landing() {
  return (
    <div className="landing">
      <section className="landing-hero">
        <p className="landing-tag">Oxelia51 · 奥泽莉亚51</p>
        <h1>统一在线工具平台</h1>
        <p className="landing-desc">
          一个账号，探索全部在线工具；作品集展示 <code>code</code> 目录下的全部项目。
        </p>
        <div className="landing-actions">
          <Link to="/tools" className="landing-btn landing-btn--primary">浏览工具</Link>
          <Link to="/portfolio" className="landing-btn">作品集</Link>
        </div>
      </section>
      <footer className="landing-footer">
        <a href="https://github.com/XiaoleC05/Oxelia51" target="_blank" rel="noreferrer">GitHub</a>
        <span> · </span>
        <a href="https://xiaolec05.github.io" target="_blank" rel="noreferrer">XiaoleC05.github.io</a>
      </footer>
    </div>
  )
}

export default Landing
