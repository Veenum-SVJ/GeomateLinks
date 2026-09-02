import { VercelRequest, VercelResponse } from '@vercel/node'
import formidable from 'formidable'
import path from 'path'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const form = formidable({
    uploadDir: path.join(process.cwd(), 'tmp', 'uploads'),
    keepExtensions: true,
    maxFileSize: 50 * 1024 * 1024, // 50MB
  })

  try {
    const [, files] = await form.parse(request)
    
    const file = files.file?.[0]
    if (!file) {
      return response.status(400).json({ success: false, error: 'No file provided' })
    }

    return response.status(200).json({
      success: true,
      filename: file.originalFilename,
      mimetype: file.mimetype,
      size: file.size,
      url: `/tmp/uploads/${file.newFilename}`,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return response.status(500).json({ 
      success: false, 
      error: 'Upload failed' 
    })
  }
}
