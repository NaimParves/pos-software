import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import jwt from 'jsonwebtoken'

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(String(password), salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  const a = Buffer.from(hash, 'hex')
  const b = scryptSync(String(password), salt, 64)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const ADMIN_ROLES = ['Super Admin', 'Admin']

export function makeAuth(secret) {
  const sign = (user) => jwt.sign({ sub: user.id, role: user.role }, secret, { expiresIn: '12h' })

  // Express middleware: requires "Authorization: Bearer <token>"
  const required = (getUser) => (req, res, next) => {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Not signed in' })
    try {
      const payload = jwt.verify(token, secret)
      const user = getUser(payload.sub)
      if (!user || user.status === 'Inactive') return res.status(401).json({ error: 'Account not active' })
      req.user = user
      next()
    } catch {
      res.status(401).json({ error: 'Session expired, please sign in again' })
    }
  }

  const adminOnly = (req, res, next) =>
    ADMIN_ROLES.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Only an admin can do this' })

  return { sign, required, adminOnly }
}
