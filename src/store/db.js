import { useSyncExternalStore } from 'react'
import { api } from './api'
import { toast } from '../components/Toast'

// Client-side cache of the server's data. Pages read from the cache through
// useCollection/useDb; every change is sent to the API and the cache is then
// updated with what the server returns.
const COLLECTIONS = [
  'sizes', 'categories', 'brands', 'grades', 'units', 'variations', 'products', 'contacts',
  'sales', 'purchases', 'salesReturns', 'purchaseReturns', 'directReturns', 'purchaseOrders', 'damages',
  'expenses', 'incomes', 'transfers', 'payments', 'settlements', 'accountHeads', 'branches', 'users',
  'messages', 'phoneBook', 'sentMessages', 'permissions', 'attendance', 'leaves', 'salarySheets',
  'paySlips', 'salaryGrades', 'salaryStatements', 'holidays', 'shifts',
]
const empty = () => Object.fromEntries(COLLECTIONS.map((c) => [c, []]))

let state = empty()
let status = { loaded: false, loading: false, error: '', at: 0 }
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
const set = (name, rows) => { state = { ...state, [name]: rows }; emit() }
const merge = (name, recs) => {
  const byId = new Map(recs.map((r) => [r.id, r]))
  set(name, state[name].map((r) => byId.get(r.id) || r))
}

// Show the server's message and resolve to null instead of throwing,
// so a failed save never crashes a page.
async function attempt(fn) {
  try { return await fn() } catch (e) { toast.error(e.message); return null }
}

export async function loadState({ quiet = false } = {}) {
  if (status.loading) return
  status = { ...status, loading: true, error: quiet ? status.error : '' }
  emit()
  try {
    state = { ...empty(), ...(await api('/state')) }
    status = { loaded: true, loading: false, error: '', at: Date.now() }
  } catch (e) {
    status = { ...status, loading: false, error: quiet ? status.error : e.message }
  }
  emit()
}

export function clearState() {
  if (!status.loaded && !status.loading && !status.error) return // already empty
  state = empty()
  status = { loaded: false, loading: false, error: '', at: 0 }
  emit()
}

// Pick up other users' changes when the window regains focus
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    if (status.loaded && Date.now() - status.at > 30000) loadState({ quiet: true })
  })
}

export const db = {
  get: (name) => state[name] || [],

  // options.number: ask the server to assign a document number with this prefix
  insert: (name, row, options = {}) => attempt(async () => {
    const qs = options.number ? `?number=${encodeURIComponent(options.number)}` : ''
    const rec = await api(`/${name}${qs}`, { method: 'POST', body: row })
    set(name, [...state[name], rec])
    return rec
  }),

  update: (name, id, patch) => attempt(async () => {
    const rec = await api(`/${name}/${id}`, { method: 'PATCH', body: patch })
    merge(name, [rec])
    return rec
  }),

  remove: (name, id) => attempt(async () => {
    await api(`/${name}/${id}`, { method: 'DELETE' })
    set(name, state[name].filter((r) => r.id !== id))
    return true
  }),

  // Invoices etc.: the server numbers the document and moves stock together
  saveDocument: (name, doc) => attempt(async () => {
    const res = await api(`/documents/${name}`, { method: 'POST', body: doc })
    set(name, [...state[name], res.doc])
    merge('products', res.products)
    merge('purchaseOrders', res.purchaseOrders || [])
    return res.doc
  }),

  // Edit a saved invoice: the server undoes the old stock movement and applies the new one
  updateDocument: (name, id, doc) => attempt(async () => {
    const res = await api(`/documents/${name}/${id}`, { method: 'PUT', body: doc })
    merge(name, [res.doc])
    merge('products', res.products)
    return res.doc
  }),

  removeDocument: (name, id) => attempt(async () => {
    const res = await api(`/documents/${name}/${id}`, { method: 'DELETE' })
    set(name, state[name].filter((r) => r.id !== id))
    merge('products', res.products)
    merge('purchaseOrders', res.purchaseOrders || [])
    return true
  }),

  reset: () => attempt(async () => {
    await api('/reset', { method: 'POST' })
    await loadState()
    return true
  }),
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }

export const useCollection = (name) => useSyncExternalStore(subscribe, () => state[name] || [])
export const useDb = () => useSyncExternalStore(subscribe, () => state)
export const useLoadStatus = () => useSyncExternalStore(subscribe, () => status)

// Totals behind a customer's or supplier's balance.
//  billed:   opening balance + invoices + money paid back to them (return refunds, advance refunds)
//  received: paid on invoices + returns credited + payments + payment discounts + write-offs
//  balance:  billed - received. Positive = they owe the shop (customer) / the shop owes them
//            (supplier). Negative = advance (they have money with the shop / the shop paid ahead).
// Settlements with refund: true pay an advance back (they raise the balance towards 0);
// older settlements without it were write-offs of a due.
export function contactSummary(contact, s = state) {
  if (!contact) return { billed: 0, received: 0, balance: 0 }
  const isSupplier = contact.type === 'supplier'
  const mine = (x) => x.contactId === contact.id
  const docs = (isSupplier ? s.purchases : s.sales).filter(mine)
  const returns = (isSupplier ? s.purchaseReturns : s.salesReturns).filter(mine)
  const payType = isSupplier ? 'pay' : 'receive'
  const pays = s.payments.filter((p) => mine(p) && p.type === payType)
  const setts = s.settlements.filter(mine)
  const n = (v) => Number(v || 0)
  const billed = n(contact.openingBalance)
    + docs.reduce((a, d) => a + n(d.invoiceAmount), 0)
    + returns.reduce((a, d) => a + n(d.paid), 0)
    + setts.filter((x) => x.refund).reduce((a, x) => a + n(x.amount), 0)
  const received = docs.reduce((a, d) => a + n(d.invoiceAmount) - n(d.due), 0)
    + returns.reduce((a, d) => a + n(d.invoiceAmount), 0)
    + pays.reduce((a, p) => a + n(p.amount) + n(p.discount), 0)
    + setts.filter((x) => !x.refund).reduce((a, x) => a + n(x.amount), 0)
  return { billed: Math.round(billed * 100) / 100, received: Math.round(received * 100) / 100, balance: Math.round((billed - received) * 100) / 100 }
}

// Balance owed by a customer (positive) or owed to a supplier (positive).
export function contactBalance(contact, s = state) {
  return contactSummary(contact, s).balance
}
