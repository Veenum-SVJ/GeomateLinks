import { VercelRequest, VercelResponse } from '@vercel/node'
import { readJson, writeJson } from '../lib/data'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const services = readJson('services.json')
    res.status(200).json(services)
    return
  }

  if (req.method === 'PUT') {
    const body = await new Promise<any>((resolve) => {
      let data = ''
      req.on('data', (chunk: Buffer) => (data += chunk))
      req.on('end', () => resolve(JSON.parse(data || '[]')))
    })

    writeJson('services.json', body)
    res.status(200).json({ success: true, services: body })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
