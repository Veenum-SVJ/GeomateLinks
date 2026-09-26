// Shared admin authentication helpers (ES Module).
// Extracted from api/admin/index.js so every admin-area API module (admin,
// CRM) verifies the exact same HMAC-signed session cookie — one source of
// truth, no drift between modules.
import crypto from 'crypto'

export const COOKIE_NAME = 'gl_admin'
export const SESSION_HOURS = 8

// Password protection is switched off while the site is under construction;
// remove ADMIN_AUTH_DISABLED (or set it to 0) at launch to restore the gate.
export function authDisabled() {
  return process.env.ADMIN_AUTH_DISABLED === '1'
}

export function secret() {
  const value = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD
  if (!value) throw new Error('SESSION_SECRET or ADMIN_PASSWORD missing')
  return value
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createToken() {
  const exp = Date.now() + SESSION_HOURS * 60 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ exp }), 'utf8').toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  const expected = sign(payload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return typeof exp === 'number' && exp > Date.now()
  } catch {
    return false
  }
}

export function readCookie(req) {
  const raw = req.headers.cookie
  if (!raw) return undefined
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === COOKIE_NAME) return rest.join('=')
  }
  return undefined
}

export function isAuthenticated(req) {
  return verifyToken(readCookie(req) || '')
}

export function setSessionCookie(res, token) {
  const maxAge = SESSION_HOURS * 60 * 60
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`)
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`)
}

export function passwordMatches(candidate) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected || typeof candidate !== 'string' || candidate.length === 0) return false
  const a = crypto.createHash('sha256').update(candidate).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

// Simple in-memory login rate limiting (10 attempts / 15 min per IP).
const attempts = new Map()

export function isRateLimited(ip) {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now - entry.first > 15 * 60 * 1000) {
    attempts.set(ip, { count: 1, first: now })
    return false
  }
  entry.count++
  return entry.count > 10
}
