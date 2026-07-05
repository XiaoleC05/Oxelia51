import './ToolPlaceholder.css'

function ToolPlaceholder({
  icon,
  title,
  summary,
  features = [],
  releaseUrl,
  repoUrl,
}) {
  return (
    <div className="tool-ph">
      <span className="tool-ph-badge">在线版开发中</span>

      <div className="tool-ph-head">
        {icon && <span className="tool-ph-icon" aria-hidden="true">{icon}</span>}
        <div>
          <h2 className="tool-ph-title">{title}</h2>
          {summary && <p className="tool-ph-summary">{summary}</p>}
        </div>
      </div>

      {features.length > 0 && (
        <div className="tool-ph-section">
          <h3>规划能力</h3>
          <ul className="tool-ph-features">
            {features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="tool-ph-note">
        工具后端尚未接入平台网关。管理者可先在此验证权限与路由；完整业务 UI 将随各工具仓库迭代上线。
      </p>

      {(releaseUrl || repoUrl) && (
        <div className="tool-ph-actions">
          {releaseUrl && (
            <a
              className="tool-ph-btn tool-ph-btn--primary"
              href={releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              下载桌面版
            </a>
          )}
          {repoUrl && (
            <a
              className="tool-ph-btn tool-ph-btn--ghost"
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              查看 GitHub
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default ToolPlaceholder
