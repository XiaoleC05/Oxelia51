const API_BASE = '/api'

function authHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra }
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
    headers['X-Oxelia51-Access-Token'] = token
  }
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
  if (res.status === 401) {
    // Token 过期或无效：清除本地凭据并跳转登录页
    clearToken()
    localStorage.removeItem('user')
    if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
      window.location.href = '/login'
    }
    throw new Error(data?.error || '登录已过期，请重新登录')
  }
  if (!res.ok) {
    const detail = data?.detail
    const detailMsg = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((d) => d?.msg || JSON.stringify(d)).join('; ')
        : null
    throw new Error(data?.error || detailMsg || `请求失败 (${res.status})`)
  }
  return data
}

export async function apiPost(path, body, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
    ...options,
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

export function getRefreshToken() {
  return localStorage.getItem('refresh_token')
}

export function clearToken() {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
}

/** 登出：吊销 access jti + refresh token，再清本地存储 */
export async function logout() {
  const refreshToken = getRefreshToken()
  try {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ refresh_token: refreshToken || '' }),
    })
    if (res.status !== 204 && res.status !== 401) {
      await parseResponse(res)
    }
  } catch {
    // 网络失败仍清本地，避免用户卡在已登出态
  }
  clearToken()
  localStorage.removeItem('user')
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
  const res = await fetch(`${API_BASE}${path}`, { headers, cache: 'no-store' })
  return parseResponse(res)
}

export async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: authHeaders() })
  if (res.status === 204) return null
  return parseResponse(res)
}

export async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  return parseResponse(res)
}

export async function apiPatch(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  return parseResponse(res)
}

/** 经平台网关转发至工具后端 */
export async function apiProxy(slug, toolPath, options = {}) {
  const path = toolPath.replace(/^\//, '')
  const res = await fetch(`${API_BASE}/tools/${slug}/proxy/${path}`, {
    ...options,
    cache: 'no-store',
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

/* ---- Hero Images (头图轮播) ---- */

/** 公开：获取已启用的头图列表 */
export async function fetchHeroImages() {
  return apiGet('/hero-images')
}

/** 管理端：获取全部头图列表 */
export async function adminFetchHeroImages() {
  return apiGet('/admin/hero-images', { auth: true })
}

/** 管理端：创建头图 */
export async function adminCreateHeroImage(data) {
  return apiPost('/admin/hero-images', data)
}

/** 管理端：更新头图 */
export async function adminUpdateHeroImage(id, data) {
  return apiPut(`/admin/hero-images/${id}`, data)
}

/** 管理端：删除头图 */
export async function adminDeleteHeroImage(id) {
  return apiDelete(`/admin/hero-images/${id}`)
}

/** 管理端：上传图片文件（multipart form，不带 JSON Content-Type） */
export async function adminUploadHeroImage(file) {
  const formData = new FormData()
  formData.append('file', file)

  const headers = {}
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}/admin/hero-images/upload`, {
    method: 'POST',
    headers,
    body: formData,
  })
  return parseResponse(res)
}

/** 管理端：更新轮播间隔设置 */
export async function adminUpdateCarouselSettings(intervalMs) {
  return apiPut('/admin/carousel-settings', { autoplay_interval_ms: intervalMs })
}

/* ---- Articles (文章展示) ---- */

/** 公开：获取已启用的文章列表 */
export async function fetchArticles() {
  return apiGet('/articles')
}

/** 管理端：获取全部文章 */
export async function adminFetchArticles() {
  return apiGet('/admin/articles', { auth: true })
}

/** 管理端：创建文章 */
export async function adminCreateArticle(data) {
  return apiPost('/admin/articles', data)
}

/** 管理端：更新文章 */
export async function adminUpdateArticle(id, data) {
  return apiPut(`/admin/articles/${id}`, data)
}

/** 管理端：删除文章 */
export async function adminDeleteArticle(id) {
  return apiDelete(`/admin/articles/${id}`)
}

