import './Friends.css'

const friends = [
  {
    category: 'Powered by',
    links: [
      { name: 'Go', url: 'https://go.dev/', desc: 'Backend runtime & compiler' },
      { name: 'Gin', url: 'https://gin-gonic.com/', desc: 'HTTP web framework' },
      { name: 'PostgreSQL', url: 'https://www.postgresql.org/', desc: 'Relational database' },
      { name: 'Redis', url: 'https://redis.io/', desc: 'In-memory data store & cache' },
      { name: 'React', url: 'https://react.dev/', desc: 'Frontend UI library' },
      { name: 'Vite', url: 'https://vite.dev/', desc: 'Frontend build tool' },
      { name: 'Docker', url: 'https://www.docker.com/', desc: 'Container runtime' },
      { name: 'JWT', url: 'https://jwt.io/', desc: 'Authentication token standard' },
    ]
  },
  {
    category: 'GitHub Repositories',
    links: [
      { name: 'Oxelia51', url: 'https://github.com/XiaoleC05/Oxelia51', desc: 'Platform monorepo' },
      { name: 'DormGuard', url: 'https://github.com/XiaoleC05/DormGuard', desc: 'Dormitory management tool' },
    ]
  },
  {
    category: 'Friends & Inspiration',
    links: [
      { name: 'ChenXiaole Blog', url: 'https://xiaolec05.github.io/', desc: 'Author personal blog' },
      { name: 'GitHub @XiaoleC05', url: 'https://github.com/XiaoleC05', desc: 'Author GitHub profile' },
    ]
  },
]

function Friends() {
  return (
    <div className="friends-page">
      <header className="friends-header">
        <h1>友情链接</h1>
        <p>本站由以下技术与服务驱动，感谢每一位贡献者与开源社区。</p>
      </header>

      {friends.map((section) => (
        <section key={section.category} className="friends-section">
          <h2 className="friends-section-title">{section.category}</h2>
          <div className="friends-grid">
            {section.links.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="friends-card"
              >
                <span className="friends-card-name">{link.name}</span>
                <span className="friends-card-desc">{link.desc}</span>
                <svg className="friends-card-ext" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2h8v8M14 2L4 12M11 8v4a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1h4"/>
                </svg>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default Friends
