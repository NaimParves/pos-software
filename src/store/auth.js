import { useSyncExternalStore } from 'react'

// The signed-in user and their API token. "Remember me" keeps the token in
// localStorage; otherwise it lasts until the browser tab closes.
const KEY = 'pos-session'
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())

function read() {
  try {
    const raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
let session = read() // { token, user }

export const getToken = () => session?.token || null

export async function login(phone, password, remember) {
  if (import.meta.env.VITE_DEMO) {
    const { demoApi } = await import('./demoServer')
    try {
      const data = await demoApi('/auth/login', { method: 'POST', body: { phone, password } })
      session = { token: data.token, user: data.user }
      try { (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(session)) } catch { /* storage blocked */ }
      emit()
      return { ok: true }
    } catch (e) { return { error: e.message } }
  }
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  }).catch(() => null)
  if (!res) return { error: 'Cannot reach the server. Check that it is running.' }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { error: data.error || 'Sign in failed' }
  session = { token: data.token, user: data.user }
  try { (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(session)) } catch { /* storage blocked */ }
  emit()
  return { ok: true }
}

export function logout() {
  session = null
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY) } catch { /* ignore */ }
  emit()
}

export function useUser() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => session?.user || null)
}
