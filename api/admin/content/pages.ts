import { VercelRequest, VercelResponse } from '@vercel/node'
import { readJson, writeJson } from '../lib/data'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const pages = readJson('pages.json')
    res.status(200).json(pages)
    return
  }

  if (req.method === 'PUT') {
    const body = await new Promise<any>((resolve) => {
      let data = ''
      req.on('data', (chunk: Buffer) => (data += chunk))
      req.on('end', () => resolve(JSON.parse(data || '{}')))
    })

    const pages = readJson('pages.json')
    pages[body.id || ''] = {
      ...(pages[body.id || ''] || {}),
      title: body.title ?? pages[body.id || '']?.title ?? '',
      content: body.content ?? pages[body.id || '']?.content ?? '',
    }
    writeJson('pages.json', pages)
    res.status(200).json({ success: true, page: pages[body.id || ''] })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
