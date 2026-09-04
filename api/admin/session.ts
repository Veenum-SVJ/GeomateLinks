import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clearSessionCookie, isAuthenticated } from '../_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ authenticated: isAuthenticated(req) })
  }

  if (req.method === 'DELETE' || req.method === 'POST') {
    clearSessionCookie(res)
    return res.status(200).json({ ok: true, authenticated: false })
  }

  res.setHeader('Allow', 'GET, POST, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
