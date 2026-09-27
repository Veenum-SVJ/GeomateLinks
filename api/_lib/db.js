// Shared Supabase (Postgres) data layer — one client for every api/_lib
// store module. Replaces Vercel Blob as the system of record for content,
// messages, CRM, quotations and projects. Media binary files stay on Blob;
// their listing is mirrored into the media_files table so reads and deletes
// go through Postgres (see mirrorMediaFromBlob below).
//
// Concurrency model (why this is a strict upgrade over Blob):
//   • Blob was last-write-wins with read-after-write lag, so every store
//     module worked around it with pre-write reads and per-entry objects.
//   • Postgres gives real transactions and row-level writes — concurrent
//     enquiry + admin edit can no longer lose a write, and read-after-write
//     is always consistent.
//   • The record shape is deliberately unchanged: each row keeps its full
//     JSON payload in a jsonb `data` column, so every store function keeps
//     its exact export signature. The two legacy halves of a lead (core +
//     pipeline facet) are now two plain tables.
import { createClient } from '@supabase/supabase-js'

let client = null
function supabase() {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    const error = new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured')
    error.status = 500
    throw error
  }
  // The functions are the only clients; service_role bypasses RLS (all
  // tables ship with RLS enabled and zero policies).
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'geomate-links-api' } },
  })
  return client
}

// Feature flag: when Supabase env vars are absent the API functions fall
// back to the bundled JSON defaults (same graceful behaviour as the old
// missing-BLOB_READ_WRITE_TOKEN path), so a misconfigured deploy serves the
// site instead of 500ing.
export function hasDb() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function mapDbError(error) {
  const err = new Error(error?.message || 'Database request failed')
  err.status = error?.code === '23505' ? 409 : 500
  return err
}

// --------------------------------------------------------------- primitives

export async function listRecords(table, { orderDesc = true } = {}) {
  try {
    let query = supabase().from(table).select('data')
    if (orderDesc) query = query.order('created_at', { ascending: false })
    const { data, error } = await query
    if (error) throw error
    return (data || []).map((row) => row.data)
  } catch (error) {
    if (error.status) throw error
    throw mapDbError(error)
  }
}

export async function getRecord(table, id) {
  try {
    const { data, error } = await supabase().from(table).select('data').eq('id', id).maybeSingle()
    if (error) throw error
    return data?.data || null
  } catch (error) {
    if (error.status) throw error
    throw mapDbError(error)
  }
}

export async function putRecord(table, id, record) {
  try {
    const { error } = await supabase()
      .from(table)
      .upsert({ id, data: record, created_at: record?.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString() })
    if (error) throw error
  } catch (error) {
    if (error.status) throw error
    throw mapDbError(error)
  }
}

export async function deleteRecord(table, id) {
  try {
    const { error } = await supabase().from(table).delete().eq('id', id)
    if (error) throw error
  } catch (error) {
    if (error.status) throw error
    throw mapDbError(error)
  }
}

export async function findByField(table, field, value) {
  try {
    // Documents live in the jsonb `data` column — query the path, not a
    // physical column (e.g. findByField('crm_leads', 'code', 'GML-2026-0001')).
    const { data, error } = await supabase().from(table).select('data').eq(`data->>${field}`, value).maybeSingle()
    if (error) throw error
    return data?.data || null
  } catch (error) {
    if (error.status) throw error
    throw mapDbError(error)
  }
}

// --------------------------------------------------- sequential code counter

// Replaces the old shared counter blob with one atomic round-trip. Same
// hardening as before: the caller verifies against stored records and retries
// past any stale-counter collision; this never blocks record creation.
export async function nextCounter(kind) {
  try {
    // bump_counter is a plain SQL function returning a scalar bigint.
    const { data, error } = await supabase().rpc('bump_counter', { p_kind: kind })
    if (error || data === null || data === undefined) throw error || new Error('bump_counter returned no value')
    return Number(data) || 1
  } catch (error) {
    if (error.status) throw error
    // Never block record creation on counter problems — same escape hatch
    // as the old blob counter's final fallback.
    return null
  }
}

// ------------------------------------------------------------- media mirror

// Lists media from Postgres. The mirror is refreshed opportunistically from
// Blob so brand-new uploads appear without waiting for the upload endpoint
// to sync them. Blob failure degrades to the last mirrored state.
export async function listMediaMirrored() {
  const { list } = await import('@vercel/blob')
  let blobs = []
  let blobOk = false
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const result = await list({ prefix: 'media/', limit: 1000 })
      blobs = result.blobs || []
      blobOk = true
    } catch {
      // fall through to mirror
    }
  }

  if (blobOk) {
    const mirrored = blobs.map((blob) => ({
      pathname: blob.pathname,
      url: blob.url,
      size: Number(blob.size) || 0,
      uploaded_at: typeof blob.uploadedAt === 'string' ? blob.uploadedAt : new Date(blob.uploadedAt).toISOString(),
    }))
    // Best-effort mirror refresh (upsert = idempotent).
    if (mirrored.length > 0) {
      try {
        await supabase().from('media_files').upsert(mirrored)
      } catch {
        // mirror refresh is best-effort
      }
    }
    return mirrored
      .map((m) => ({ pathname: m.pathname, url: m.url, size: m.size, uploadedAt: m.uploaded_at }))
      .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))
  }

  // Blob unavailable: serve the last mirrored state.
  try {
    const { data, error } = await supabase()
      .from('media_files')
      .select('pathname,url,size,uploaded_at')
      .order('uploaded_at', { ascending: false })
      .limit(1000)
    if (error) throw error
    return (data || []).map((m) => ({ pathname: m.pathname, url: m.url, size: Number(m.size) || 0, uploadedAt: m.uploaded_at }))
  } catch {
    return []
  }
}

// Deletes a media file: removes the Blob object and mirrors the removal.
// Called by the admin media endpoint instead of Blob's del() directly.
export async function deleteMediaMirrored(url) {
  const { del } = await import('@vercel/blob')
  await del(url)
  try {
    await supabase().from('media_files').delete().eq('url', url)
  } catch {
    // mirror cleanup is best-effort
  }
}
