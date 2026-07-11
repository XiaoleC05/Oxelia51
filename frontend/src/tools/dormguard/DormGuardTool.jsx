import { useEffect, useState, useCallback, useRef } from 'react'
import { apiProxy } from '../../api'
import './DormGuardTool.css'

function balanceClass(value, threshold) {
  if (value == null) return ''
  if (value < threshold) return 'dg-balance--low'
  if (value < threshold * 1.5) return 'dg-balance--warning'
  return 'dg-balance--normal'
}

// 配置分组元数据：字段 key 必须与 DormGuard Go backend config.EnvValues 一致
const CONFIG_GROUPS = [
  {
    title: '爬虫配置',
    fields: [
      { key: 'CRAWLER_DORM_NUMBER', label: '宿舍号', type: 'text', hint: '如 101' },
      { key: 'CRAWLER_ROOM_ID', label: '房间 ID', type: 'text', hint: '爬虫接口要求的房间标识' },
      { key: 'CRAWLER_OPENID', label: 'OpenID', type: 'text', hint: '爬虫认证 openid' },
      {
        key: 'CRAWLER_JSESSIONID',
        label: 'JSESSIONID',
        type: 'password',
        sensitive: true,
        hint: '爬虫会话凭证；不改则保留原值',
      },
    ],
  },
  {
    title: '调度与告警',
    fields: [
      { key: 'SCHEDULER_INTERVAL_HOURS', label: '抓取间隔（小时）', type: 'number' },
      { key: 'ALERT_COOLDOWN_HOURS', label: '告警冷却（小时）', type: 'number' },
      {
        key: 'QQ_ALERT_PAUSE_UNTIL',
        label: 'QQ 告警暂停至',
        type: 'text',
        hint: 'ISO 时间，留空表示不暂停',
      },
      { key: 'CRAWLER_ALERT_THRESHOLD', label: '低余额阈值（元）', type: 'number', hint: '低于此值标红' },
    ],
  },
  {
    title: 'QQ 机器人',
    fields: [
      { key: 'QQ_BOT_ENABLED', label: '启用 QQ 机器人', type: 'checkbox' },
      { key: 'QQ_BOT_API_URL', label: '机器人 API 地址', type: 'text' },
      { key: 'QQ_BOT_GROUP_ID', label: '告警群号', type: 'text' },
    ],
  },
]

const ALL_CONFIG_KEYS = CONFIG_GROUPS.flatMap((g) => g.fields.map((f) => f.key))
const SENSITIVE_KEYS = new Set(
  CONFIG_GROUPS.flatMap((g) => g.fields.filter((f) => f.sensitive).map((f) => f.key))
)

function emptySettings() {
  const obj = {}
  for (const k of ALL_CONFIG_KEYS) obj[k] = ''
  return obj
}

// checkbox 后端存 'true'/'false' 字符串
function toFormValue(key, raw) {
  if (key === 'QQ_BOT_ENABLED') return raw === 'true' || raw === true
  return raw ?? ''
}

function toSubmissionValue(key, formValue) {
  if (key === 'QQ_BOT_ENABLED') return formValue ? 'true' : 'false'
  return String(formValue ?? '')
}

function DormGuardTool() {
  const [dormNumber, setDormNumber] = useState('')
  const [record, setRecord] = useState(null)
  const [records, setRecords] = useState([])
  const [settings, setSettings] = useState({})
  const threshold = Number(settings?.CRAWLER_ALERT_THRESHOLD) || 20
  const [viewMode, setViewMode] = useState('latest')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    let cancelled = false
    try {
      const settingsResp = await apiProxy('dormguard', 'api/admin/settings')
      const rawSettings = settingsResp?.settings ?? {}
      const dorm = rawSettings.CRAWLER_DORM_NUMBER || '101'
      if (cancelled) return
      setSettings(rawSettings)
      setDormNumber(dorm)

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const cleanup = loadData()
    return () => { if (cleanup) cleanup() }
  }, [loadData])

  const handleThresholdChange = useCallback(async (value) => {
    const newThreshold = Number(value) || 20
    setSettings(prev => ({ ...prev, CRAWLER_ALERT_THRESHOLD: String(newThreshold) }))
    try {
      const currentPayload = {}
      for (const k of ALL_CONFIG_KEYS) {
        currentPayload[k] = String(settings?.[k] ?? '')
      }
      currentPayload.CRAWLER_ALERT_THRESHOLD = String(newThreshold)
      const resp = await apiProxy('dormguard', 'api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: currentPayload }),
      })
      if (resp?.settings) {
        setSettings(resp.settings)
      }
    } catch { /* persist on next save */ }
  }, [settings])

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
          <button
            className={`dg-tab ${viewMode === 'config' ? 'dg-tab--active' : ''}`}
            onClick={() => setViewMode('config')}
          >
            配置
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
              <p className="dg-hint">可在「配置」tab 中填写爬虫凭证后手动抓取</p>
            </div>
          )}

          <div className="dg-legend">
            <span className="dg-legend-item dg-legend--normal">充足</span>
            <span className="dg-legend-item dg-legend--warning">偏低</span>
            <span className="dg-legend-item dg-legend--low">告警</span>
            <label className="dg-legend-threshold">
              阈值
              <input
                type="number"
                min="1"
                value={threshold}
                onChange={(e) => handleThresholdChange(e.target.value)}
                className="dg-threshold-input"
              />
              度
            </label>
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
                  {latestRecords.map((r) => {
                    const total = (Number(r.kbalance) || 0) + (Number(r.zbalance) || 0)
                    const cls = balanceClass(total, threshold * 2)
                    return (
                      <tr key={r.record_time || `${r.kbalance}-${r.zbalance}`}>
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

      {/* ---- Config Panel ---- */}
      {viewMode === 'config' && (
        <ConfigPanel initialSettings={settings} onSettingsChange={setSettings} />
      )}
    </div>
  )
}

/**
 * 配置面板：读写 DormGuard api/admin/settings，并提供手动操作按钮。
 * 敏感字段（CRAWLER_JSESSIONID）后端返回 ******，提交时若未改则原样回传，后端保留旧值。
 */
function ConfigPanel({ initialSettings, onSettingsChange }) {
  const [settings, setSettings] = useState(() => {
    if (initialSettings && Object.keys(initialSettings).length > 0) {
      const next = emptySettings()
      for (const k of ALL_CONFIG_KEYS) {
        next[k] = toFormValue(k, initialSettings[k])
      }
      return next
    }
    return emptySettings()
  })
  const [loading, setLoading] = useState(!initialSettings || Object.keys(initialSettings).length === 0)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveResult, setSaveResult] = useState(null) // { type: 'success'|'error', message, restartRequired }
  const [actionBusy, setActionBusy] = useState('') // 'crawl' | 'report' | 'qq-status' | ''
  const [actionResult, setActionResult] = useState(null) // { type, message, detail? }

  const lastSyncedRef = useRef(initialSettings)
  useEffect(() => {
    if (initialSettings && initialSettings !== lastSyncedRef.current) {
      lastSyncedRef.current = initialSettings
      const next = emptySettings()
      for (const k of ALL_CONFIG_KEYS) {
        next[k] = toFormValue(k, initialSettings[k])
      }
      setSettings(next)
    }
  }, [initialSettings])

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const resp = await apiProxy('dormguard', 'api/admin/settings')
      const raw = resp?.settings ?? {}
      const next = emptySettings()
      for (const k of ALL_CONFIG_KEYS) {
        next[k] = toFormValue(k, raw[k])
      }
      setSettings(next)
      lastSyncedRef.current = raw
      onSettingsChange?.(raw)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings()
  }, [loadSettings])

  function updateField(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaveResult(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaveResult(null)
    try {
      const payload = {}
      for (const k of ALL_CONFIG_KEYS) {
        payload[k] = toSubmissionValue(k, settings[k])
      }
      const resp = await apiProxy('dormguard', 'api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: payload }),
      })
      // 后端返回掩码后的 settings，回填表单
      const raw = resp?.settings ?? {}
      const next = emptySettings()
      for (const k of ALL_CONFIG_KEYS) {
        next[k] = toFormValue(k, raw[k])
      }
      setSettings(next)
      onSettingsChange?.(raw)
      const restartRequired = !!resp?.restart_required
      setSaveResult({
        type: 'success',
        message: restartRequired
          ? '配置已保存，服务正在重启，请稍后刷新'
          : '配置已保存',
        restartRequired,
      })
    } catch (err) {
      setSaveResult({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function runAction(kind) {
    setActionBusy(kind)
    setActionResult(null)
    try {
      let resp
      if (kind === 'crawl') {
        resp = await apiProxy('dormguard', 'api/system/crawl', { method: 'POST' })
      } else if (kind === 'report') {
        resp = await apiProxy('dormguard', 'api/system/report', { method: 'POST' })
      } else if (kind === 'qq-status') {
        resp = await apiProxy('dormguard', 'api/system/qq-status')
      }
      const ok = resp?.success !== false
      setActionResult({
        type: ok ? 'success' : 'error',
        message: resp?.message || (ok ? '操作成功' : '操作失败'),
        detail: resp?.detail,
      })
    } catch (err) {
      setActionResult({ type: 'error', message: err.message })
    } finally {
      setActionBusy('')
    }
  }

  if (loading) {
    return (
      <div className="dg-config">
        <div className="dg-loading">
          <div className="dg-spinner" />
          <p>加载配置…</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="dg-config">
        <div className="dg-error-banner">
          <p className="dg-error-text">{loadError}</p>
          <button className="dg-action-btn" onClick={loadSettings}>重试</button>
        </div>
      </div>
    )
  }

  return (
    <div className="dg-config">
      <form className="dg-config-form" onSubmit={handleSave}>
        {CONFIG_GROUPS.map((group) => (
          <fieldset key={group.title} className="dg-fieldset">
            <legend className="dg-fieldset-legend">{group.title}</legend>
            {group.fields.map((field) => {
              const value = settings[field.key]
              const isSensitive = SENSITIVE_KEYS.has(field.key)
              return (
                <label key={field.key} className="dg-field">
                  <span className="dg-field-label">
                    {field.label}
                    {isSensitive && <span className="dg-field-sensitive" title="敏感字段">●</span>}
                  </span>
                  {field.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      className="dg-checkbox"
                      checked={Boolean(value)}
                      onChange={(e) => updateField(field.key, e.target.checked)}
                    />
                  ) : (
                    <input
                      type={field.type}
                      className="dg-input"
                      value={value}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      placeholder={isSensitive ? '******' : ''}
                    />
                  )}
                  {field.hint && <span className="dg-field-hint">{field.hint}</span>}
                </label>
              )
            })}
          </fieldset>
        ))}

        <div className="dg-config-actions">
          <button type="submit" className="dg-save-btn" disabled={saving}>
            {saving ? '保存中…' : '保存配置'}
          </button>
          <button type="button" className="dg-reset-btn" onClick={loadSettings} disabled={saving}>
            重置
          </button>
        </div>

        {saveResult && (
          <div className={`dg-config-feedback dg-config-feedback--${saveResult.type}`}>
            <p>{saveResult.message}</p>
          </div>
        )}
      </form>

      {/* ---- 操作面板 ---- */}
      <fieldset className="dg-fieldset dg-fieldset--actions">
        <legend className="dg-fieldset-legend">手动操作</legend>
        <div className="dg-action-buttons">
          <button
            className="dg-action-btn"
            onClick={() => runAction('crawl')}
            disabled={actionBusy !== ''}
          >
            {actionBusy === 'crawl' ? '抓取中…' : '手动抓取电费'}
          </button>
          <button
            className="dg-action-btn"
            onClick={() => runAction('report')}
            disabled={actionBusy !== ''}
          >
            {actionBusy === 'report' ? '发送中…' : '发送报告到 QQ 群'}
          </button>
          <button
            className="dg-action-btn"
            onClick={() => runAction('qq-status')}
            disabled={actionBusy !== ''}
          >
            {actionBusy === 'qq-status' ? '检查中…' : '检查 QQ 机器人状态'}
          </button>
        </div>

        {actionResult && (
          <div className={`dg-config-feedback dg-config-feedback--${actionResult.type}`}>
            <p>{actionResult.message}</p>
            {actionResult.detail && (
              <pre className="dg-action-detail">{JSON.stringify(actionResult.detail, null, 2)}</pre>
            )}
          </div>
        )}
      </fieldset>
    </div>
  )
}

export default DormGuardTool
