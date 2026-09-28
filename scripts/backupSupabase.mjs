// Postgres backup script — exports every Geomate Links data table to
// timestamped JSON files under backups/, keeping the weekly backup habit
// alive on the Supabase data layer.
//
//   node scripts/backupSupabase.mjs
//
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (env or .env.local),
// exports all rows of every data table to one pretty-printed JSON file per
// table, then writes a manifest and prunes old backup folders beyond the
// retention window (default: keep 8, override with BACKUP_KEEP).
import { loadEnv } from './lib/env.mjs'
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

loadEnv()

// ------------------------------------------------------------- configuration

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEEP = Math.max(1, Number(process.env.BACKUP_KEEP) || 8)

// Every data table with its natural order column. Document tables order by
// created_at (the row-insert mirror); the two config/state tables have their
// own shapes (id_counters: kind+next; media_files: uploaded_at).
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

const ORDER_COLUMN = {
  id_counters: 'kind',
  media_files: 'uploaded_at',
}

// ------------------------------------------------------------------- helpers

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

function stamp() {
  // 2026-09-27T01-22-33 — filesystem-safe ISO (no colons on Windows).
  return new Date().toISOString().slice(0, 19).replace('T', 'T').replace(/:/g, '-')
}

// ---------------------------------------------------------------------- main

if (!SUPABASE_URL || !SERVICE_KEY) {
  fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (env or .env.local).')
}

const url = new URL(SUPABASE_URL.replace(/\/$/, ''))
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const stampText = stamp()
const rootDir = path.resolve('backups')
const outDir = path.join(rootDir, stampText)

if (!existsSync(rootDir)) {
  fail('backups/ does not exist — run from the project root.')
}
await mkdir(outDir, { recursive: true })

console.log(`Backing up ${TABLES.length} tables → backups/${stampText}/`)

let failed = 0
const manifest = {
  createdAt: new Date().toISOString(),
  project: url.hostname.split('.')[0],
  tables: {},
}

for (const table of TABLES) {
  try {
    // Deterministic order keeps backups diff-friendly.
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(ORDER_COLUMN[table] || 'created_at', { ascending: true, nullsFirst: false })

    if (error) throw error

    const rows = data || []
    const file = `${table}.json`
    await writeFile(
      path.join(outDir, file),
      JSON.stringify(rows, null, 2),
      'utf8',
    )
    manifest.tables[table] = { file, rows: rows.length }
    console.log(`  ✓ ${table.padEnd(26)} ${String(rows.length).padStart(5)} rows`)
  } catch (err) {
    failed++
    manifest.tables[table] = { error: err?.message || String(err) }
    console.error(`  ✗ ${table.padEnd(26)} ${err?.message || err}`)
  }
}

await writeFile(path.join(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

// ------------------------------------------------------------ retention prune

try {
  const entries = (await readdir(rootDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(e.name))
    .map((e) => e.name)
    .sort()

  const excess = entries.slice(0, Math.max(0, entries.length - KEEP))
  for (const name of excess) {
    await rm(path.join(rootDir, name), { recursive: true, force: true })
    console.log(`  · pruned old backup ${name}`)
  }
} catch {
  // Pruning is best-effort — never fail the backup over it.
}

console.log(failed === 0
  ? `\nBackup complete: backups/${stampText}/ (manifest + ${TABLES.length - failed} files)`
  : `\nBackup finished with ${failed} table error(s) — see backups/${stampText}/_manifest.json`)
process.exit(failed === 0 ? 0 : 1)
