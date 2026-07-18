import { useState, useEffect } from 'react'
import './WeatherBar.css'

function WeatherBar() {
  const [cities, setCities] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/weather')
        if (!res.ok || cancelled) return
        const json = await res.json().catch(() => null)
        if (!cancelled && json) {
          // 新格式：{cities: [...]}；旧格式兼容：{city, temp, icon, label}
          setCities(json.cities || (json.city ? [json] : []))
        }
      } catch {
        // 静默失败
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (!cities.length) return null

  return (
    <div className="weather-bar" aria-label="实时天气">
      {cities.map((c, i) => (
        <span key={i} className="weather-card">
          <span className="weather-card-city">{c.city}</span>
          <span className="weather-card-icon" aria-hidden="true">{c.icon}</span>
          <span className="weather-card-temp">{c.temp}°</span>
        </span>
      ))}
    </div>
  )
}

export default WeatherBar
