import { VercelRequest, VercelResponse } from '@vercel/node'
import fs from 'fs'
import path from 'path'

const MEDIA_DIR = path.join(process.cwd(), '..', 'public', 'media')

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', resolve)
      req.on('error', reject)
    })

    const contentType = req.headers['content-type'] || ''
    let file: { filename?: string; data?: Buffer } = {}

    if (contentType.includes('multipart/form-data')) {
      const boundary = contentType.split('boundary=')[1]
      const buffer = Buffer.concat(chunks)
      const boundaryBuffer = Buffer.from(`--${boundary}`)
      const parts = buffer.split(boundaryBuffer)

      for (const part of parts) {
        const trimmed = part.toString().trim()
        if (!trimmed || trimmed === '--') continue

        const headerEnd = trimmed.indexOf('\r\n\r\n')
        if (headerEnd === -1) continue

        const headers = trimmed.slice(0, headerEnd)
        const fileData = trimmed.slice(headerEnd + 4)

        if (headers.includes('Content-Disposition') && headers.includes('filename=')) {
          const filenameMatch = headers.match(/filename="([^"]+)"/)
          file = {
            filename: filenameMatch?.[1] || `upload-${Date.now()}`,
            data: Buffer.from(fileData),
          }
        }
      }
    }

    if (!file.filename || !file.data) {
      res.status(400).json({ success: false, error: 'No file provided' })
      return
    }

    if (!fs.existsSync(MEDIA_DIR)) {
      fs.mkdirSync(MEDIA_DIR, { recursive: true })
    }

    const safeName = `${Date.now()}-${file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const fullPath = path.join(MEDIA_DIR, safeName)
    fs.writeFileSync(fullPath, file.data)

    res.status(200).json({
      success: true,
      filename: safeName,
      url: `/media/${safeName}`,
      size: file.data.length,
    })
  } catch (error) {
    console.error('Media upload error:', error)
    res.status(500).json({ success: false, error: 'Upload failed' })
  }
}
