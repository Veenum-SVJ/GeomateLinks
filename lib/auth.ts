import crypto from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const COOKIE_NAME = 'gl_admin'
const SESSION_HOURS = 8

function secret(): string {
  const value = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD
  if (!value) throw new Error('SESSION_SECRET (or ADMIN_PASSWORD) is not configured')
  return value
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createToken(): string {
  const exp = Date.now() + SESSION_HOURS * 60 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ exp }), 'utf8').toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifyToken(token: string | undefined): boolean {
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

export function readCookie(req: VercelRequest, name = COOKIE_NAME): string | undefined {
  const raw = req.headers.cookie
  if (!raw) return undefined
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return undefined
}

export function setSessionCookie(res: VercelResponse, token: string) {
  const maxAge = SESSION_HOURS * 60 * 60
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`)
}

export function clearSessionCookie(res: VercelResponse) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`)
}

export function isAuthenticated(req: VercelRequest): boolean {
  return verifyToken(readCookie(req))
}

export function passwordMatches(candidate: unknown): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected || typeof candidate !== 'string' || candidate.length === 0) return false
  const a = crypto.createHash('sha256').update(candidate).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

const attempts = new Map<string, { count: number; first: number }>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10

export function rateLimited(req: VercelRequest): boolean {
  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim()
  const now = Date.now()
  const entry = attempts.get(ip)

  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now })
    return false
  }

  entry.count += 1
  return entry.count > MAX_ATTEMPTS
}

export function resetRateLimit(req: VercelRequest) {
  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim()
  attempts.delete(ip)
}
