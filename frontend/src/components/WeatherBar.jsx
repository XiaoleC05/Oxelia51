import { useState, useEffect, useCallback } from 'react'
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
  const [denied, setDenied] = useState(false) // 定位被拒
  const [loading, setLoading] = useState(true) // 加载中

  const load = useCallback(async () => {
    let cancelled = false

    // 1) 检查 localStorage 缓存（TTL 15 分钟）
    try {
      const saved = localStorage.getItem(CACHE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL) {
          if (!cancelled) {
            setLoading(false)
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

    if (!cancelled) setLoading(true)

    // 2) 浏览器定位（Promise.race 防止浏览器不回调导致永久挂起）
    let lat, lon
    if (navigator?.geolocation?.getCurrentPosition) {
      const pos = await Promise.race([
        new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p),
            () => resolve(null),
            { timeout: 5000, maximumAge: 5 * 60 * 1000 }
          )
        }),
        new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
      ])
      if (pos) {
        lat = pos.coords.latitude
        lon = pos.coords.longitude
      }
    }

    // 3) 定位均失败 → 提示用户开启定位
    if (cancelled) return
    if (lat == null || lon == null) {
      setLoading(false)
      setDenied(true)
      return
    }

    // 4) 请求天气
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto`
    let weatherRes
    try {
      weatherRes = await fetch(weatherUrl)
    } catch {
      if (!cancelled) setLoading(false)
      return
    }
    if (cancelled) return
    if (!weatherRes?.ok) {
      setLoading(false)
      return
    }

    const weather = await weatherRes.json().catch(() => null)
    if (cancelled) return
    if (!weather?.current) {
      setLoading(false)
      return
    }

    const code = weather.current.weather_code
    const temp = Math.round(weather.current.temperature_2m)
    const mapped = WEATHER_MAP[code] || { label: '未知', icon: '🌡️' }

    // 5) 城市名（反向地理编码，失败不影响天气展示）
    let city = '未知'
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=zh`
      const geoRes = await fetch(geoUrl)
      if (geoRes?.ok) {
        const geo = await geoRes.json().catch(() => null)
        if (geo?.results?.[0]?.name) {
          city = geo.results[0].name
        }
      }
    } catch {
      // 忽略，城市名保持 '未知'
    }

    if (cancelled) return

    const payload = {
      city,
      temp,
      icon: mapped.icon,
      label: mapped.label,
    }
    setLoading(false)
    setData(payload)

    // 6) 写入缓存
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ ...payload, ts: Date.now() })
      )
    } catch {
      // 忽略
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 渲染优先级：data → denied → loading → null
  if (data) {
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

  // 定位被拒：显示可点击提示行，点击重试
  if (denied) {
    return (
      <div
        className="weather-bar weather-bar--hint"
        role="button"
        tabIndex={0}
        aria-label="点击重新获取定位"
        onClick={() => { setDenied(false); load() }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setDenied(false)
            load()
          }
        }}
      >
        <span>📍 开启定位查看天气</span>
      </div>
    )
  }

  // 加载中：让用户知道组件存在
  if (loading) {
    return (
      <div className="weather-bar weather-bar--loading" aria-label="获取天气中">
        <span>📍 获取天气中…</span>
      </div>
    )
  }

  return null
}

export default WeatherBar
