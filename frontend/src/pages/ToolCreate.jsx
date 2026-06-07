import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost } from '../api'

function ToolCreate() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      await apiPost('/tools', { name, description })
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: '60px auto', padding: 24 }}>
      <h1>创建工具</h1>
      <form onSubmit={handleSubmit}>
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}
        <div style={{ marginBottom: 16 }}>
          <label>名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={128}
            autoFocus
            style={{ display: 'block', width: '100%', padding: '8px', marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1024}
            rows={4}
            style={{ display: 'block', width: '100%', padding: '8px', marginTop: 4 }}
          />
        </div>
        <button type="submit" style={{ padding: '10px 24px', cursor: 'pointer' }}>
          创建
        </button>
      </form>
    </div>
  )
}

export default ToolCreate
