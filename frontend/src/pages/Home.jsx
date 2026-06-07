import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiDelete, getToken } from '../api'

function Home() {
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const token = getToken()

  const fetchTools = async () => {
    try {
      const data = await apiGet('/tools')
      setTools(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTools()
  }, [])

  const handleDelete = async (id) => {
    if (!window.confirm('确认删除？')) return
    try {
      await apiDelete(`/tools/${id}`)
      setTools(tools.filter((t) => t.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 40 }}>加载中...</p>
  if (error) return <p style={{ textAlign: 'center', marginTop: 40, color: '#ef4444' }}>{error}</p>

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>工具列表</h1>
        {token && <Link to="/tools/create">+ 创建工具</Link>}
      </div>

      {tools.length === 0 ? (
        <p style={{ color: 'var(--text)', marginTop: 24 }}>暂无工具</p>
      ) : (
        <div style={{ marginTop: 24 }}>
          {tools.map((t) => (
            <div key={t.id} style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 16,
              marginBottom: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>{t.name}</h3>
                <span style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: t.status === 'enabled' ? 'var(--color-accent)' : 'var(--color-warning)',
                  color: '#fff',
                }}>
                  {t.status}
                </span>
              </div>
              {t.description && (
                <p style={{ color: 'var(--text)', marginTop: 8, lineHeight: 1.6 }}>{t.description}</p>
              )}
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 8 }}>
                创建于 {new Date(t.created_at).toLocaleString()}
              </p>
              {token && (
                <button
                  onClick={() => handleDelete(t.id)}
                  style={{ padding: '4px 12px', fontSize: 13, marginTop: 8 }}
                >
                  删除
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Home
