import express from 'express'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { store, tx, COLLECTIONS, DOCUMENTS, ensureSeeded, loadSeed, DATA_DIR } from './db.js'
import { makeAuth, hashPassword, verifyPassword, ADMIN_ROLES } from './auth.js'
import { canChangeRecord, DELIVERY_FIELDS } from '../src/config/permissions.js'

const here = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.API_PORT) || 3001
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

// JWT secret: from the environment, or generated once and kept in server/data
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  const file = join(DATA_DIR, '.jwt-secret')
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  const s = randomBytes(48).toString('hex')
  writeFileSync(file, s)
  return s
}

if (ensureSeeded(ADMIN_PASSWORD)) console.log('Database created with sample data.')
const auth = makeAuth(loadSecret())
const app = express()
app.use(express.json({ limit: '10mb' })) // product/contact images are sent as data URLs

const safeUser = ({ passwordHash, ...u }) => u
const clean = (col, row) => (col === 'users' ? safeUser(row) : row)
const getUser = (id) => store.get('users', id)
const requireAuth = auth.required(getUser)

const checkCollection = (req, res, next) =>
  COLLECTIONS.includes(req.params.col) ? next() : res.status(404).json({ error: `Unknown collection ${req.params.col}` })

// Only admins may change users, branches or permissions
const ADMIN_COLLECTIONS = ['users', 'branches', 'permissions']
const guardAdmin = (req, res, next) =>
  ADMIN_COLLECTIONS.includes(req.params.col) && !ADMIN_ROLES.includes(req.user.role)
    ? res.status(403).json({ error: 'Only an admin can do this' })
    : next()

// Edit / Delete rights per role (Basic Settings > Security System > Set Permission)
function allowed(req, action, col, record) {
  const map = store.all('permissions')[0]?.map
  return canChangeRecord(map, req.user.role, action, col, record)
}
const denied = (res, action) => res.status(403).json({ error: `Your role is not allowed to ${action} this` })

// A purchase made from a P/O ("Order Receive") marks that P/O as received
function linkPurchaseOrder(purchase, receivedId) {
  if (!purchase.purchaseOrderId) return []
  const po = store.get('purchaseOrders', purchase.purchaseOrderId)
  if (!po) return []
  const patch = receivedId
    ? { received: true, receivedPurchaseId: receivedId, receivedPurchaseNumber: purchase.number }
    : { received: false, receivedPurchaseId: '', receivedPurchaseNumber: '' }
  return [store.update('purchaseOrders', po.id, patch)]
}

// Strip fields the client may not set directly
function sanitize(col, body) {
  const { id, createdAt, passwordHash, password, ...rest } = body || {}
  if (col === 'users') {
    if (password) rest.passwordHash = hashPassword(password)
    if (rest.phone && store.all('users').some((u) => u.phone === rest.phone && u.id !== id)) {
      throw Object.assign(new Error('Another user already has this phone number'), { status: 400 })
    }
  }
  return rest
}

// ---------- auth ----------
app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body || {}
  const user = store.all('users').find((u) => u.phone === String(phone || '').trim())
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'These credentials do not match our records.' })
  }
  if (user.status === 'Inactive') return res.status(403).json({ error: 'This account is inactive.' })
  res.json({ token: auth.sign(user), user: safeUser(user) })
})

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: safeUser(req.user) }))

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { current, next } = req.body || {}
  if (!verifyPassword(current, req.user.passwordHash)) return res.status(400).json({ error: 'Current password is wrong' })
  if (!next || String(next).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' })
  store.update('users', req.user.id, { passwordHash: hashPassword(next) })
  res.json({ ok: true })
})

// ---------- whole state (loaded once after login) ----------
app.get('/api/state', requireAuth, (req, res) => {
  const out = {}
  for (const col of COLLECTIONS) out[col] = store.all(col).map((r) => clean(col, r))
  res.json(out)
})

app.post('/api/reset', requireAuth, auth.adminOnly, (req, res) => {
  loadSeed({ wipe: true, adminPassword: ADMIN_PASSWORD })
  res.json({ ok: true })
})

// ---------- invoices and other stock documents ----------
// Saving a document assigns its number and moves stock in one transaction.
app.post('/api/documents/:col', requireAuth, (req, res) => {
  const cfg = DOCUMENTS[req.params.col]
  if (!cfg) return res.status(404).json({ error: 'Unknown document type' })
  const body = sanitize(req.params.col, req.body)
  const items = Array.isArray(body.items) ? body.items : []
  if (!items.length) return res.status(400).json({ error: 'Add at least one product' })
  for (const it of items) {
    if (!store.get('products', it.productId)) return res.status(400).json({ error: `Product not found: ${it.name || it.productId}` })
    if (!(Number(it.qty) > 0)) return res.status(400).json({ error: `Quantity must be more than 0 for ${it.name}` })
  }
  if (req.params.col !== 'purchases') delete body.purchaseOrderId
  if (body.purchaseOrderId) {
    const po = store.get('purchaseOrders', body.purchaseOrderId)
    if (!po) return res.status(400).json({ error: 'That purchase order no longer exists' })
    if (po.receivedPurchaseId && store.get('purchases', po.receivedPurchaseId)) {
      return res.status(400).json({ error: `${po.number} was already received as ${po.receivedPurchaseNumber}` })
    }
  }
  const result = tx(() => {
    const doc = store.insert(req.params.col, {
      ...body, number: store.nextNumber(cfg.prefix), createdBy: req.user.name,
    })
    const products = cfg.stock ? adjustStock(items, cfg.stock) : []
    return { doc, products, purchaseOrders: linkPurchaseOrder(doc, doc.id) }
  })
  res.status(201).json(result)
})

// Editing a document keeps its number; stock from the old lines is put back
// and the new lines are applied, all in one transaction.
app.put('/api/documents/:col/:id', requireAuth, (req, res) => {
  const cfg = DOCUMENTS[req.params.col]
  if (!cfg) return res.status(404).json({ error: 'Unknown document type' })
  const old = store.get(req.params.col, req.params.id)
  if (!old) return res.status(404).json({ error: 'Not found' })
  if (!allowed(req, 'edit', req.params.col, old)) return denied(res, 'edit')
  const { number, createdBy, purchaseOrderId, ...body } = sanitize(req.params.col, req.body)
  const items = Array.isArray(body.items) ? body.items : []
  if (!items.length) return res.status(400).json({ error: 'Add at least one product' })
  for (const it of items) {
    if (!store.get('products', it.productId)) return res.status(400).json({ error: `Product not found: ${it.name || it.productId}` })
    if (!(Number(it.qty) > 0)) return res.status(400).json({ error: `Quantity must be more than 0 for ${it.name}` })
  }
  const result = tx(() => {
    const touched = new Map()
    if (cfg.stock) {
      adjustStock(old.items || [], -cfg.stock).forEach((p) => touched.set(p.id, p))
      adjustStock(items, cfg.stock).forEach((p) => touched.set(p.id, p))
    }
    const doc = store.update(req.params.col, old.id, {
      ...body, number: old.number, createdBy: old.createdBy, purchaseOrderId: old.purchaseOrderId || '',
      updatedBy: req.user.name, updatedAt: new Date().toISOString(),
    })
    return { doc, products: [...touched.values()] }
  })
  res.json(result)
})

app.delete('/api/documents/:col/:id', requireAuth, (req, res) => {
  const cfg = DOCUMENTS[req.params.col]
  if (!cfg) return res.status(404).json({ error: 'Unknown document type' })
  const doc = store.get(req.params.col, req.params.id)
  if (!doc) return res.status(404).json({ error: 'Not found' })
  if (!allowed(req, 'delete', req.params.col, doc)) return denied(res, 'delete')
  const result = tx(() => {
    store.remove(req.params.col, doc.id)
    const products = cfg.stock ? adjustStock(doc.items, -cfg.stock) : []
    const purchaseOrders = req.params.col === 'purchases' ? linkPurchaseOrder(doc, null) : []
    return { ok: true, products, purchaseOrders }
  })
  res.json(result)
})

function adjustStock(items, sign) {
  const touched = new Map()
  for (const it of items) {
    const p = touched.get(it.productId) || store.get('products', it.productId)
    if (!p) continue
    touched.set(p.id, { ...p, stock: Math.round(((Number(p.stock) || 0) + sign * Number(it.qty)) * 100) / 100 })
  }
  return [...touched.values()].map((p) => store.update('products', p.id, { stock: p.stock }))
}

// ---------- generic collections ----------
app.get('/api/:col', requireAuth, checkCollection, (req, res) => {
  res.json(store.all(req.params.col).map((r) => clean(req.params.col, r)))
})

app.post('/api/:col', requireAuth, checkCollection, guardAdmin, (req, res) => {
  const col = req.params.col
  const row = sanitize(col, req.body)
  if (col === 'users' && !row.passwordHash) return res.status(400).json({ error: 'Password is required for a new user' })
  const rec = tx(() => {
    if (req.query.number) row.number = store.nextNumber(String(req.query.number))
    if (col !== 'users') row.createdBy = req.user.name
    if (col === 'contacts' && !row.code) row.code = Math.max(1000, ...store.all('contacts').map((c) => Number(c.code) || 0)) + 1
    return store.insert(col, row)
  })
  res.status(201).json(clean(col, rec))
})

app.patch('/api/:col/:id', requireAuth, checkCollection, guardAdmin, (req, res) => {
  const col = req.params.col
  if (DOCUMENTS[col] && req.body?.items) return res.status(400).json({ error: 'Invoice lines cannot be edited; delete and re-enter the invoice' })
  const current = store.get(col, req.params.id)
  if (!current) return res.status(404).json({ error: 'Not found' })
  const deliveryOnly = col === 'sales' && Object.keys(req.body || {}).every((k) => DELIVERY_FIELDS.includes(k))
  if (!deliveryOnly && !allowed(req, 'edit', col, current)) return denied(res, 'edit')
  const rec = store.update(col, req.params.id, sanitize(col, { ...req.body, id: req.params.id }))
  if (!rec) return res.status(404).json({ error: 'Not found' })
  res.json(clean(col, rec))
})

app.delete('/api/:col/:id', requireAuth, checkCollection, guardAdmin, (req, res) => {
  const col = req.params.col
  if (DOCUMENTS[col]) return res.status(400).json({ error: 'Use /api/documents to delete invoices' })
  if (col === 'users' && req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' })
  const current = store.get(col, req.params.id)
  if (current && !allowed(req, 'delete', col, current)) return denied(res, 'delete')
  if (!store.remove(col, req.params.id)) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

// Errors (bad JSON, validation) -> JSON response
app.use((err, req, res, _next) => {
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message })
  console.error(err)
  res.status(500).json({ error: 'Server error' })
})

// ---------- serve the built frontend in production ----------
const dist = join(here, '..', 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(join(dist, 'index.html')))
}

app.listen(PORT, () => console.log(`POS API running on http://localhost:${PORT}`))
