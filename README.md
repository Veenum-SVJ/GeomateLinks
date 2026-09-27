# Geomate Links Consulting Limited

A geospatial solutions company based in Ibadan, Nigeria. Specializing in surveying, mapping, GIS, and drone services.

## Tech Stack
- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Vercel for hosting and serverless functions
- Supabase (Postgres) for all data: content, messages, CRM, quotations, projects, documents
- Vercel Blob for media storage and document file binaries

## Data layer
All records live in the "Geomate Links" Supabase project (eu-west-2) as jsonb
documents in `public.*` tables, written only by the serverless functions via
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS; every table has
RLS enabled with zero policies, so no public/anon access exists).

Data-layer env vars:
- `SUPABASE_URL` — project URL
- `SUPABASE_SERVICE_ROLE_KEY` — secret key (Dashboard → Project Settings → API)

Without these the API functions fall back to the bundled JSON defaults
(graceful degradation, read-only). Verify the live round-trip with
`node scripts/supabaseSmoke.mjs` after setting the key.

Backups: `npm run backup` exports every table to `backups/<timestamp>/*.json`
with a `_manifest.json`; keeps the 8 newest runs (override with `BACKUP_KEEP`).
A weekly GitHub Action (`.github/workflows/supabase-backup.yml`, Sundays
03:30 UTC) runs the same export and stores it as a **private workflow
artifact** (90 days, Actions tab) — backup folders contain customer data and
are never committed to this public repo. Needs the `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` repo secrets; failed runs open a `backup-failure`
issue.

Restores: `npm run restore backups/<timestamp>` previews a restore (dry run);
add `--apply` to write. Backup rows are upserted by id (merge — rows added
since the backup are left alone; pass `--replace` to delete them, which is
destructive). Collisions (existing rows with different content) are listed
before anything is written, and server-side counters are never lowered.
Legacy Blob-era folders (pre-Supabase, e.g. `backups/2026-09-26`) are
rejected — they need a manual conversion pass.

## Document Management System
Project-centred DMS at `/admin/documents` (also a Documents tab on every
project page). Files upload via the existing Blob client handshake under
`documents/<docId>/v<n>-…`; metadata lives in Postgres (`documents`,
`document_versions`, `document_folders`, `document_categories`,
`document_activity`). Versioned (append-only history, restore = copy-forward),
status/visibility/tags/categories, per-project folders, audit trail, bulk
actions, and an auth-checked `/api/documents/:id/file` route — raw storage
URLs never appear in API responses. Test: `node scripts/documentSmoke.mjs`.

## Admin Dashboard
The admin dashboard is available at `/admin`. Login with the password set in the `ADMIN_PASSWORD` environment variable.

## Development
- `npm run dev` – start dev server
- `npm run build` – build for production
- `npm run preview` – preview production build

## Deployment
Automatic deploys from the `main` branch via Vercel.

Updated: 2026-09-04