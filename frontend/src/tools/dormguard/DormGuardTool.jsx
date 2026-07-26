import { useEffect, useState, useCallback } from 'react'
import { apiProxy } from '../../api'
import './DormGuardTool.css'

function balanceClass(value, threshold) {
  if (value == null) return ''
  if (value < threshold) return 'dg-balance--low'
  if (value < threshold * 1.5) return 'dg-balance--warning'
  return 'dg-balance--normal'
}

function DormGuardTool() {
  const [dormNumber, setDormNumber] = useState('')
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const threshold = 20

  const loadLatest = useCallback(async () => {
    let cancelled = false
    try {
      // Fetch latest record for dorm 320
      try {
        const latest = await apiProxy('dormguard', 'api/power/records/320/latest')
        if (!cancelled) {
          setRecord(latest)
          setDormNumber(latest?.dorm_number || '320')
        }
      } catch { /* no data yet */ }
    } catch (err) {
      if (!cancelled) setError(err.message)
    } finally {
      if (!cancelled) setLoading(false)
    }
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    loadLatest()
  }, [loadLatest])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const resp = await apiProxy('dormguard', 'api/system/crawl', { method: 'POST' })
      if (resp?.success) {
        await loadLatest()
      } else {
        setError(resp?.message || '刷新失败')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="dg-shell">
        <div className="dg-loading">
          <div className="dg-spinner" />
          <p>加载 DormGuard 数据…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dg-shell">
        <div className="dg-error-banner">
          <p className="dg-error-text">{error}</p>
          <button className="dg-action-btn" onClick={() => { setError(''); loadLatest(); }}>重试</button>
        </div>
      </div>
    )
  }

  const kClass = balanceClass(record?.kbalance, threshold)
  const zClass = balanceClass(record?.zbalance, threshold)

  return (
    <div className="dg-shell">
      {/* Header */}
      <div className="dg-header">
        <div className="dg-dorm-badge">
          <span className="dg-dorm-icon">&#9889;</span>
          <span>宿舍 {dormNumber || '—'}</span>
        </div>
        <button
          className="dg-action-btn"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? '刷新中…' : '刷新数据'}
        </button>
      </div>

      {/* Balance Cards */}
      <div className="dg-cards">
        <div className={`dg-card dg-card--aircon ${kClass}`}>
          <div className="dg-card-icon">&#10052;</div>
          <div className="dg-card-body">
            <span className="dg-card-label">空调余量</span>
            <span className={`dg-card-value ${kClass}`}>
              {record?.kbalance != null ? Number(record.kbalance).toFixed(2) : '—'}
            </span>
            <span className="dg-card-unit">度</span>
          </div>
        </div>

        <div className={`dg-card dg-card--lighting ${zClass}`}>
          <div className="dg-card-icon">&#9728;</div>
          <div className="dg-card-body">
            <span className="dg-card-label">照明余量</span>
            <span className={`dg-card-value ${zClass}`}>
              {record?.zbalance != null ? Number(record.zbalance).toFixed(2) : '—'}
            </span>
            <span className="dg-card-unit">度</span>
          </div>
        </div>

        {record?.record_time && (
          <div className="dg-update-time">
            更新于 {new Date(record.record_time).toLocaleString('zh-CN')}
          </div>
        )}

        {!record && (
          <div className="dg-card dg-card--empty">
            <p>暂无电费数据</p>
            <p className="dg-hint">请先确认服务器端已配置爬虫凭证，然后刷新数据</p>
          </div>
        )}

        <div className="dg-legend">
          <span className="dg-legend-item dg-legend--normal">充足</span>
          <span className="dg-legend-item dg-legend--warning">偏低</span>
          <span className="dg-legend-item dg-legend--low">告警</span>
        </div>
      </div>
    </div>
  )
}

export default DormGuardTool
