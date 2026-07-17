import { useState, useEffect } from 'react'
import './WeatherBar.css'

/* ===== WMO 天气码 → 中文描述 + emoji ===== */
const WEATHER_MAP = {
  0: { label: '晴天', icon: '☀️' },
  1: { label: '少云', icon: '🌤️' },
  2: { label: '多云', icon: '⛅' },
  3: { label: '阴', icon: '☁️' },
  45: { label: '雾', icon: '🌫️' },
  48: { label: '雾凇', icon: '🌫️' },
  51: { label: '小毛毛雨', icon: '🌧️' },
  53: { label: '毛毛雨', icon: '🌧️' },
  55: { label: '大毛毛雨', icon: '🌧️' },
  61: { label: '小雨', icon: '🌧️' },
  63: { label: '中雨', icon: '🌧️' },
  65: { label: '大雨', icon: '🌧️' },
  71: { label: '小雪', icon: '❄️' },
  73: { label: '中雪', icon: '❄️' },
  75: { label: '大雪', icon: '❄️' },
  77: { label: '雪粒', icon: '❄️' },
  80: { label: '阵雨', icon: '🌦️' },
  81: { label: '大阵雨', icon: '🌦️' },
  82: { label: '强阵雨', icon: '🌦️' },
  85: { label: '小阵雪', icon: '❄️' },
  86: { label: '大阵雪', icon: '❄️' },
  95: { label: '雷暴', icon: '⛈️' },
  96: { label: '冰雹雷暴', icon: '⛈️' },
  99: { label: '强雷暴', icon: '⛈️' },
}

const CACHE_KEY = 'weather_cache'
const CACHE_TTL = 15 * 60 * 1000 // 15 分钟

function WeatherBar() {
  const [data, setData] = useState(null) // {city, temp, icon, label}

  useEffect(() => {
    let cancelled = false

    async function load() {
      // 1) 检查 localStorage 缓存（TTL 15 分钟）
      try {
        const saved = localStorage.getItem(CACHE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL) {
            if (!cancelled) {
              setData({
                city: parsed.city,
                temp: parsed.temp,
                icon: parsed.icon,
                label: parsed.label,
              })
            }
            return
          }
        }
      } catch {
        // 缓存解析失败，继续走 API 流程
      }

      // 2) 浏览器定位
      if (!navigator?.geolocation?.getCurrentPosition) return
      const pos = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p),
          () => resolve(null),
          { timeout: 8000, maximumAge: 5 * 60 * 1000 }
        )
      })
      if (!pos || cancelled) return
      const { latitude: lat, longitude: lon } = pos.coords

      // 3) 并行请求天气 + 反向地理编码
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto`
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=zh`
      let weatherRes, geoRes
      try {
        ;[weatherRes, geoRes] = await Promise.all([fetch(weatherUrl), fetch(geoUrl)])
      } catch {
        return // 网络错误：静默
      }
      if (!weatherRes?.ok) return

      const weather = await weatherRes.json().catch(() => null)
      if (!weather?.current) return

      const code = weather.current.weather_code
      const temp = Math.round(weather.current.temperature_2m)
      const mapped = WEATHER_MAP[code] || { label: '未知', icon: '🌡️' }

      // 4) 城市名（反向地理编码可能失败）
      let city = '未知'
      try {
        const geo = await geoRes?.json()
        if (geo?.results?.[0]?.name) {
          city = geo.results[0].name
        }
      } catch {
        // 忽略
      }

      if (cancelled) return

      const payload = {
        city,
        temp,
        icon: mapped.icon,
        label: mapped.label,
      }
      setData(payload)

      // 5) 写入缓存
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ ...payload, ts: Date.now() })
        )
      } catch {
        // 忽略
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // loading 或 error 时不渲染（静默）
  if (!data) return null

  return (
    <div className="weather-bar" aria-label="实时天气">
      <span className="weather-bar-icon" aria-hidden="true">{data.icon}</span>
      <span className="weather-bar-city">{data.city}</span>
      <span className="weather-bar-sep" aria-hidden="true">·</span>
      <span className="weather-bar-temp">{data.temp}°C</span>
      <span className="weather-bar-sep" aria-hidden="true">·</span>
      <span className="weather-bar-label">{data.label}</span>
    </div>
  )
}

export default WeatherBar
