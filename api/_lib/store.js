// Shared Vercel Blob-backed store for site content, contact messages and the
// dashboard activity log.
// All admin mutations and the public homepage read go through here so the
// site always shows what the admin last published.
import { put, head, list, del } from '@vercel/blob'

const CONTENT_BLOB = 'site-content.json'
const MESSAGES_BLOB = 'contact-messages.json'
const ACTIVITY_PREFIX = 'activity/'
const MAX_MESSAGES = 500
const MAX_ACTIVITY = 30

function hasStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

// ---- Content ----------------------------------------------------------

export async function readContent(fallback) {
  if (!hasStorage()) return fallback
  try {
    const meta = await head(CONTENT_BLOB)
    const res = await fetch(meta.url, { cache: 'no-store' })
    if (!res.ok) return fallback
    const data = await safeParse(await res.text(), null)
    return data && typeof data === 'object' ? data : fallback
  } catch {
    // head() throws when the blob does not exist yet — that is a normal
    // first-run state, not an error.
    return fallback
  }
}

export async function writeContent(content) {
  const body = JSON.stringify(content, null, 2)
  // Random suffix avoids any CDN caching races between successive saves.
  await put(CONTENT_BLOB, body, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  })
  return body
}

// ---- Activity log -----------------------------------------------------
// Best-effort feed of publishes for the dashboard. Each entry is its own Blob
// object (activity/<base36-timestamp>-<id>.json), so logging is a true append:
// rapid successive publishes can never overwrite each other, which a single
// log document would (Blob is last-write-wins with read-after-write lag).
// Logging never blocks or fails a publish.

export async function readActivity() {
  if (!hasStorage()) return []
  try {
    const result = await list({ prefix: ACTIVITY_PREFIX, limit: 100 })
    const blobs = (result.blobs || [])
      // pathname embeds a fixed-width base36 ms timestamp → lexical = newest first
      .sort((a, b) => b.pathname.localeCompare(a.pathname))
      .slice(0, MAX_ACTIVITY)
    const entries = await Promise.all(
      blobs.map(async (blob) => {
        try {
          const res = await fetch(blob.url, { cache: 'no-store' })
          if (!res.ok) return null
          return await safeParse(await res.text(), null)
        } catch {
          return null
        }
      }),
    )
    return entries.filter(Boolean).sort((a, b) => String(b.at).localeCompare(String(a.at)))
  } catch {
    return []
  }
}

export async function logActivity(entry) {
  try {
    await put(`${ACTIVITY_PREFIX}${Date.now().toString(36)}-${entry.id}.json`, JSON.stringify(entry), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      cacheControlMaxAge: 0,
    })
    // Opportunistic pruning of entries beyond the cap — failures are fine.
    const result = await list({ prefix: ACTIVITY_PREFIX, limit: 1000 })
    const blobs = (result.blobs || []).sort((a, b) => b.pathname.localeCompare(a.pathname))
    await Promise.all(blobs.slice(MAX_ACTIVITY).map((blob) => del(blob.url).catch(() => {})))
  } catch {
    // Activity logging is best-effort by design — never fail the publish.
  }
}

// ---- Media ------------------------------------------------------------

export async function listMedia() {
  if (!hasStorage()) return []
  try {
    const result = await list({ prefix: 'media/' })
    return (result.blobs || [])
      .map((blob) => ({
        pathname: blob.pathname,
        url: blob.url,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
      }))
      .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))
  } catch {
    return []
  }
}

export async function deleteMediaByUrl(url) {
  if (!hasStorage()) throw new Error('Blob storage is not configured')
  await del(url)
}

// ---- Messages ---------------------------------------------------------

export async function readMessages() {
  if (!hasStorage()) return []
  try {
    const meta = await head(MESSAGES_BLOB)
    const res = await fetch(meta.url, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await safeParse(await res.text(), [])
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function writeMessages(messages) {
  const body = JSON.stringify(messages, null, 2)
  await put(MESSAGES_BLOB, body, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  })
  return messages
}

export async function appendMessage(entry) {
  const messages = await readMessages()
  messages.unshift(entry)
  if (messages.length > MAX_MESSAGES) messages.length = MAX_MESSAGES
  await writeMessages(messages)
  return entry
}

export function normaliseMessage(payload) {
  const now = new Date().toISOString()
  const str = (value, max) =>
    String(value ?? '').trim().slice(0, max)
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: str(payload?.name, 120),
    email: str(payload?.email, 200),
    phone: str(payload?.phone, 40),
    subject: str(payload?.subject, 200),
    message: str(payload?.message, 5000),
    createdAt: now,
    read: false,
  }
}

export function isValidMessage(entry) {
  return Boolean(entry.name && entry.email && entry.message)
}
