// Shared Supabase (Postgres)-backed store for site content, contact messages
// and the dashboard activity log.
// All admin mutations and the public homepage read go through here so the
// site always shows what the admin last published. Media binaries stay on
// Vercel Blob; their listing/deletes go through the Postgres mirror in
// api/_lib/db.js (listMediaMirrored / deleteMediaMirrored).
//
// Concurrency note (why this is an upgrade over the old Blob store): Postgres
// row writes are atomic with read-after-write consistency — a new enquiry
// landing while an admin marks another read can no longer lose a write, and
// no propagation-lag workarounds are needed.
import { listRecords, getRecord, putRecord, deleteRecord, listMediaMirrored, deleteMediaMirrored, hasDb } from './db.js'

const CONTENT_ID = 'published'
const MAX_MESSAGES = 500
const MAX_ACTIVITY = 30

const TABLE = {
  content: 'site_content',
  activity: 'site_activity',
  messages: 'contact_messages',
}

// ---- Content ----------------------------------------------------------

export async function readContent(fallback) {
  if (!hasDb()) return fallback
  try {
    const doc = await getRecord(TABLE.content, CONTENT_ID)
    return doc && typeof doc === 'object' ? doc : fallback
  } catch {
    // A database hiccup should never take the homepage down — serve the
    // bundled fallback content instead (same graceful behaviour as before).
    return fallback
  }
}

export async function writeContent(content) {
  await putRecord(TABLE.content, CONTENT_ID, content)
  return JSON.stringify(content, null, 2)
}

// ---- Activity log -----------------------------------------------------
// Best-effort feed of publishes for the dashboard. Pruned to MAX_ACTIVITY.
// Logging never blocks or fails a publish.

export async function readActivity() {
  if (!hasDb()) return []
  try {
    const entries = await listRecords(TABLE.activity)
    return entries.slice(0, MAX_ACTIVITY)
  } catch {
    return []
  }
}

export async function logActivity(entry) {
  try {
    await putRecord(TABLE.activity, entry.id, entry)
    // Opportunistic pruning beyond the cap — failures are fine.
    try {
      const entries = await listRecords(TABLE.activity)
      const excess = entries.slice(MAX_ACTIVITY)
      await Promise.all(excess.map((e) => deleteRecord(TABLE.activity, e.id).catch(() => {})))
    } catch { /* best-effort */ }
  } catch {
    // Activity logging is best-effort by design — never fail the publish.
  }
}

// ---- Media ------------------------------------------------------------

export async function listMedia() {
  if (!hasDb()) return []
  try {
    return await listMediaMirrored()
  } catch {
    return []
  }
}

export async function deleteMediaByUrl(url) {
  if (!hasDb()) throw new Error('Database storage is not configured')
  await deleteMediaMirrored(url)
}

// ---- Messages ---------------------------------------------------------
// Each enquiry is its own row, so a new submission is a pure insert:
// concurrent enquiries — or an enquiry landing while an admin marks another
// read — can never overwrite each other. The pre-write-read response pattern
// for updates/deletes is kept (same API contract as the Blob era).

export async function readMessages() {
  if (!hasDb()) return []
  try {
    return await listRecords(TABLE.messages)
  } catch {
    return []
  }
}

export async function appendMessage(entry) {
  await putRecord(TABLE.messages, entry.id, entry)
  // Opportunistic pruning beyond the cap — failures are fine and never
  // affect the submission itself.
  try {
    const messages = await listRecords(TABLE.messages)
    const excess = messages.slice(MAX_MESSAGES)
    await Promise.all(excess.map((m) => deleteRecord(TABLE.messages, m.id).catch(() => {})))
  } catch { /* best-effort */ }
  return entry
}

// Applies the patch and returns the updated list built from the PRE-WRITE
// read with the patch applied in memory — the exact response shape the Blob
// era returned, so no caller changes.
export async function updateMessage(id, patch) {
  const messages = await readMessages()
  const target = messages.find((m) => m.id === id)
  if (!target) return { applied: false, messages }
  const next = { ...target, ...patch }
  if (JSON.stringify(next) !== JSON.stringify(target)) {
    await putRecord(TABLE.messages, id, next)
  }
  return { applied: true, entry: next, messages: messages.map((m) => (m.id === id ? next : m)) }
}

// Removes the row. Returns the post-delete list built from the pre-write
// read (same no-read-after-write rule as updateMessage).
export async function deleteMessageById(id) {
  const messages = await readMessages()
  const target = messages.find((m) => m.id === id)
  if (!target) return { deleted: false, messages }
  await deleteRecord(TABLE.messages, id)
  return { deleted: true, messages: messages.filter((m) => m.id !== id) }
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
