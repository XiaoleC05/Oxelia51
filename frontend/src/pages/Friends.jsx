import './Friends.css'

const FRIENDS = [
  { name: 'Go', url: 'https://go.dev', desc: 'Go 编程语言' },
  { name: 'React', url: 'https://react.dev', desc: '用于构建用户界面的 JavaScript 库' },
  { name: 'PostgreSQL', url: 'https://www.postgresql.org', desc: '先进的开源关系型数据库' },
  { name: 'Redis', url: 'https://redis.io', desc: '高性能内存数据结构存储' },
  { name: 'Docker', url: 'https://www.docker.com', desc: '容器化应用平台' },
  { name: 'Nginx', url: 'https://nginx.org', desc: '高性能 HTTP 和反向代理服务器' },
  { name: 'Ubuntu', url: 'https://ubuntu.com', desc: '流行的开源 Linux 发行版' },
  { name: 'GitHub', url: 'https://github.com', desc: '全球最大的代码托管平台' },
]

function Friends() {
  return (
    <div className="friends-page">
      <header className="friends-header">
        <h1>友情链接</h1>
        <p className="friends-subtitle">Oxelia51 用到的技术栈</p>
      </header>
      <ul className="friends-list">
        {FRIENDS.map((f) => (
          <li key={f.url} className="friend-card">
            <a href={f.url} target="_blank" rel="noopener noreferrer">
              <span className="friend-name">{f.name}</span>
              <span className="friend-desc">{f.desc}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Friends
