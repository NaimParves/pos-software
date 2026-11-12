// Demo mode (GitHub Pages): there is no Node server, so this file answers the
// same /api requests inside the browser. Data starts from the sample data and
// is kept in this browser's localStorage only. Mirrors server/index.js.
import { seed } from './seed'

const KEY = 'pos-demo-db'
export const DEMO_LOGIN = { phone: 'admin', password: 'admin123' }

const DOCUMENTS = {
  sales: { prefix: 'S', stock: -1 },
  purchases: { prefix: 'P', stock: 1 },
  salesReturns: { prefix: 'SR', stock: 1 },
  purchaseReturns: { prefix: 'PR', stock: -1 },
  purchaseOrders: { prefix: 'PO', stock: 0 },
  damages: { prefix: 'D', stock: -1 },
}

function fresh() {
  const data = seed()
  const now = new Date().toISOString()
  for (const rows of Object.values(data)) rows.forEach((r) => { r.createdAt = now })
  const counters = { EXP: data.expenses.length }
  for (const [col, { prefix }] of Object.entries(DOCUMENTS)) counters[prefix] = data[col].length
  return { data, counters, password: DEMO_LOGIN.password }
}

let db = load()
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    if (saved?.data) return saved
  } catch { /* fall through */ }
  return fresh()
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { throw fail(507, 'Browser storage is full') }
}

const COLLECTIONS = Object.keys(seed())
const fail = (status, error) => Object.assign(new Error(error), { status })
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
const all = (col) => db.data[col] || (db.data[col] = [])
const get = (col, id) => all(col).find((r) => r.id === id) || null
const insert = (col, row) => { const rec = { ...row, id: newId(), createdAt: new Date().toISOString() }; all(col).push(rec); return rec }
const update = (col, id, patch) => {
  const list = all(col)
  const i = list.findIndex((r) => r.id === id)
  if (i < 0) return null
  list[i] = { ...list[i], ...patch, id }
  return list[i]
}
const nextNumber = (prefix) => {
  db.counters[prefix] = (db.counters[prefix] || 0) + 1
  return `${prefix}-${String(db.counters[prefix]).padStart(4, '0')}`
}
const clone = (x) => JSON.parse(JSON.stringify(x))
const sanitize = (body) => { const { id, createdAt, passwordHash, password, ...rest } = body || {}; return rest }

function adjustStock(items, sign) {
  const touched = new Map()
  for (const it of items) {
    const p = touched.get(it.productId) || get('products', it.productId)
    if (!p) continue
    touched.set(p.id, { ...p, stock: Math.round(((Number(p.stock) || 0) + sign * Number(it.qty)) * 100) / 100 })
  }
  return [...touched.values()].map((p) => update('products', p.id, { stock: p.stock }))
}

// A purchase made from a P/O ("Order Receive") marks that P/O as received
function linkPurchaseOrder(purchase, receivedId) {
  if (!purchase.purchaseOrderId || !get('purchaseOrders', purchase.purchaseOrderId)) return []
  const patch = receivedId
    ? { received: true, receivedPurchaseId: receivedId, receivedPurchaseNumber: purchase.number }
    : { received: false, receivedPurchaseId: '', receivedPurchaseNumber: '' }
  return [update('purchaseOrders', purchase.purchaseOrderId, patch)]
}

function checkItems(items) {
  if (!items.length) throw fail(400, 'Add at least one product')
  for (const it of items) {
    if (!get('products', it.productId)) throw fail(400, `Product not found: ${it.name || it.productId}`)
    if (!(Number(it.qty) > 0)) throw fail(400, `Quantity must be more than 0 for ${it.name}`)
  }
}

function handle(method, path, body, query) {
  const parts = path.split('/').filter(Boolean)

  if (path === '/auth/login' && method === 'POST') {
    const user = all('users').find((u) => u.phone === String(body?.phone || '').trim())
    if (!user || body?.password !== db.password) throw fail(401, 'These credentials do not match our records.')
    return { token: 'demo', user }
  }
  if (path === '/auth/me') return { user: all('users')[0] }
  if (path === '/auth/change-password' && method === 'POST') {
    if (body?.current !== db.password) throw fail(400, 'Current password is wrong')
    if (!body?.next || String(body.next).length < 6) throw fail(400, 'New password must be at least 6 characters')
    db.password = String(body.next)
    return { ok: true }
  }
  if (path === '/state') {
    const out = {}
    for (const col of COLLECTIONS) out[col] = all(col)
    return out
  }
  if (path === '/reset' && method === 'POST') { db = fresh(); return { ok: true } }

  if (parts[0] === 'documents') {
    const [, col, id] = parts
    const cfg = DOCUMENTS[col]
    if (!cfg) throw fail(404, 'Unknown document type')
    if (method === 'POST' && !id) {
      const doc = sanitize(body)
      checkItems(Array.isArray(doc.items) ? doc.items : [])
      if (col !== 'purchases') delete doc.purchaseOrderId
      if (doc.purchaseOrderId) {
        const po = get('purchaseOrders', doc.purchaseOrderId)
        if (!po) throw fail(400, 'That purchase order no longer exists')
        if (po.receivedPurchaseId && get('purchases', po.receivedPurchaseId)) throw fail(400, `${po.number} was already received as ${po.receivedPurchaseNumber}`)
      }
      const rec = insert(col, { ...doc, number: nextNumber(cfg.prefix), createdBy: 'Admin' })
      return { doc: rec, products: cfg.stock ? adjustStock(rec.items, cfg.stock) : [], purchaseOrders: linkPurchaseOrder(rec, rec.id) }
    }
    const old = get(col, id)
    if (!old) throw fail(404, 'Not found')
    if (method === 'PUT') {
      const { number, createdBy, purchaseOrderId, ...doc } = sanitize(body)
      checkItems(Array.isArray(doc.items) ? doc.items : [])
      const touched = new Map()
      if (cfg.stock) {
        adjustStock(old.items || [], -cfg.stock).forEach((p) => touched.set(p.id, p))
        adjustStock(doc.items, cfg.stock).forEach((p) => touched.set(p.id, p))
      }
      const rec = update(col, id, { ...doc, number: old.number, createdBy: old.createdBy, purchaseOrderId: old.purchaseOrderId || '', updatedBy: 'Admin', updatedAt: new Date().toISOString() })
      return { doc: rec, products: [...touched.values()] }
    }
    if (method === 'DELETE') {
      db.data[col] = all(col).filter((r) => r.id !== id)
      return { ok: true, products: cfg.stock ? adjustStock(old.items, -cfg.stock) : [], purchaseOrders: col === 'purchases' ? linkPurchaseOrder(old, null) : [] }
    }
  }

  const [col, id] = parts
  if (!COLLECTIONS.includes(col)) throw fail(404, `Unknown collection ${col}`)
  if (method === 'GET') return all(col)
  if (method === 'POST') {
    const row = sanitize(body)
    if (query.number) row.number = nextNumber(String(query.number))
    if (col !== 'users') row.createdBy = 'Admin'
    if (col === 'contacts' && !row.code) row.code = Math.max(1000, ...all('contacts').map((c) => Number(c.code) || 0)) + 1
    return insert(col, row)
  }
  if (method === 'PATCH') {
    if (DOCUMENTS[col] && body?.items) throw fail(400, 'Invoice lines cannot be edited this way')
    const rec = update(col, id, sanitize(body))
    if (!rec) throw fail(404, 'Not found')
    return rec
  }
  if (method === 'DELETE') {
    if (DOCUMENTS[col]) throw fail(400, 'Use /api/documents to delete invoices')
    const before = all(col).length
    db.data[col] = all(col).filter((r) => r.id !== id)
    if (db.data[col].length === before) throw fail(404, 'Not found')
    return { ok: true }
  }
  throw fail(404, 'Not found')
}

// Same contract as the real api(): resolves with data or throws Error(message)
export async function demoApi(fullPath, { method = 'GET', body } = {}) {
  const [path, qs = ''] = fullPath.split('?')
  const query = Object.fromEntries(new URLSearchParams(qs))
  const snapshot = JSON.stringify(db)
  try {
    const out = handle(method, path, body === undefined ? undefined : clone(body), query)
    if (method !== 'GET') persist()
    return clone(out)
  } catch (e) {
    db = JSON.parse(snapshot) // like a rolled-back transaction
    throw e
  }
}
