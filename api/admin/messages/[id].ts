import { VercelRequest, VercelResponse } from '@vercel/node'
import { readJson, writeJson } from '../lib/data'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const messages = readJson('messages.json')
  const id = req.query.id || req.url.split('/').pop()

  if (req.method === 'DELETE') {
    if (!id) {
      res.status(400).json({ error: 'Missing message id' })
      return
    }

    const filtered = messages.filter((m: any) => m.id !== id)
    writeJson('messages.json', filtered)
    res.status(200).json({ success: true })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
