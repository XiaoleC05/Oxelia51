const API_BASE = '/api'

function authHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

async function parseResponse(res) {
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: text }
    }
  }
  if (!res.ok) throw new Error(data?.error || '请求失败')
  return data
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  return parseResponse(res)
}

export function getToken() {
  return localStorage.getItem('token')
}

export function setToken(token) {
  localStorage.setItem('token', token)
}

export function setRefreshToken(token) {
  localStorage.setItem('refresh_token', token)
}

export function clearToken() {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function apiGet(path, { auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    Object.assign(headers, authHeaders())
    delete headers['Content-Type']
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${API_BASE}${path}`, { headers })
  return parseResponse(res)
}

export async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: authHeaders() })
  if (res.status === 204) return null
  return parseResponse(res)
}

/** 经平台网关转发至工具后端 */
export async function apiProxy(slug, toolPath, options = {}) {
  const path = toolPath.replace(/^\//, '')
  const res = await fetch(`${API_BASE}/tools/${slug}/proxy/${path}`, {
    ...options,
    headers: authHeaders(options.headers || {}),
  })
  return parseResponse(res)
}

export function canUseTool(tool, user) {
  if (!tool) return false
  if (tool.status === 'disabled') return false
  if (user?.role === 'admin') return tool.online_capable && tool.status === 'enabled'
  return tool.user_accessible && tool.status === 'enabled' && tool.online_capable
}

export const BADGE_LABEL = {
  open: '已开放',
  closed_to_users: '暂未开放',
  offline: '已下线',
}
