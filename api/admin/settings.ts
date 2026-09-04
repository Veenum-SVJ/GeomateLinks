import { VercelRequest, VercelResponse } from '@vercel/node'
import { readJson, writeJson } from '../lib/data'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const settings = readJson('settings.json')
    res.status(200).json(settings)
    return
  }

  if (req.method === 'PUT') {
    const body = await new Promise<any>((resolve) => {
      let data = ''
      req.on('data', (chunk: Buffer) => (data += chunk))
      req.on('end', () => resolve(JSON.parse(data || '{}')))
    })

    writeJson('settings.json', body)
    res.status(200).json({ success: true, settings: body })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
