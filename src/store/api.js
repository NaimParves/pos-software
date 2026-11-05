import { getToken, logout } from './auth'

// fetch wrapper for the POS API. Throws an Error with the server's message.
export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new Error('Cannot reach the server. Check that it is running.')
  }
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && token) logout()
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}
