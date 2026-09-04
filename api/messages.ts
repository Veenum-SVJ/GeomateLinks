import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAuthenticated } from './_lib/auth'
import { getMessages, saveMessages, type StoredMessage } from './_lib/cms'

const MAX_LEN = 4000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid payload' })
    }

    const name = clean(body.name)
    const email = clean(body.email)
    const message = clean(body.message)

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email and message are required' })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' })
    }

    const entry: StoredMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      email,
      phone: clean(body.phone),
      subject: clean(body.subject) || 'Website enquiry',
      message,
      createdAt: new Date().toISOString(),
      read: false,
    }

    try {
      const messages = await getMessages()
      messages.unshift(entry)
      await saveMessages(messages.slice(0, 500))
      return res.status(201).json({ ok: true })
    } catch (error) {
      console.error('message save failed', error)
      return res.status(500).json({ error: 'Failed to save message' })
    }
  }

  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      const messages = await getMessages()
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ messages })
    } catch (error) {
      console.error('message list failed', error)
      return res.status(500).json({ error: 'Failed to load messages' })
    }
  }

  if (req.method === 'PATCH' || req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id : undefined
    if (!id) {
      return res.status(400).json({ error: 'Missing id query parameter' })
    }

    try {
      const messages = await getMessages()
      const next = req.method === 'DELETE'
        ? messages.filter((item) => item.id !== id)
        : messages.map((item) => (item.id === id ? { ...item, read: true } : item))

      await saveMessages(next)
      return res.status(200).json({ ok: true, messages: next })
    } catch (error) {
      console.error('message update failed', error)
      return res.status(500).json({ error: 'Failed to update messages' })
    }
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}

function clean(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, MAX_LEN)
}

function safeParse(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
