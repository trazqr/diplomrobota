const BASE = import.meta.env.VITE_API_URL || ''
const TIMEOUT_MS = 4000

try {
  localStorage.removeItem('dnd_token')
} catch {}

const DOWN_TTL_MS = 15_000
let serverDownUntil = 0

function markServerDown() {
  serverDownUntil = Date.now() + DOWN_TTL_MS
}

export function isServerDown() {
  return Date.now() < serverDownUntil
}

export function resetServerState() {
  serverDownUntil = 0
}

const unauthorizedListeners = new Set()

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

function notifyUnauthorized() {
  unauthorizedListeners.forEach(listener => listener())
}

export class ApiError extends Error {
  constructor(code, status, { field = null, message = null, endpoint = null } = {}) {
    super(message || code)
    this.code = code
    this.status = status
    this.field = field
    this.endpoint = endpoint
  }
}

export class ApiContractError extends ApiError {
  constructor(endpoint) {
    super('invalid_response', 0, { endpoint })
    this.name = 'ApiContractError'
  }
}

const isString = value => typeof value === 'string'
const isNonEmptyString = value => isString(value) && value.length > 0
const isNumber = value => typeof value === 'number' && Number.isFinite(value)
const isBoolean = value => typeof value === 'boolean'
const isNullableString = value => value === null || isString(value)
const isNullableNumber = value => value === null || isNumber(value)

const csrfShape = { token: isNonEmptyString }

const publicProfileShape = {
  login: isNonEmptyString,
  name: isString,
  charClass: isString,
  race: isString,
  level: isNumber,
  bio: isString,
  avatar: isString,
  role: isString,
  isAdmin: isBoolean,
  cursor: isString,
  showWanderers: isBoolean,
  showDragon: isBoolean,
  isOwner: isBoolean,
}

const profileShape = {
  login: isNonEmptyString,
  name: isString,
  charClass: isString,
  race: isString,
  level: isNumber,
  bio: isString,
  avatar: isString,
  posts: isNumber,
  reputation: isNumber,
}

const adminUserShape = {
  id: isNumber,
  login: isNonEmptyString,
  name: isString,
  role: isString,
  avatar: isString,
  charClass: isString,
  level: isNumber,
  createdAt: isNonEmptyString,
  banned: isBoolean,
  banReason: isString,
  bannedAt: isNullableString,
  isOwner: isBoolean,
  articles: isNumber,
  comments: isNumber,
}

const adminNewsShape = {
  id: isNumber,
  titleUa: isString,
  titleEn: isString,
  descUa: isString,
  descEn: isString,
  imageKey: isString,
  bgPos: isString,
  section: isString,
  sortOrder: isNumber,
  publishedAt: isNonEmptyString,
}

const articleListShape = {
  id: isNumber,
  title: isString,
  category: isString,
  excerpt: isString,
  author: isString,
  date: isNonEmptyString,
  likes: isNumber,
  comments: isNumber,
  liked: isBoolean,
  isOwner: isBoolean,
}

const commentShape = {
  id: isNumber,
  parentId: isNullableNumber,
  body: isString,
  deleted: isBoolean,
  author: isString,
  avatar: isString,
  date: isNonEmptyString,
  isOwner: isBoolean,
  canEdit: isBoolean,
}

function pagedShape(itemShape, extra = {}) {
  return {
    items: [itemShape],
    page: isNumber,
    pageSize: isNumber,
    total: isNumber,
    totalPages: isNumber,
    ...extra,
  }
}

function matchesShape(value, shape) {
  if (typeof shape === 'function') return shape(value)
  if (Array.isArray(shape)) {
    return Array.isArray(value) && value.every(item => matchesShape(item, shape[0]))
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(shape).every(
    ([key, childShape]) => Object.hasOwn(value, key) && matchesShape(value[key], childShape),
  )
}

export function assertShape(endpoint, data, shape) {
  if (!matchesShape(data, shape)) throw new ApiContractError(endpoint)
  return data
}

let csrfToken = null
let csrfRequest = null

function resetCsrfToken() {
  csrfToken = null
  csrfRequest = null
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken

  if (!csrfRequest) {
    csrfRequest = request('/api/auth/csrf', { auth: false, force: true })
      .then(data => assertShape('/api/auth/csrf', data, csrfShape).token)
      .then(token => {
        csrfToken = token
        return token
      })
      .finally(() => {
        csrfRequest = null
      })
  }

  return csrfRequest
}

async function request(
  path,
  { method = 'GET', body, auth = true, force = false, retryCsrf = true } = {},
) {
  if (!force && isServerDown()) throw new ApiError('offline', 0)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)

  const normalizedMethod = method.toUpperCase()
  const requiresCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod)

  try {
    const headers = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (requiresCsrf) headers['X-CSRF-TOKEN'] = await getCsrfToken()

    const res = await fetch(`${BASE}${path}`, {
      method: normalizedMethod,
      signal: ctrl.signal,
      headers,
      credentials: 'include',
      cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (!res.ok) {
      let code = `http_${res.status}`
      let field = null
      let message = null
      try {
        const data = await res.json()
        if (typeof data?.error === 'string') code = data.error
        if (typeof data?.field === 'string') field = data.field
        if (typeof data?.message === 'string') message = data.message
      } catch {}
      if (res.status === 401 && auth && code !== 'invalid_credentials') {
        notifyUnauthorized()
      }
      throw new ApiError(code, res.status, { field, message, endpoint: path })
    }

    return res.status === 204 ? null : await res.json()
  } catch (e) {
    if (e instanceof ApiError && e.code === 'csrf_invalid' && requiresCsrf && retryCsrf) {
      resetCsrfToken()
      return request(path, {
        method,
        body,
        auth,
        force,
        retryCsrf: false,
      })
    }

    if (e.name === 'AbortError' || e instanceof TypeError) {
      markServerDown()
      throw new ApiError('offline', 0)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export async function register(input) {
  const data = assertShape(
    '/api/auth/register',
    await request('/api/auth/register', { method: 'POST', body: input, auth: false, force: true }),
    { profile: publicProfileShape },
  )
  return data.profile
}

export async function login(loginName, password) {
  const data = assertShape(
    '/api/auth/login',
    await request('/api/auth/login', {
      method: 'POST',
      body: { login: loginName, password },
      auth: false,
      force: true,
    }),
    { profile: publicProfileShape },
  )
  return data.profile
}

export async function fetchAuthProviders() {
  const data = await request('/api/auth/providers', { auth: false, force: true })
  return { google: data?.google === true }
}

export function externalLoginUrl(provider) {
  const back = `${window.location.pathname}${window.location.hash}`
  return `${BASE}/api/auth/${provider}/start?returnUrl=${encodeURIComponent(back)}`
}

export async function logout() {
  try {
    await request('/api/auth/logout', { method: 'POST' })
  } finally {
    resetCsrfToken()
  }
}

export async function me() {
  return assertShape('/api/auth/me', await request('/api/auth/me'), publicProfileShape)
}

export async function changePassword(current, next) {
  return request('/api/auth/password', {
    method: 'POST',
    body: { current, new: next },
  })
}

export async function fetchProfile() {
  return assertShape('/api/profile', await request('/api/profile'), profileShape)
}

export async function saveProfile(profile) {
  return assertShape(
    '/api/profile',
    await request('/api/profile', { method: 'PUT', body: profile }),
    publicProfileShape,
  )
}

export async function fetchNews(lang, section) {
  const params = new URLSearchParams({ lang: lang === 'en' ? 'en' : 'ua' })
  if (section) params.set('section', section)
  return request(`/api/news?${params}`, { auth: false })
}

export async function checkServer() {
  try {
    await request('/api/health', { auth: false, force: true })
    return true
  } catch {
    return false
  }
}

export async function fetchPresets(lang) {
  return request(`/api/presets?lang=${lang === 'en' ? 'en' : 'ua'}`, { auth: false })
}

export async function fetchCampaigns(lang) {
  return request(`/api/campaigns?lang=${lang === 'en' ? 'en' : 'ua'}`, { auth: false })
}

export async function fetchRules(lang) {
  return request(`/api/rules?lang=${lang === 'en' ? 'en' : 'ua'}`, { auth: false })
}

export async function fetchActivity() {
  return request('/api/profile/activity')
}

export async function fetchUsers({ page = 1, pageSize = 25 } = {}) {
  const endpoint = `/api/admin/users?page=${page}&pageSize=${pageSize}`
  return assertShape(
    endpoint,
    await request(endpoint),
    pagedShape(adminUserShape, { adminCount: isNumber }),
  )
}

export async function setUserRole(id, role) {
  return request(`/api/admin/users/${id}/role`, { method: 'PUT', body: { role }, force: true })
}

export async function setUserBan(id, banned, reason = '') {
  return request(`/api/admin/users/${id}/ban`, {
    method: 'PUT',
    body: { banned, reason },
    force: true,
  })
}

export async function deleteUser(id) {
  return request(`/api/admin/users/${id}`, { method: 'DELETE', force: true })
}

export async function resetUserPassword(id, password = '') {
  return request(`/api/admin/users/${id}/password`, {
    method: 'POST',
    body: { password },
    force: true,
  })
}

export async function fetchProfileStats() {
  return request('/api/profile/stats')
}

export async function fetchArticles({
  category = 'all',
  sort = 'date',
  page = 1,
  pageSize = 12,
} = {}) {
  const endpoint = `/api/articles?category=${encodeURIComponent(category)}&sort=${sort}&page=${page}&pageSize=${pageSize}`
  return assertShape(endpoint, await request(endpoint), pagedShape(articleListShape))
}

export async function createArticle(article) {
  return request('/api/articles', { method: 'POST', body: article })
}

export async function deleteArticle(id) {
  return request(`/api/articles/${id}`, { method: 'DELETE' })
}

export async function fetchArticle(id) {
  return request(`/api/articles/${id}`, { auth: true })
}

export async function updateArticle(id, article) {
  return request(`/api/articles/${id}`, { method: 'PUT', body: article, force: true })
}

export async function toggleLike(id) {
  return request(`/api/articles/${id}/like`, { method: 'POST', force: true })
}

export async function fetchComments(type, id, { page = 1, pageSize = 20 } = {}) {
  const endpoint = `/api/${type}/${id}/comments?page=${page}&pageSize=${pageSize}`
  return assertShape(
    endpoint,
    await request(endpoint),
    pagedShape(commentShape, { commentCount: isNumber }),
  )
}

export async function addComment(type, id, body, parentId = null) {
  return request(`/api/${type}/${id}/comments`, {
    method: 'POST',
    body: { body, parentId },
    force: true,
  })
}

export async function deleteComment(id) {
  return request(`/api/comments/${id}`, { method: 'DELETE', force: true })
}

export async function updateComment(id, body) {
  return request(`/api/comments/${id}`, { method: 'PUT', body: { body }, force: true })
}

export async function restoreComment(id) {
  return request(`/api/comments/${id}/restore`, { method: 'POST', force: true })
}

export async function hardDeleteComment(id) {
  return request(`/api/comments/${id}/hard`, { method: 'DELETE', force: true })
}

export async function fetchNewsItem(id, lang) {
  return request(`/api/news/${id}?lang=${lang === 'en' ? 'en' : 'ua'}`, { auth: false })
}

export async function fetchAdminNewsItem(id) {
  const endpoint = `/api/admin/news/${id}`
  return assertShape(endpoint, await request(endpoint), adminNewsShape)
}

export async function createNews(item) {
  return request('/api/news', { method: 'POST', body: item, force: true })
}

export async function updateNews(id, item) {
  return request(`/api/news/${id}`, { method: 'PUT', body: item, force: true })
}

export async function deleteNews(id) {
  return request(`/api/news/${id}`, { method: 'DELETE', force: true })
}

export async function fetchFriends() {
  return request('/api/friends')
}

export async function fetchFriendList({ kind = 'friends', q = '', page = 1, pageSize = 10 } = {}) {
  const params = new URLSearchParams({
    kind,
    page: String(page),
    pageSize: String(pageSize),
  })
  if (q) params.set('q', q)
  return request(`/api/friends/list?${params.toString()}`)
}

export async function fetchIgnored({ q = '', page = 1, pageSize = 10 } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (q) params.set('q', q)
  return request(`/api/ignores?${params.toString()}`)
}

export async function addIgnore(login) {
  return request(`/api/ignores/${encodeURIComponent(login)}`, { method: 'POST', force: true })
}

export async function removeIgnore(userId) {
  return request(`/api/ignores/${userId}`, { method: 'DELETE', force: true })
}

export async function requestFriend(login) {
  return request(`/api/friends/${encodeURIComponent(login)}`, { method: 'POST', force: true })
}

export async function acceptFriend(id) {
  return request(`/api/friends/${id}/accept`, { method: 'POST', force: true })
}

export async function removeFriend(id) {
  return request(`/api/friends/${id}`, { method: 'DELETE', force: true })
}

export async function fetchUserProfile(login) {
  return request(`/api/users/${encodeURIComponent(login)}`, { auth: false })
}

export async function fetchClans({ page = 1, pageSize = 20 } = {}) {
  return request(`/api/clans?page=${page}&pageSize=${pageSize}`, { auth: false })
}

export async function fetchClan(id) {
  return request(`/api/clans/${id}`, { auth: false })
}

export async function fetchClanMembers(
  id,
  { q = '', status = 'active', page = 1, pageSize = 10 } = {},
) {
  const params = new URLSearchParams({
    status,
    page: String(page),
    pageSize: String(pageSize),
  })
  if (q) params.set('q', q)
  return request(`/api/clans/${id}/members?${params.toString()}`, { auth: false })
}

export async function createClan(clan) {
  return request('/api/clans', { method: 'POST', body: clan, force: true })
}

export async function updateClan(id, clan) {
  return request(`/api/clans/${id}`, { method: 'PUT', body: clan, force: true })
}

export async function joinClan(id) {
  return request(`/api/clans/${id}/join`, { method: 'POST', force: true })
}

export async function approveClanMember(id, userId) {
  return request(`/api/clans/${id}/members/${userId}/approve`, { method: 'POST', force: true })
}

export async function setClanMemberRole(id, userId, role) {
  return request(`/api/clans/${id}/members/${userId}/role`, {
    method: 'PUT',
    body: { role },
    force: true,
  })
}

export async function removeClanMember(id, userId) {
  return request(`/api/clans/${id}/members/${userId}`, { method: 'DELETE', force: true })
}

export async function deleteClan(id) {
  return request(`/api/clans/${id}`, { method: 'DELETE', force: true })
}

export async function transferClan(id, userId) {
  return request(`/api/clans/${id}/transfer/${userId}`, { method: 'POST', force: true })
}
