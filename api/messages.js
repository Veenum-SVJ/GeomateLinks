// Public + admin contact messages endpoint (ES Module).
// POST  → receive a new enquiry from the homepage contact form (public).
// GET   → list messages (admin).
// PATCH → mark one message read   ?id=...
// DELETE→ remove one message      ?id=...
import {
  readMessages,
  appendMessage,
  updateMessage,
  deleteMessageById,
  normaliseMessage,
  isValidMessage,
} from './_lib/store.js'

// Password protection is switched off while the site is under construction.
function authDisabled() {
  return process.env.ADMIN_AUTH_DISABLED === '1'
}

function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.status(status).json(data)
}

export default async function handler(req, res) {
  const method = req.method || 'GET'
  const url = new URL(req.url || '/', `http://${req.headers.host}`)

  if (method === 'POST') {
    const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
    const entry = normaliseMessage(body)
    if (!isValidMessage(entry)) {
      return json(res, 400, { error: 'Name, email and message are required' })
    }
    try {
      await appendMessage(entry)
      return json(res, 201, { ok: true })
    } catch (err) {
      console.error('[api/messages] append failed', err)
      return json(res, 500, { error: 'Could not store the message' })
    }
  }

  if (method === 'GET' || method === 'PATCH' || method === 'DELETE') {
    if (!authDisabled()) {
      const { default: adminHandler } = await import('./admin/index.js')
      return adminHandler(req, res)
    }

    if (method === 'GET') {
      const messages = await readMessages()
      return json(res, 200, { messages })
    }

    const id = url.searchParams.get('id')
    if (!id) return json(res, 400, { error: 'Missing id' })
    try {
      // Per-entry updates touch only the target blob, so an enquiry landing
      // at the same moment is untouched. The refreshed list keeps the
      // client-side badge/list sync contract.
      const updated =
        method === 'PATCH' ? await updateMessage(id, { read: true }) : null
      const deleted = method === 'DELETE' ? await deleteMessageById(id) : false
      if (!updated && !deleted) {
        return json(res, 404, { error: 'Message not found' })
      }
      const messages = await readMessages()
      return json(res, 200, { ok: true, messages })
    } catch (err) {
      console.error('[api/messages] update failed', err)
      return json(res, 500, { error: 'Could not update messages' })
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
