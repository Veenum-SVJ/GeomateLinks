// Shared Vercel Blob-backed store for site content, contact messages and the
// dashboard activity log.
// All admin mutations and the public homepage read go through here so the
// site always shows what the admin last published.
import { put, head, list, del } from '@vercel/blob'

const CONTENT_BLOB = 'site-content.json'
const MESSAGES_PREFIX = 'messages/'
const LEGACY_MESSAGES_BLOB = 'contact-messages.json'
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
// Each enquiry is its own Blob object (messages/<stamp>-<id>.json), so a new
// submission is a pure append: concurrent enquiries — or an enquiry landing
// while an admin marks another read — can never overwrite each other, which
// the old single-document inbox could (Blob is last-write-wins with
// read-after-write lag). The legacy single document is migrated on first read.

function messagePathname(entry) {
  const ts = Date.parse(entry.createdAt)
  // Fixed-width base36 ms timestamp → lexical order equals newest first.
  const stamp = (Number.isFinite(ts) ? ts : Date.now()).toString(36).padStart(11, '0')
  return `${MESSAGES_PREFIX}${stamp}-${entry.id}.json`
}

async function listMessageBlobs() {
  const blobs = []
  let cursor
  do {
    const result = await list({ prefix: MESSAGES_PREFIX, limit: 1000, cursor })
    blobs.push(...(result.blobs || []))
    cursor = result.cursor && blobs.length < 5000 ? result.cursor : undefined
  } while (cursor)
  return blobs
}

async function readLegacyMessages() {
  try {
    const meta = await head(LEGACY_MESSAGES_BLOB)
    const res = await fetch(meta.url, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await safeParse(await res.text(), [])
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function readMessages() {
  if (!hasStorage()) return []
  try {
    const blobs = await listMessageBlobs()
    // One-time migration from the legacy single-document inbox: merge any
    // legacy messages that are not already stored per-entry (dedupe by id,
    // idempotent writes), then delete the legacy blob. If a new enquiry
    // lands before the first read, blobs exist but the merge still runs —
    // so nothing is ever left invisible. A failed delete simply re-runs the
    // (harmless) merge on the next read.
    const blobIds = new Set(blobs.map((b) => b.pathname))
    const legacy = await readLegacyMessages()
    const missing = legacy.filter((m) => !blobIds.has(messagePathname(m)))
    if (missing.length) {
      for (let i = 0; i < missing.length; i += 25) {
        await Promise.all(
          missing.slice(i, i + 25).map((m) =>
            put(messagePathname(m), JSON.stringify(m), {
              access: 'public',
              contentType: 'application/json',
              addRandomSuffix: false,
              cacheControlMaxAge: 0,
            }).catch(() => {}),
          ),
        )
      }
      try {
        const meta = await head(LEGACY_MESSAGES_BLOB)
        await del(meta.url)
      } catch { /* best-effort */ }
    }

    const entries = await Promise.all(
      blobs.map(async (blob) => {
        try {
          const res = await fetch(blob.url, { cache: 'no-store' })
          if (!res.ok) return null
          const data = await safeParse(await res.text(), null)
          return data && typeof data === 'object' && data.id ? data : null
        } catch {
          return null
        }
      }),
    )
    const migrated = missing.filter(Boolean)
    return [...entries.filter(Boolean), ...migrated]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  } catch {
    return []
  }
}

export async function appendMessage(entry) {
  await put(messagePathname(entry), JSON.stringify(entry, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  })
  // Opportunistic pruning beyond the cap — failures are fine and never
  // affect the submission itself.
  try {
    const blobs = await listMessageBlobs()
    const sorted = blobs.sort((a, b) => b.pathname.localeCompare(a.pathname))
    await Promise.all(sorted.slice(MAX_MESSAGES).map((b) => del(b.url).catch(() => {})))
  } catch { /* best-effort */ }
  return entry
}

// Finds the entry, applies the patch and rewrites it in place (same
// pathname, since id and createdAt are immutable). Returns the updated
// entry, or null when the id is unknown.
export async function updateMessage(id, patch) {
  const messages = await readMessages()
  const target = messages.find((m) => m.id === id)
  if (!target) return null
  const next = { ...target, ...patch }
  if (JSON.stringify(next) === JSON.stringify(target)) return next
  await put(messagePathname(next), JSON.stringify(next, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  })
  return next
}

// Returns true when the message existed and was removed.
export async function deleteMessageById(id) {
  const messages = await readMessages()
  const target = messages.find((m) => m.id === id)
  if (!target) return false
  const pathname = messagePathname(target)
  const blobs = await listMessageBlobs()
  const blob = blobs.find((b) => b.pathname === pathname)
  if (!blob) return false
  await del(blob.url)
  return true
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
