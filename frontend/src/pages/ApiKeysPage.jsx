import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiProxy, getStoredUser, getToken } from '../api'
import './ApiKeysPage.css'

const TOOLS = [
  {
    key: 'aihelper',
    name: 'AIHelper',
    desc: '文本增强',
    icon: '📝',
    settingsPath: '/tools/aihelper',
  },
  {
    key: 'superread',
    name: 'SuperRead',
    desc: 'RSS 阅读器',
    icon: '📖',
    settingsPath: '/tools/superread',
  },
  {
    key: 'secretstore',
    name: 'SecretStore',
    desc: '密钥管理',
    icon: '🔐',
    settingsPath: '/tools/secretstore',
  },
]

function formatDate(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ApiKeysPage() {
  const user = getStoredUser()
  const token = getToken()
  const navigate = useNavigate()

  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      navigate('/login', { state: { from: '/settings/keys' } })
      return
    }
  }, [token, navigate])

  const fetchAll = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const results = {}
    await Promise.all(
      TOOLS.map(async (tool) => {
        try {
          const data = await apiProxy(tool.key, 'api/stats')
          results[tool.key] = data
        } catch {
          results[tool.key] = null
        }
      })
    )
    setStats(results)
    setLoading(false)
  }, [token])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll()
  }, [fetchAll])

  if (!user) return null

  return (
    <div className="apikeys-page">
      <div className="apikeys-header">
        <h1 className="apikeys-title">密钥管理</h1>
        <p className="apikeys-subtitle">查看和管理各工具的 API Key 配置</p>
      </div>

      {loading ? (
        <div className="apikeys-loading">
          <span className="apikeys-spinner" aria-hidden="true" />
          <span>加载中…</span>
        </div>
      ) : (
        <div className="apikeys-list">
          {TOOLS.map((tool) => {
            const s = stats[tool.key]
            const configured = s?.api_key_configured ?? false
            const masked = s?.api_key_masked || '--'
            const lastUpdated = s?.last_updated || null
            const requestCount = s?.request_count
            const tokenTotal = s?.token_total

            return (
              <div key={tool.key} className="apikeys-card">
                <div className="apikeys-card-main">
                  <div className="apikeys-card-icon" aria-hidden="true">{tool.icon}</div>
                  <div className="apikeys-card-info">
                    <div className="apikeys-card-name-row">
                      <span className="apikeys-card-name">{tool.name}</span>
                      <span className="apikeys-card-desc">{tool.desc}</span>
                    </div>
                    <div className="apikeys-card-status">
                      <span className={`apikeys-dot ${configured ? 'apikeys-dot--on' : 'apikeys-dot--off'}`} aria-hidden="true" />
                      <span className="apikeys-status-text">
                        {configured ? '已配置' : '未配置'}
                      </span>
                    </div>
                    {configured && (
                      <div className="apikeys-card-detail">
                        <code className="apikeys-masked-key">{masked}</code>
                        <span className="apikeys-updated">更新于 {formatDate(lastUpdated)}</span>
                      </div>
                    )}
                    <div className="apikeys-card-usage">
                      {requestCount != null || tokenTotal != null ? (
                        <>
                          <span className="apikeys-usage-item">请求 {requestCount ?? '--'}</span>
                          <span className="apikeys-usage-sep">·</span>
                          <span className="apikeys-usage-item">Token {tokenTotal?.toLocaleString() ?? '--'}</span>
                        </>
                      ) : (
                        <span className="apikeys-usage-empty">暂无统计</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="apikeys-card-action">
                  {configured ? (
                    <Link to={tool.settingsPath} className="apikeys-btn apikeys-btn--secondary">
                      查看设置
                    </Link>
                  ) : (
                    <Link to={tool.settingsPath} className="apikeys-btn apikeys-btn--primary">
                      前往配置
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ApiKeysPage
