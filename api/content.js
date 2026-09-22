// Public + admin site content endpoint (ES Module).
// GET        → published content for the homepage (falls back to the bundled
//              content.json until an admin saves for the first time).
// PUT / POST → replace the published content (used by the admin editors).
import { createRequire } from 'module'
import { readContent, writeContent } from './_lib/store.js'

// Node ESM cannot import JSON statically; use CJS require instead.
const require = createRequire(import.meta.url)
const fallbackModule = require('./_data/content.json')
const fallbackContent = fallbackModule.default || fallbackModule

// Password protection is switched off while the site is under construction.
// When ADMIN_AUTH_DISABLED is removed/0, writes require a valid admin session.
function authDisabled() {
  return process.env.ADMIN_AUTH_DISABLED === '1'
}

function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.status(status).json(data)
}

export default async function handler(req, res) {
  const method = req.method || 'GET'

  if (method === 'GET') {
    const content = await readContent(fallbackContent)
    return json(res, 200, content)
  }

  if (method === 'PUT' || method === 'POST') {
    if (!authDisabled()) {
      // Defer to the shared admin session check.
      const { default: adminHandler } = await import('./admin/index.js')
      return adminHandler(req, res)
    }
    const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
    if (!body || typeof body !== 'object' || !body.company || !body.hero) {
      return json(res, 400, { error: 'Invalid content payload' })
    }
    try {
      await writeContent(body)
      return json(res, 200, { ok: true })
    } catch (err) {
      console.error('[api/content] write failed', err)
      return json(res, 500, { error: 'Failed to save content' })
    }
  }

  return json(res, 405, { error: 'Method not allowed' })
}

function safeJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
