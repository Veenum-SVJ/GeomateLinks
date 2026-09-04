import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAuthenticated } from './_lib/auth'
import { deleteMedia, listMedia } from './_lib/cms'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      const media = await listMedia()
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ media })
    } catch (error) {
      console.error('media list failed', error)
      return res.status(500).json({ error: 'Failed to list media' })
    }
  }

  if (req.method === 'DELETE') {
    const url = typeof req.query.url === 'string' ? req.query.url : undefined
    if (!url) {
      return res.status(400).json({ error: 'Missing url query parameter' })
    }

    try {
      await deleteMedia(url)
      return res.status(200).json({ ok: true })
    } catch (error) {
      console.error('media delete failed', error)
      return res.status(500).json({ error: 'Failed to delete media' })
    }
  }

  res.setHeader('Allow', 'GET, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
