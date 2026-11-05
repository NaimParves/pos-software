import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { seed } from '../src/store/seed.js'
import { hashPassword } from './auth.js'

const here = dirname(fileURLToPath(import.meta.url))
// Kept outside server/ so the dev file-watcher does not restart on every write
export const DATA_DIR = process.env.DATA_DIR || join(here, '..', 'data')
const DB_PATH = process.env.DB_PATH || join(DATA_DIR, 'pos.db')
mkdirSync(dirname(DB_PATH), { recursive: true })
mkdirSync(DATA_DIR, { recursive: true })

export const sql = new DatabaseSync(DB_PATH)
sql.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS docs (
    collection TEXT NOT NULL,
    id         TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (collection, id)
  );
  CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`)

// Every collection the app knows about (taken from the seed shape)
export const COLLECTIONS = Object.keys(seed())

// Document collections: number prefix and how saving moves stock
export const DOCUMENTS = {
  sales: { prefix: 'S', stock: -1 },
  purchases: { prefix: 'P', stock: 1 },
  salesReturns: { prefix: 'SR', stock: 1 },
  purchaseReturns: { prefix: 'PR', stock: -1 },
  purchaseOrders: { prefix: 'PO', stock: 0 },
  damages: { prefix: 'D', stock: -1 },
}

const newId = () => Date.now().toString(36) + randomBytes(4).toString('hex')

const q = {
  all: sql.prepare('SELECT data FROM docs WHERE collection = ? ORDER BY created_at, rowid'),
  get: sql.prepare('SELECT data FROM docs WHERE collection = ? AND id = ?'),
  insert: sql.prepare('INSERT INTO docs (collection, id, data) VALUES (?, ?, ?)'),
  update: sql.prepare('UPDATE docs SET data = ? WHERE collection = ? AND id = ?'),
  remove: sql.prepare('DELETE FROM docs WHERE collection = ? AND id = ?'),
  count: sql.prepare('SELECT COUNT(*) n FROM docs'),
  clear: sql.prepare('DELETE FROM docs'),
  clearCounters: sql.prepare('DELETE FROM counters'),
  counter: sql.prepare('SELECT value FROM counters WHERE name = ?'),
  setCounter: sql.prepare('INSERT INTO counters (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value'),
  meta: sql.prepare('SELECT value FROM meta WHERE key = ?'),
  setMeta: sql.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
}

export function tx(fn) {
  sql.exec('BEGIN IMMEDIATE')
  try {
    const out = fn()
    sql.exec('COMMIT')
    return out
  } catch (e) {
    sql.exec('ROLLBACK')
    throw e
  }
}

export const store = {
  all: (col) => q.all.all(col).map((r) => JSON.parse(r.data)),
  get: (col, id) => {
    const r = q.get.get(col, id)
    return r ? JSON.parse(r.data) : null
  },
  insert(col, row) {
    const rec = { ...row, id: newId(), createdAt: new Date().toISOString() }
    q.insert.run(col, rec.id, JSON.stringify(rec))
    return rec
  },
  update(col, id, patch) {
    const cur = store.get(col, id)
    if (!cur) return null
    const next = { ...cur, ...patch, id }
    q.update.run(JSON.stringify(next), col, id)
    return next
  },
  remove: (col, id) => q.remove.run(col, id).changes > 0,
  // Next number for a prefix, e.g. "S-0004". Counters never go backwards,
  // so a deleted invoice number is never reused.
  nextNumber(prefix) {
    const cur = q.counter.get(prefix)?.value ?? 0
    q.setCounter.run(prefix, cur + 1)
    return `${prefix}-${String(cur + 1).padStart(4, '0')}`
  },
  meta: (k) => q.meta.get(k)?.value,
  setMeta: (k, v) => q.setMeta.run(k, v),
}

// Load the sample data (or wipe and reload it on reset)
export function loadSeed({ wipe = false, adminPassword }) {
  tx(() => {
    if (wipe) { q.clear.run(); q.clearCounters.run() }
    const data = seed()
    for (const [col, rows] of Object.entries(data)) {
      for (const row of rows) {
        let rec = { ...row, createdAt: new Date().toISOString() }
        if (col === 'users') rec.passwordHash = hashPassword(adminPassword)
        q.insert.run(col, rec.id, JSON.stringify(rec))
      }
    }
    // Start counters after the numbers already used by the sample data
    for (const [col, { prefix }] of Object.entries(DOCUMENTS)) q.setCounter.run(prefix, data[col].length)
    q.setCounter.run('EXP', data.expenses.length)
  })
}

export function ensureSeeded(adminPassword) {
  if (q.count.get().n === 0) {
    loadSeed({ adminPassword })
    return true
  }
  return false
}
