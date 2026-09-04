import { VercelRequest, VercelResponse } from '@vercel/node'
import { readJson, writeJson } from '../lib/data'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const messages = readJson('messages.json')
    res.status(200).json(messages)
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
