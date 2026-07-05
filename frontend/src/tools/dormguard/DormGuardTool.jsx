import { useEffect, useState, useCallback } from 'react'
import { apiProxy } from '../../api'
import './DormGuardTool.css'

const DEFAULT_THRESHOLD = 20

function balanceClass(value, threshold) {
  if (value == null) return ''
  if (value < threshold) return 'dg-balance--low'
  if (value < threshold * 1.5) return 'dg-balance--warning'
  return 'dg-balance--normal'
}

function DormGuardTool() {
  const [dormNumber, setDormNumber] = useState('')
  const [record, setRecord] = useState(null)
  const [records, setRecords] = useState([])
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [viewMode, setViewMode] = useState('latest')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    let cancelled = false
    try {
      const settings = await apiProxy('dormguard', 'api/admin/settings')
      const dorm = settings?.settings?.CRAWLER_DORM_NUMBER || '101'
      const cfgThreshold = Number(settings?.settings?.CRAWLER_ALERT_THRESHOLD) || DEFAULT_THRESHOLD
      if (cancelled) return
      setDormNumber(dorm)
      setThreshold(cfgThreshold)

      try {
        const latest = await apiProxy('dormguard', `api/power/records/${dorm}/latest`)
        if (!cancelled) setRecord(latest)
      } catch { /* no data yet */ }

      try {
        const list = await apiProxy('dormguard', `api/power/records/${dorm}`)
        const rows = Array.isArray(list) ? list : (list?.items ?? [])
        if (!cancelled) setRecords(rows)
      } catch { /* no records */ }
    } catch (err) {
      if (!cancelled) setError(err.message)
    } finally {
      if (!cancelled) setLoading(false)
    }
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const cleanup = loadData()
    return () => { if (cleanup) cleanup() }
  }, [loadData])

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
        </div>
      </div>
    )
  }

  const kClass = balanceClass(record?.kbalance, threshold)
  const zClass = balanceClass(record?.zbalance, threshold)

  const latestRecords = [...records].reverse().slice(0, 12)

  return (
    <div className="dg-shell">
      {/* ---- Header ---- */}
      <div className="dg-header">
        <div className="dg-dorm-badge">
          <span className="dg-dorm-icon">&#9889;</span>
          <span>宿舍 {dormNumber || '—'}</span>
        </div>
        <div className="dg-tabs">
          <button
            className={`dg-tab ${viewMode === 'latest' ? 'dg-tab--active' : ''}`}
            onClick={() => setViewMode('latest')}
          >
            最新余额
          </button>
          <button
            className={`dg-tab ${viewMode === 'history' ? 'dg-tab--active' : ''}`}
            onClick={() => setViewMode('history')}
          >
            历史记录
          </button>
        </div>
      </div>

      {/* ---- Balance Cards ---- */}
      {viewMode === 'latest' && (
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
              <p className="dg-hint">本地开发可配置爬虫凭证后抓取</p>
            </div>
          )}

          {/* ---- Threshold Legend ---- */}
          <div className="dg-legend">
            <span className="dg-legend-item dg-legend--normal">充足</span>
            <span className="dg-legend-item dg-legend--warning">偏低</span>
            <span className="dg-legend-item dg-legend--low">告警</span>
            <span className="dg-legend-threshold">阈值 {threshold} 度</span>
          </div>
        </div>
      )}

      {/* ---- History Table ---- */}
      {viewMode === 'history' && (
        <div className="dg-history">
          {latestRecords.length === 0 ? (
            <p className="dg-empty-text">暂无历史记录</p>
          ) : (
            <div className="dg-table-wrap">
              <table className="dg-table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>空调 (度)</th>
                    <th>照明 (度)</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {latestRecords.map((r, i) => {
                    const total = (Number(r.kbalance) || 0) + (Number(r.zbalance) || 0)
                    const cls = balanceClass(total, threshold * 2)
                    return (
                      <tr key={i}>
                        <td>{new Date(r.record_time).toLocaleString('zh-CN')}</td>
                        <td className={balanceClass(r.kbalance, threshold)}>
                          {r.kbalance != null ? Number(r.kbalance).toFixed(2) : '—'}
                        </td>
                        <td className={balanceClass(r.zbalance, threshold)}>
                          {r.zbalance != null ? Number(r.zbalance).toFixed(2) : '—'}
                        </td>
                        <td>
                          <span className={`dg-status-dot ${cls}`} />
                          {cls === 'dg-balance--low' ? '告警' : cls === 'dg-balance--warning' ? '偏低' : '正常'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DormGuardTool
