import './Friends.css'

const FRIENDS = [
  { name: 'Example Site', url: 'https://example.com', desc: '一个示例站点' },
  { name: 'Placeholder', url: 'https://placeholder.com', desc: '友情链接占位' },
]

function Friends() {
  return (
    <div className="friends-page">
      <header className="friends-header">
        <h1>友情链接</h1>
        <p className="friends-subtitle">同行者，共远行。</p>
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
      <p className="friends-note">
        想交换友链？请通过关于页面联系站长。
      </p>
    </div>
  )
}

export default Friends
