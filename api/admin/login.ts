import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createToken, passwordMatches, rateLimited, resetRateLimit, setSessionCookie } from './_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Admin password is not configured on the server' })
  }

  if (rateLimited(req)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' })
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {}

  if (!passwordMatches(body?.password)) {
    return res.status(401).json({ error: 'Incorrect password' })
  }

  resetRateLimit(req)
  setSessionCookie(res, createToken())
  return res.status(200).json({ ok: true })
}

function safeParse(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}
