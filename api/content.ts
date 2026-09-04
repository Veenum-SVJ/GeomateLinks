import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAuthenticated } from './_lib/auth'
import { getContent, saveContent } from './_lib/cms'
import defaultContent from './_data/content.json'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const stored = await getContent()
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json(stored ?? defaultContent)
    } catch (error) {
      console.error('content GET failed', error)
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json(defaultContent)
    }
  }

  if (req.method === 'PUT') {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid content payload' })
    }

    try {
      const url = await saveContent(body)
      return res.status(200).json({ ok: true, url })
    } catch (error) {
      console.error('content PUT failed', error)
      return res.status(500).json({ error: 'Failed to save content' })
    }
  }

  res.setHeader('Allow', 'GET, PUT')
  return res.status(405).json({ error: 'Method not allowed' })
}

function safeParse(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
