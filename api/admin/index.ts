import { VercelRequest, VercelResponse } from '@vercel/node'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), '..', 'data')
const MEDIA_DIR = path.join(process.cwd(), '..', 'public', 'media')
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

function readJson(file: string) {
  const full = path.join(DATA_DIR, file)
  if (!fs.existsSync(full)) return {}
  return JSON.parse(fs.readFileSync(full, 'utf-8'))
}

function writeJson(file: string, data: unknown) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2))
}

function setSession(res: VercelResponse, value: boolean) {
  res.setHeader('Set-Cookie', `admin_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`)
}

function getAuth(req: VercelRequest) {
  const cookie = req.headers.cookie || ''
  return cookie.includes('admin_session=true')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req

  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    res.status(200).end()
    return
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const segments = url.pathname.replace(/\/admin\/api/, '').split('/').filter(Boolean)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  try {
    if (segments[0] === 'auth' && segments[1] === 'login' && method === 'POST') {
      const body = await new Promise<{ password?: string }>((resolve) => {
        let data = ''
        req.on('data', (chunk: Buffer) => (data += chunk))
        req.on('end', () => resolve(JSON.parse(data || '{}')))
      })

      if (body.password !== ADMIN_PASSWORD) {
        res.status(401).json({ success: false, error: 'Invalid password' })
        return
      }

      setSession(res, true)
      res.status(200).json({ success: true })
      return
    }

    if (segments[0] === 'auth' && segments[1] === 'logout' && method === 'POST') {
      setSession(res, false)
      res.status(200).json({ success: true })
      return
    }

    if (segments[0] === 'auth' && segments[1] === 'me' && method === 'GET') {
      res.status(200).json({ authenticated: getAuth(req) })
      return
    }

    if (!getAuth(req)) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }

    if (segments[0] === 'content' && segments[1] === 'pages') {
      if (method === 'GET') {
        const pages = readJson('pages.json')
        res.status(200).json(pages)
        return
      }

      if (method === 'PUT') {
        const body = await new Promise<{ id?: string; title?: string; content?: string }>((resolve) => {
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
    }

    if (segments[0] === 'content' && segments[1] === 'services') {
      if (method === 'GET') {
        const services = readJson('services.json')
        res.status(200).json(services)
        return
      }

      if (method === 'PUT') {
        const body = await new Promise<any>((resolve) => {
          let data = ''
          req.on('data', (chunk: Buffer) => (data += chunk))
          req.on('end', () => resolve(JSON.parse(data || '[]')))
        })

        writeJson('services.json', body)
        res.status(200).json({ success: true, services: body })
        return
      }
    }

    if (segments[0] === 'content' && segments[1] === 'projects') {
      if (method === 'GET') {
        const projects = readJson('projects.json')
        res.status(200).json(projects)
        return
      }

      if (method === 'PUT') {
        const body = await new Promise<any>((resolve) => {
          let data = ''
          req.on('data', (chunk: Buffer) => (data += chunk))
          req.on('end', () => resolve(JSON.parse(data || '[]')))
        })

        writeJson('projects.json', body)
        res.status(200).json({ success: true, projects: body })
        return
      }
    }

    if (segments[0] === 'media' && segments[1] === 'list' && method === 'GET') {
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

    if (segments[0] === 'media' && segments[1] === 'upload' && method === 'POST') {
      const form = await new Promise<any>((resolve) => {
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => resolve(Buffer.concat(chunks).toString()))
      })()

      res.status(501).json({ success: false, error: 'Use multipart upload endpoint' })
      return
    }

    if (segments[0] === 'settings') {
      if (method === 'GET') {
        const settings = readJson('settings.json')
        res.status(200).json(settings)
        return
      }

      if (method === 'PUT') {
        const body = await new Promise<any>((resolve) => {
          let data = ''
          req.on('data', (chunk: Buffer) => (data += chunk))
          req.on('end', () => resolve(JSON.parse(data || '{}')))
        })

        writeJson('settings.json', body)
        res.status(200).json({ success: true, settings: body })
        return
      }
    }

    res.status(404).json({ success: false, error: 'Not found' })
  } catch (error) {
    console.error('Admin API error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
}
