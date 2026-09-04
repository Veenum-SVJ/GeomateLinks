import { VercelRequest, VercelResponse } from '@vercel/node'
import fs from 'fs'
import path from 'path'

const MEDIA_DIR = path.join(process.cwd(), '..', 'public', 'media')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    if (!fs.existsSync(MEDIA_DIR)) {
      res.status(200).json([])
      return
    }

    const files = fs.readdirSync(MEDIA_DIR).map((name) => ({
      name,
      url: `/media/${name}`,
      size: fs.statSync(path.join(MEDIA_DIR, name)).size,
    }))

    res.status(200).json(files)
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
