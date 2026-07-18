import { useState, useEffect } from 'react'
import './WeatherBar.css'

function WeatherBar() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/weather')
        if (!res.ok || cancelled) return
        const json = await res.json().catch(() => null)
        if (!cancelled && json?.temp !== undefined) {
          setData(json)
        }
      } catch {
        // 静默失败
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (!data) return null

  return (
    <div className="weather-bar" aria-label="实时天气">
      <span className="weather-bar-icon" aria-hidden="true">{data.icon}</span>
      <span className="weather-bar-temp">{data.temp}°C</span>
      <span className="weather-bar-meta">{data.city} · {data.label}</span>
    </div>
  )
}

export default WeatherBar
