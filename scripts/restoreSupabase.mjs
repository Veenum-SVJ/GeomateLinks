// Restore script — loads a backup folder (created by backupSupabase.mjs) back
// into Supabase. The counterpart to `npm run backup`.
//
//   node scripts/restoreSupabase.mjs backups/2026-09-27T01-22-33           # dry-run preview
//   node scripts/restoreSupabase.mjs backups/2026-09-27T01-22-33 --apply   # real restore
//
// Safety model:
//   • DRY-RUN BY DEFAULT: nothing is written unless --apply is passed.
//   • MERGE semantics: backup rows are upserted (on id/kind/pathname);
//     rows that exist now but are absent from the backup are LEFT ALONE
//     (listed in the output as untouched) — pass --replace to delete them.
//   • COLLISION WARNINGS: every backup row whose id already exists with
//     DIFFERENT content is reported per table before anything is written,
//     so an accidental wrong-folder restore is visible up front.
//   • Server-side counters (id_counters) are never lowered: a restore will
//     only bump a counter forward if stored codes could collide.
//   • media_files rows without a live Blob object are reported as orphans,
//     never deleted.
//
// Legacy note: folders exported before the Supabase migration
// (e.g. backups/2026-09-26 with content.json/leads.json/…) are Blob-era
// shapes and are REJECTED by the legacy-shape guard — restoring them needs
// a manual conversion pass.
import { loadEnv } from './lib/env.mjs'
import { createClient } from '@supabase/supabase-js'
import { readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

loadEnv()

// ------------------------------------------------------------- configuration

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Same table set as backupSupabase.mjs (kept in sync — see that file).
const TABLES = [
  'site_content',
  'site_activity',
  'contact_messages',
  'crm_leads',
  'crm_lead_pipeline',
  'crm_clients',
  'crm_activities',
  'crm_followups',
  'crm_quotations',
  'crm_quotation_history',
  'crm_projects',
  'crm_project_activities',
  'crm_staff',
  'documents',
  'document_versions',
  'document_folders',
  'document_categories',
  'document_activity',
  'equipment',
  'equipment_categories',
  'equipment_assignments',
  'equipment_reservations',
  'equipment_maintenance',
  'equipment_calibrations',
  'equipment_inspections',
  'equipment_history',
  'id_counters',
  'media_files',
]

// Which column carries the row identity (id_counters/media_files use their
// own PK; everything else keeps its id).
const PK = {
  id_counters: 'kind',
  media_files: 'pathname',
}

// Tables whose rows are NOT pure jsonb documents (special columns instead of
// a `data` jsonb payload). Everything else is { id, data, created_at }.
const SHAPE = {
  id_counters: (row) => ({ kind: String(row.kind || ''), next: Number(row.next || 0) }),
  media_files: (row) => ({ pathname: String(row.pathname || ''), url: String(row.url || ''), size: Number(row.size || 0), uploaded_at: String(row.uploaded_at || '') }),
  default: (row) => {
    const data = row.data ?? row
    const id = row.id ?? data.id
    const createdAt = row.created_at ?? data.createdAt
    const out = { id: String(id || ''), data, created_at: isoOrNull(createdAt) }
    // The DMS document tables (documents, document_versions, …) and the EMS
    // equipment_categories table carry a `code` column with a unique index —
    // restored rows must keep it.
    if (typeof row.code === 'string' || typeof row.code === 'number') out.code = String(row.code)
    return out
  },
}

function isoOrNull(value) {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

// ------------------------------------------------------------- helpers

function info(message) {
  console.log(message)
}
function warn(message) {
  console.error(`  ⚠ ${message}`)
}
function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = { folder: '', apply: false, replace: false }
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true
    else if (arg === '--replace') args.replace = true
    else if (!args.folder) args.folder = arg
    else fail(`Unexpected argument: ${arg}`)
  }
  if (!args.folder) fail('Usage: node scripts/restoreSupabase.mjs <backup-folder> [--apply] [--replace]')
  return args
}

async function loadBackup(dir) {
  if (!existsSync(dir) || !(await stat(dir)).isDirectory()) fail(`Not a directory: ${dir}`)
  if (!existsSync(path.join(dir, '_manifest.json'))) {
    fail(`No _manifest.json in ${dir} — not a backup folder (see scripts/backupSupabase.mjs).`)
  }
  const manifest = JSON.parse(await readFile(path.join(dir, '_manifest.json'), 'utf8'))
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json') && f !== '_manifest.json')
  const tables = {}
  for (const file of files) {
    const name = file.replace(/\.json$/, '')
    if (!TABLES.includes(name)) {
      warn(`skipping unknown file ${file} (not in the known table list)`)
      continue
    }
    const rows = JSON.parse(await readFile(path.join(dir, file), 'utf8'))
    if (!Array.isArray(rows)) fail(`${file} is not a JSON array — corrupt backup?`)
    tables[name] = rows
  }
  return { manifest, tables }
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

// ------------------------------------------------------------ main flow

const args = parseArgs(process.argv.slice(2))

if (!SUPABASE_URL || !SERVICE_KEY) {
  fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (env or .env.local).')
}

const { manifest, tables } = await loadBackup(args.folder)

// Legacy-shape guard: pre-Supabase exports used content.json/leads.json etc.
const legacyFiles = ['content.json', 'leads.json', 'messages.json', 'clients.json', 'activities.json']
const dirFiles = await readdir(args.folder)
if (legacyFiles.some((f) => dirFiles.includes(f))) {
  fail('This looks like a legacy (Blob-era) backup folder — its file shapes do not match the current Postgres tables. Converting it is a manual job.')
}

const apply = args.apply
if (!apply) {
  info('DRY RUN — nothing will be written. Pass --apply to perform the restore.')
}
if (args.replace) {
  warn('--replace is set: rows absent from the backup WILL BE DELETED. This is destructive.')
}

info(`Backup folder : ${args.folder}`)
info(`Backup stamp  : ${manifest.createdAt || 'unknown'}`)
info(`Backup project: ${manifest.project || 'unknown'}`)
const url = new URL(SUPABASE_URL.replace(/\/$/, ''))
info(`Target project: ${url.hostname.split('.')[0]}`)
if (manifest.project && manifest.project !== url.hostname.split('.')[0] && apply) {
  warn(`Backup was taken from project "${manifest.project}" but is being restored into "${url.hostname.split('.')[0]}" — cross-project restore.`)
}
info('')

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ------------------------------------------------------- counter safety pass

// Runs BEFORE the analysis pass so the adjusted counters are what the
// analysis compares and the write pass upserts. A restore must never lower a
// server-side counter below what the restored records can consume, or the
// next allocation hands out an in-use code.
const counterKinds = { leads: 'crm_leads', clients: 'crm_clients', projects: 'crm_projects', quotations: 'crm_quotations' }
if (tables.id_counters?.length) {
  info('Counter safety (id_counters):')
  for (const row of tables.id_counters) {
    const kind = String(row.kind || '')
    const table = counterKinds[kind]
    if (!table) continue
    const { data, error } = await supabase.from(table).select('data->>code').not('data->>code', 'eq', '')
    if (error) fail(`Cannot read codes from ${table}: ${error.message}`)
    const storedMax = Math.max(0, ...(data || []).map((r) => Number(String(r.code ?? '').match(/(\d{4})$/)?.[1] || 0)))
    const backupNext = Number(row.next || 0)
    const current = await supabase.from('id_counters').select('next').eq('kind', kind).maybeSingle()
    const currentNext = Number(current.data?.next || 0)
    const floor = storedMax + 1
    const target = Math.max(currentNext, backupNext, floor)
    if (target !== backupNext || target !== currentNext) {
      warn(`${kind}: backup next=${backupNext}, current next=${currentNext}, stored codes reach ${storedMax} — will restore as ${target} (never lowered)`)
    } else {
      info(`  ${kind}: next=${target} (matches)`)
    }
    row.next = target
  }
  info('')
}

// --------------------------------------------------- collision analysis pass

const plan = []
const pkOf = (table) => PK[table] || 'id'

info('Collision analysis (backup rows vs current rows):')
for (const table of TABLES) {
  const rows = tables[table] || []
  const pk = pkOf(table)
  const shape = SHAPE[table] || SHAPE.default
  const backupRows = rows.map(shape)

  const ids = backupRows.map((r) => r[pk]).filter(Boolean)
  let currentRows = []
  if (ids.length > 0) {
    // Chunked read of just the PKs we care about (url.in supports ≤ ~180 ids).
    const chunks = []
    for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100))
    for (const chunk of chunks) {
      const { data, error } = await supabase.from(table).select('*').in(pk, chunk)
      if (error) fail(`Cannot read ${table}: ${error.message}`)
      currentRows.push(...(data || []))
    }
  }

  const currentById = new Map(currentRows.map((r) => [r[pk], r]))
  const inserts = []
  const updates = []
  const collisions = []
  const unchanged = []
  for (const row of backupRows) {
    const key = row[pk]
    if (!key) {
      warn(`${table}: backup row without a ${pk} — skipped (${JSON.stringify(row).slice(0, 80)}…)`)
      continue
    }
    const current = currentById.get(key)
    if (!current) {
      inserts.push(row)
    } else if (sameJson(row, shape(current))) {
      unchanged.push(row)
    } else {
      collisions.push({ key, backup: row, current })
    }
  }

  const present = new Set(ids)
  const missingRows = currentRows.filter((r) => !present.has(r[pk]))

  plan.push({ table, pk, inserts, updates: collisions.map((c) => c.backup), collisions, unchanged, missingIds: missingRows.map((r) => r[pk]) })
  const flag = collisions.length > 0 ? '  ⚠ collisions' : ''
  info(`  ${table.padEnd(26)} ${String(inserts.length).padStart(4)} new · ${String(collisions.length).padStart(4)} collide · ${String(unchanged.length).padStart(4)} identical · ${String(missingRows.length).padStart(4)} current-not-in-backup${flag}`)
  for (const c of collisions) {
    warn(`${table} #${c.key} exists with different content — restore will OVERWRITE it`)
  }
}
info('')

// ------------------------------------------------------- media orphan check

// Blob binaries are not part of the backup — media_files rows whose object
// no longer exists would restore as dead links. Report only (never delete).
if (tables.media_files?.length && process.env.BLOB_READ_WRITE_TOKEN) {
  const { list } = await import('@vercel/blob')
  try {
    const result = await list({ prefix: 'media/', limit: 1000 })
    const live = new Set((result.blobs || []).map((b) => b.pathname))
    const orphans = tables.media_files.filter((m) => m.pathname && !live.has(m.pathname))
    if (orphans.length > 0) {
      warn(`media_files: ${orphans.length} backup row(s) have no live Blob object (dead links after restore) — e.g. ${orphans.slice(0, 3).map((m) => m.pathname).join(', ')}`)
    }
  } catch {
    warn('could not verify Blob objects for media_files (listing failed) — dead links possible')
  }
}

// ------------------------------------------------------------ write pass

if (!apply) {
  info('Dry run complete — no changes made. Re-run with --apply to perform the restore.')
  process.exit(0)
}

info('Applying:')
const CHUNK = 100
let written = 0
let failedTables = 0
for (const { table, pk, inserts, updates, unchanged } of plan) {
  const rows = [...inserts, ...updates] // merge: identical rows are skipped, missing rows are left alone
  if (rows.length === 0) {
    info(`  ${table.padEnd(26)} nothing to write (${unchanged.length} identical)`)
    continue
  }
  let ok = 0
  try {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const { error } = await supabase.from(table).upsert(chunk, { onConflict: pk })
      if (error) throw error
      ok += chunk.length
    }
  } catch (err) {
    failedTables++
    console.error(`  ✗ ${table}: ${err?.message || err} — ${rows.length - ok} row(s) not written`)
  }
  if (ok > 0) info(`  ✓ ${table.padEnd(26)} ${String(ok).padStart(4)} row(s) upserted`)
  written += ok
}

// --replace pass: delete rows that exist now but are absent from the backup.
// Never runs by default; every table announces what it removes.
if (args.replace) {
  info('Replace pass (deleting rows absent from the backup):')
  for (const { table, pk, missingIds } of plan) {
    if (missingIds.length === 0) continue
    let removed = 0
    try {
      for (let i = 0; i < missingIds.length; i += CHUNK) {
        const chunk = missingIds.slice(i, i + CHUNK)
        const { error, count } = await supabase.from(table).delete({ count: 'exact' }).in(pk, chunk)
        if (error) throw error
        removed += count ?? chunk.length
      }
    } catch (err) {
      failedTables++
      console.error(`  ✗ ${table}: ${err?.message || err}`)
    }
    if (removed > 0) info(`  ✓ ${table.padEnd(26)} ${String(removed).padStart(4)} row(s) deleted`)
  }
}

info('')
info(failedTables === 0
  ? `Restore complete: ${written} row(s) written, ${plan.reduce((s, p) => s + p.unchanged.length, 0)} identical, rows absent from the backup ${args.replace ? 'deleted' : 'left in place'}.`
  : `Restore finished with ${failedTables} table error(s) — fix and re-run (idempotent: upserts + unchanged-row skip).`)
process.exit(failedTables === 0 ? 0 : 1)
