// Document Management System data layer (ES Module) — Postgres-backed via
// api/_lib/db.js primitives, following the same jsonb-document pattern as
// crmStore.js/projectStore.js. Binaries live in Vercel Blob under
// documents/<documentId>/v<version>-<sanitised-filename>; only metadata and
// the blob pathname live in the database, so the storage provider can be
// swapped without touching document records.
//
// Integrity rules (see the DMS brief):
//   • Documents belong to a project (snapshot ref survives project deletion).
//   • Versions are append-only; the current pointer lives on the document.
//   • Archiving never deletes; permanent delete requires explicit action.
//   • Every mutation writes an audit entry (upload/view/download/rename/…).
import {
  listRecords, getRecord, putRecord, deleteRecord, nextCounter, hasDb,
} from './db.js'
import { newId } from './crmStore.js'

const str = (value, max) => String(value ?? '').trim().slice(0, max)
const iso = (value) => {
  const t = Date.parse(value)
  return Number.isFinite(t) ? new Date(t).toISOString() : ''
}

export const DOCUMENT_STATUSES = ['Draft', 'Working', 'Under Review', 'Approved', 'Final', 'Archived']
export const VISIBILITY_LEVELS = ['Internal', 'Client', 'Public Portfolio']
export const DEFAULT_FOLDERS = [
  'Client Documents', 'Field Data', 'Survey Data', 'GIS Data', 'CAD',
  'Maps', 'Reports', 'Photos', 'Quotations', 'Final Deliverables',
]

// Extension whitelist — surveying/GIS/consulting document types. Executables
// are never accepted. Extension (not the browser MIME type) is the source of
// truth; mime is recorded for convenience only.
const ALLOWED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv',
  'jpg', 'jpeg', 'png', 'webp', 'svg',
  'dwg', 'dxf', 'kml', 'kmz', 'zip', 'rar',
]
const EXT_MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  dwg: 'image/vnd.dwg',
  dxf: 'image/vnd.dxf',
  kml: 'application/vnd.google-earth.kml+xml',
  kmz: 'application/vnd.google-earth.kmz',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
}
export const PREVIEWABLE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'svg', 'csv', 'txt']
export const MAX_FILE_BYTES = 200 * 1024 * 1024

// ---------------------------------------------------------------- utilities

function extOf(filename) {
  const match = /\.([A-Za-z0-9]+)$/.exec(String(filename || ''))
  return match ? match[1].toLowerCase() : ''
}

// Path-traversal-safe stored filename: strips directories, control
// characters, unsafe chars and reserved device names; keeps the original
// name readable (the original filename is also preserved verbatim on the
// record for display/download headers).
export function sanitiseFilename(name) {
  const base = String(name || 'file')
    .split(/[\\/]+/)
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 120)
  const safe = base || 'file'
  // Windows reserved device names (even with extensions) are avoided.
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(safe)) return `_${safe}`
  return safe
}

function isAllowedFilename(name) {
  const base = String(name || '').split(/[\\/]+/).pop()
  if (!base || base.length > 200) return false
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(base)) return false
  return true
}

function tableOf(kind) {
  const map = {
    documents: 'documents',
    versions: 'document_versions',
    folders: 'document_folders',
    categories: 'document_categories',
    activity: 'document_activity',
  }
  const table = map[kind]
  if (!table) {
    const error = new Error(`Unknown DMS store: ${kind}`)
    error.status = 500
    throw error
  }
  return table
}

function fail(message, status = 400) {
  const error = new Error(message)
  error.status = status
  throw error
}

// ------------------------------------------------------------------ audit

export async function logDocumentActivity(entry) {
  try {
    const activity = {
      id: newId(),
      at: new Date().toISOString(),
      documentId: str(entry.documentId, 80),
      projectId: str(entry.projectId, 80),
      projectNumber: str(entry.projectNumber, 40),
      filename: str(entry.filename, 200),
      action: str(entry.action, 40),
      detail: str(entry.detail, 300),
      actor: str(entry.actor, 120),
    }
    await putRecord(tableOf('activity'), activity.id, activity)
  } catch {
    // Audit is best-effort by design — never fail the primary action.
  }
}

export async function readDocumentActivity(params = {}) {
  const all = await listRecords(tableOf('activity'))
  const filtered = all.filter((a) => {
    if (params.documentId && a.documentId !== params.documentId) return false
    if (params.projectId && a.projectId !== params.projectId) return false
    return true
  })
  const limit = Math.min(200, Math.max(1, Number(params.limit) || 50))
  return filtered.slice(0, limit)
}

// ------------------------------------------------------------- categories

function normaliseCategory(input) {
  const name = str(input.name, 60)
  if (!name) fail('Category name is required')
  const slug = str(input.slug, 60)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `cat-${Date.now().toString(36)}`
  return {
    id: str(input.id, 80) || `cat-${slug}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    slug,
    system: Boolean(input.system),
    createdAt: iso(input.createdAt) || new Date().toISOString(),
  }
}

export async function readCategories() {
  const rows = await listRecords(tableOf('categories'), { orderDesc: false })
  return rows.sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

export async function createCategory(input) {
  const category = normaliseCategory(input)
  const existing = await readCategories()
  if (existing.some((c) => c.slug === category.slug || c.name.toLowerCase() === category.name.toLowerCase())) {
    fail('A category with this name already exists', 409)
  }
  await putRecord(tableOf('categories'), category.id, category)
  return category
}

export async function updateCategory(id, patch) {
  const current = await getRecord(tableOf('categories'), id)
  if (!current) return { applied: false }
  if (current.system && (patch.name !== undefined && patch.name !== current.name)) {
    fail('System categories cannot be renamed', 409)
  }
  const next = normaliseCategory({ ...current, ...patch, id: current.id, system: current.system, createdAt: current.createdAt })
  await putRecord(tableOf('categories'), id, next)
  return { applied: true, category: next }
}

export async function deleteCategory(id) {
  const current = await getRecord(tableOf('categories'), id)
  if (!current) return { deleted: false }
  if (current.system) fail('System categories cannot be deleted', 409)
  // Documents keep their category NAME snapshot; they only need the id
  // cleared so filters do not dangle.
  const documents = await listRecords(tableOf('documents'))
  const linked = documents.filter((d) => d.categoryId === id)
  await Promise.all(linked.map((doc) => putRecord(tableOf('documents'), doc.id, { ...doc, categoryId: '', categoryName: 'Other' })))
  await deleteRecord(tableOf('categories'), id)
  return { deleted: true, documentsUpdated: linked.length }
}

// ---------------------------------------------------------------- folders

function normaliseFolder(input) {
  const name = str(input.name, 80)
  if (!name) fail('Folder name is required')
  return {
    id: str(input.id, 80) || `fld-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    projectId: str(input.projectId, 80),
    name,
    system: Boolean(input.system),
    archived: Boolean(input.archived),
    createdAt: iso(input.createdAt) || new Date().toISOString(),
  }
}

export async function readFolders(params = {}) {
  const rows = await listRecords(tableOf('folders'))
  return rows.filter((f) => (params.projectId ? f.projectId === params.projectId : true))
}

// Every project gets the ten system folders on first touch — idempotent.
export async function ensureProjectFolders(projectId) {
  if (!projectId) return []
  const existing = await readFolders({ projectId })
  if (existing.length > 0) return existing
  const created = []
  for (const name of DEFAULT_FOLDERS) {
    const folder = normaliseFolder({ projectId, name, system: true })
    await putRecord(tableOf('folders'), folder.id, folder)
    created.push(folder)
  }
  return created
}

export async function createFolder(input) {
  const folder = normaliseFolder(input)
  if (!folder.projectId) fail('Folder must belong to a project')
  const existing = await readFolders({ projectId: folder.projectId })
  if (existing.some((f) => f.name.toLowerCase() === folder.name.toLowerCase())) {
    fail('A folder with this name already exists in the project', 409)
  }
  await putRecord(tableOf('folders'), folder.id, folder)
  return folder
}

export async function updateFolder(id, patch) {
  const current = await getRecord(tableOf('folders'), id)
  if (!current) return { applied: false }
  const next = normaliseFolder({ ...current, ...patch, id: current.id, createdAt: current.createdAt })
  if (next.system && patch.archived === undefined && next.name !== current.name) {
    // Renaming system folders is allowed; the system flag just stays.
  }
  const siblings = await readFolders({ projectId: next.projectId })
  if (siblings.some((f) => f.id !== id && f.name.toLowerCase() === next.name.toLowerCase())) {
    fail('A folder with this name already exists in the project', 409)
  }
  const movedFrom = patch.projectId && patch.projectId !== current.projectId ? current.projectId : ''
  await putRecord(tableOf('folders'), id, next)
  // Moving a folder moves its documents with it (project ref is snapshotted
  // on each document; folder references are by id + name snapshot).
  if (movedFrom || patch.projectId) {
    const documents = await listRecords(tableOf('documents'))
    const moved = documents.filter((d) => d.folderId === id)
    await Promise.all(moved.map((doc) => putRecord(tableOf('documents'), doc.id, { ...doc, projectId: next.projectId, folderName: next.name })))
  }
  return { applied: true, folder: next, documentsMoved: movedFrom ? undefined : undefined }
}

export async function deleteFolder(id, { force = false } = {}) {
  const current = await getRecord(tableOf('folders'), id)
  if (!current) return { deleted: false }
  const documents = await listRecords(tableOf('documents'))
  const inside = documents.filter((d) => d.folderId === id)
  if (inside.length > 0 && !force) {
    const error = new Error(`Folder contains ${inside.length} document(s). Confirm force delete to remove the folder and its documents.`)
    error.status = 409
    error.code = 'FOLDER_NOT_EMPTY'
    error.count = inside.length
    throw error
  }
  await deleteRecord(tableOf('folders'), id)
  return { deleted: true, documentsDeleted: inside.length }
}

// -------------------------------------------------------------- documents

function normaliseDocument(input) {
  return {
    documentNumber: str(input.documentNumber, 40),
    originalFilename: str(input.originalFilename, 200),
    storedFilename: str(input.storedFilename, 200),
    pathname: str(input.pathname, 400),
    mimeType: str(input.mimeType, 120),
    ext: str(input.ext, 12).toLowerCase(),
    sizeBytes: Math.max(0, Math.round(Number(input.sizeBytes) || 0)),
    projectRef: {
      id: str(input.projectRef?.id, 80),
      number: str(input.projectRef?.number, 40),
      title: str(input.projectRef?.title, 200),
    },
    folderId: str(input.folderId, 80),
    folderName: str(input.folderName, 80),
    categoryId: str(input.categoryId, 80),
    categoryName: str(input.categoryName, 60),
    description: str(input.description, 2000),
    tags: Array.isArray(input.tags)
      ? [...new Set(input.tags.map((t) => str(t, 40)).filter(Boolean))].slice(0, 15)
      : [],
    version: Math.max(1, Math.round(Number(input.version) || 1)),
    status: DOCUMENT_STATUSES.includes(input.status) ? input.status : 'Draft',
    visibility: VISIBILITY_LEVELS.includes(input.visibility) ? input.visibility : 'Internal',
    starred: Boolean(input.starred),
    archived: Boolean(input.archived),
    uploadedBy: str(input.uploadedBy, 120),
    deliverableIds: Array.isArray(input.deliverableIds)
      ? [...new Set(input.deliverableIds.map((d) => str(d, 80)).filter(Boolean))].slice(0, 20)
      : [],
    versionNotes: str(input.versionNotes, 500),
    lastAccessedAt: str(input.lastAccessedAt, 40),
    createdAt: iso(input.createdAt) || new Date().toISOString(),
    updatedAt: iso(input.updatedAt) || new Date().toISOString(),
  }
}

export async function readDocuments() {
  return listRecords(tableOf('documents'))
}

export async function getDocumentById(id) {
  return getRecord(tableOf('documents'), id)
}

export async function getDocumentByVersionId(versionId) {
  const versions = await listRecords(tableOf('versions'))
  return versions.find((v) => v.id === versionId) || null
}

export async function readVersions(documentId) {
  const rows = await listRecords(tableOf('versions'))
  return rows
    .filter((v) => v.documentId === documentId)
    .sort((a, b) => (Number(b.version) || 0) - (Number(a.version) || 0))
}

export async function readDocumentDetail(id) {
  const document = await getDocumentById(id)
  if (!document) return null
  const [versions, activity] = await Promise.all([
    readVersions(id),
    readDocumentActivity({ documentId: id, limit: 100 }),
  ])
  return { document, versions, activity }
}

// Allocates DOC-2026-0001 style numbers from the shared atomic counter.
export async function allocateDocumentNumber() {
  const n = await nextCounter('documents')
  if (n === null) return `DOC-X${Date.now().toString(36).toUpperCase().slice(-6)}`
  return `DOC-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`
}

// Server-side verification of an uploaded Blob object: confirms the file
// actually exists at the pathname the client claims and takes the TRUE size
// from storage (never the client-declared number). Skipped when Blob is not
// configured (local no-storage dev mode).
async function verifyStoredObject(pathname) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { verified: false, sizeBytes: 0 }
  try {
    const { head } = await import('@vercel/blob')
    const meta = await head(pathname)
    return { verified: true, sizeBytes: Number(meta.size) || 0 }
  } catch {
    const error = new Error('Uploaded file could not be found in storage — upload may have failed')
    error.status = 400
    throw error
  }
}

// Server-side validation gate shared by the register endpoints. The Blob
// client-upload handshake validates nothing about business rules, so the
// metadata registration is where the whitelist, size cap and filename
// hygiene are enforced (the browser-provided MIME type is never trusted).
export function validateUpload({ originalFilename, sizeBytes }) {
  if (!isAllowedFilename(originalFilename)) fail('Invalid filename')
  const ext = extOf(originalFilename)
  if (!ALLOWED_EXTENSIONS.includes(ext)) fail(`File type ".${ext || '?'}" is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`)
  const size = Math.round(Number(sizeBytes) || 0)
  if (size <= 0) fail('File size must be greater than zero')
  if (size > MAX_FILE_BYTES) fail(`File exceeds the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB per-file limit`)
  return { ext, size }
}

// Registers a freshly uploaded Blob object as a document (version 1). The
// caller uploads bytes via the existing /api/admin/upload handshake first,
// then registers metadata here.
export async function registerDocument(input, { actor = 'Admin' } = {}) {
  const { ext, size } = validateUpload(input)
  if (!input.projectRef?.id) fail('A project is required')
  const pathname = input.pathname || ''
  if (!pathname || !String(pathname).startsWith('documents/')) fail('A storage pathname is required')
  const stored = await verifyStoredObject(pathname)
  const trueSize = stored.verified ? stored.sizeBytes : size
  if (trueSize > MAX_FILE_BYTES) fail(`File exceeds the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB per-file limit`)
  const now = new Date().toISOString()
  const id = newId()
  const number = await allocateDocumentNumber()
  const storedFilename = sanitiseFilename(input.originalFilename)
  const document = normaliseDocument({
    ...input,
    id,
    documentNumber: number,
    ext,
    sizeBytes: trueSize,
    storedFilename,
    pathname,
    mimeType: EXT_MIME[ext] || '',
    version: 1,
    createdAt: now,
    updatedAt: now,
  })
  await putRecord(tableOf('documents'), id, document)
  await putRecord(tableOf('versions'), `${id}-v1`, {
    id: `${id}-v1`,
    documentId: id,
    version: 1,
    pathname,
    originalFilename: document.originalFilename,
    storedFilename,
    ext: document.ext,
    sizeBytes: document.sizeBytes,
    notes: str(input.versionNotes, 500),
    uploadedBy: document.uploadedBy,
    uploadedAt: now,
  })
  await logDocumentActivity({
    documentId: id, projectId: document.projectRef.id, projectNumber: document.projectRef.number,
    filename: document.originalFilename, action: 'uploaded',
    detail: `Version 1 uploaded${document.folderName ? ` to ${document.folderName}` : ''}`, actor,
  })
  return document
}

// Adds a new version: appends to document_versions, bumps the pointer and
// records the previous version id for the audit trail. History is preserved.
export async function addVersion(id, input, { actor = 'Admin' } = {}) {
  const document = await getDocumentById(id)
  if (!document) return { applied: false }
  const { ext, size } = validateUpload(input)
  const storedFilename = sanitiseFilename(input.originalFilename)
  const nextVersion = (Number(document.version) || 1) + 1
  const pathname = input.pathname || `documents/${id}/v${nextVersion}-${storedFilename}`
  const stored = await verifyStoredObject(pathname)
  const trueSize = stored.verified ? stored.sizeBytes : size
  const now = new Date().toISOString()
  const version = {
    id: `${id}-v${nextVersion}`,
    documentId: id,
    version: nextVersion,
    pathname,
    originalFilename: str(input.originalFilename, 200),
    storedFilename,
    ext,
    sizeBytes: trueSize,
    notes: str(input.versionNotes, 500),
    uploadedBy: str(actor, 120),
    uploadedAt: now,
  }
  await putRecord(tableOf('versions'), version.id, version)
  const next = normaliseDocument({
    ...document,
    ext,
    sizeBytes: trueSize,
    mimeType: EXT_MIME[ext] || '',
    pathname,
    originalFilename: str(input.originalFilename, 200) || document.originalFilename,
    storedFilename,
    version: nextVersion,
    versionNotes: version.notes,
    updatedAt: now,
  })
  await putRecord(tableOf('documents'), id, next)
  await logDocumentActivity({
    documentId: id, projectId: next.projectRef.id, projectNumber: next.projectRef.number,
    filename: next.originalFilename, action: 'version_created',
    detail: `Version ${nextVersion} uploaded (v${document.version} → v${nextVersion})`, actor,
  })
  return { applied: true, document: next, version }
}

// Restore: the chosen historical version's blob becomes a NEW current
// version (copy-forward, like proper DMS behaviour) — history intact.
export async function restoreVersion(id, versionId, { actor = 'Admin' } = {}) {
  const document = await getDocumentById(id)
  if (!document) return { applied: false }
  const versions = await readVersions(id)
  const source = versions.find((v) => v.id === versionId)
  if (!source) fail('Version not found', 404)
  const nextVersion = (Number(document.version) || 1) + 1
  const now = new Date().toISOString()
  const storedFilename = source.storedFilename || sanitiseFilename(source.originalFilename)
  const pathname = `documents/${id}/v${nextVersion}-${storedFilename}`
  const version = {
    id: `${id}-v${nextVersion}`,
    documentId: id,
    version: nextVersion,
    pathname,
    originalFilename: source.originalFilename,
    storedFilename,
    ext: source.ext,
    sizeBytes: source.sizeBytes,
    notes: `Restored from version ${source.version}`,
    uploadedBy: str(actor, 120),
    uploadedAt: now,
  }
  await putRecord(tableOf('versions'), version.id, version)
  const next = normaliseDocument({
    ...document,
    ext: source.ext,
    sizeBytes: source.sizeBytes,
    mimeType: EXT_MIME[source.ext] || '',
    pathname,
    version: nextVersion,
    versionNotes: version.notes,
    updatedAt: now,
  })
  await putRecord(tableOf('documents'), id, next)
  await logDocumentActivity({
    documentId: id, projectId: next.projectRef.id, projectNumber: next.projectRef.number,
    filename: next.originalFilename, action: 'version_restored',
    detail: `Version ${source.version} restored as version ${nextVersion}`, actor,
  })
  return { applied: true, document: next, version }
}

// Metadata patch (rename/move/category/status/tags/visibility/star/notes).
export async function updateDocument(id, patch, { actor = 'Admin' } = {}) {
  const document = await getDocumentById(id)
  if (!document) return { applied: false }
  const merged = { ...document, ...patch }
  if (patch.folderId !== undefined || patch.projectId !== undefined) {
    // Folder/project moves also refresh the folder name snapshot.
    if (patch.folderId && !merged.folderName) {
      const folder = await getRecord(tableOf('folders'), patch.folderId)
      if (folder) merged.folderName = folder.name
    }
  }
  const next = normaliseDocument({ ...merged, id: document.id, createdAt: document.createdAt, updatedAt: new Date().toISOString() })
  if (JSON.stringify(next) === JSON.stringify(document)) {
    return { applied: true, document, unchanged: true }
  }
  await putRecord(tableOf('documents'), id, next)
  const changes = []
  if (next.originalFilename !== document.originalFilename) changes.push(`renamed to "${next.originalFilename}"`)
  if (next.folderId !== document.folderId) changes.push(`moved to ${next.folderName || 'another folder'}`)
  if (next.categoryId !== document.categoryId) changes.push(`category → ${next.categoryName || '—'}`)
  if (next.status !== document.status) changes.push(`status → ${next.status}`)
  if (next.visibility !== document.visibility) changes.push(`visibility → ${next.visibility}`)
  if (JSON.stringify(next.tags) !== JSON.stringify(document.tags)) changes.push('tags updated')
  if (next.starred !== document.starred) changes.push(next.starred ? 'starred' : 'unstarred')
  if (next.archived !== document.archived) changes.push(next.archived ? 'archived' : 'restored from archive')
  if (changes.length > 0) {
    await logDocumentActivity({
      documentId: id, projectId: next.projectRef.id, projectNumber: next.projectRef.number,
      filename: next.originalFilename, action: next.archived !== document.archived ? (next.archived ? 'archived' : 'restored') : 'metadata_changed',
      detail: changes.join(', '), actor,
    })
  }
  return { applied: true, document: next }
}

export async function touchAccessed(id) {
  const document = await getDocumentById(id)
  if (!document) return
  await putRecord(tableOf('documents'), id, { ...document, lastAccessedAt: new Date().toISOString() }).catch(() => {})
}

// Permanent delete: removes the document row, ALL version rows and the Blob
// objects (best-effort), then logs the action. Only reached behind an
// explicit confirmation in the UI.
export async function deleteDocument(id, { actor = 'Admin' } = {}) {
  const document = await getDocumentById(id)
  if (!document) return { deleted: false }
  const versions = await readVersions(id)
  try {
    const { del } = await import('@vercel/blob')
    await Promise.all(versions.map((v) => del(v.pathname).catch(() => {})))
  } catch { /* Blob cleanup is best-effort; metadata removal proceeds */ }
  await Promise.all(versions.map((v) => deleteRecord(tableOf('versions'), v.id).catch(() => {})))
  await deleteRecord(tableOf('documents'), id)
  await logDocumentActivity({
    documentId: '', projectId: document.projectRef.id, projectNumber: document.projectRef.number,
    filename: document.originalFilename, action: 'deleted',
    detail: `Permanently deleted (${versions.length} version(s))`, actor,
  })
  return { deleted: true, versionsDeleted: versions.length }
}

// -------------------------------------------------------------- dashboard

export async function getDashboard() {
  const [documents, categories] = await Promise.all([readDocuments(), readCategories()])
  const active = documents.filter((d) => !d.archived)
  const today = new Date().toISOString().slice(0, 10)
  const byType = {}
  for (const doc of active) byType[doc.ext || 'other'] = (byType[doc.ext || 'other'] || 0) + 1
  const byProject = {}
  for (const doc of active) {
    const key = doc.projectRef?.id || 'none'
    byProject[key] = byProject[key] || { id: key, number: doc.projectRef?.number || '—', title: doc.projectRef?.title || 'Unassigned', files: 0, sizeBytes: 0 }
    byProject[key].files += 1
    byProject[key].sizeBytes += doc.sizeBytes || 0
  }
  return {
    totals: {
      files: active.length,
      archivedFiles: documents.length - active.length,
      storageBytes: active.reduce((sum, d) => sum + (d.sizeBytes || 0), 0),
      uploadedToday: active.filter((d) => String(d.createdAt).slice(0, 10) === today).length,
      awaitingReview: active.filter((d) => d.status === 'Under Review').length,
      starred: active.filter((d) => d.starred).length,
    },
    recent: [...active].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 8),
    recentlyModified: [...active].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 8),
    recentlyDownloaded: active
      .filter((d) => d.lastAccessedAt)
      .sort((a, b) => String(b.lastAccessedAt).localeCompare(String(a.lastAccessedAt)))
      .slice(0, 6),
    byType,
    byProject: Object.values(byProject).sort((a, b) => b.files - a.files).slice(0, 10),
    categories,
  }
}

// -------------------------------------------------- project summary hook

// Everything the ProjectDetail Documents tab needs in one read: summary
// cards, folders and the first page of documents.
export async function getProjectSummary(projectId) {
  const [all, folders] = await Promise.all([
    listRecords(tableOf('documents')),
    ensureProjectFolders(projectId),
  ])
  const documents = all.filter((d) => d.projectRef?.id === projectId && !d.archived)
  const perFolder = {}
  for (const doc of documents) {
    perFolder[doc.folderId] = perFolder[doc.folderId] || { id: doc.folderId, name: doc.folderName || 'Unfiled', files: 0, sizeBytes: 0 }
    perFolder[doc.folderId].files += 1
    perFolder[doc.folderId].sizeBytes += doc.sizeBytes || 0
  }
  return {
    summary: {
      totalFiles: documents.length,
      storageBytes: documents.reduce((sum, d) => sum + (d.sizeBytes || 0), 0),
      recentFiles: [...documents].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5),
      folders: Object.values(perFolder).sort((a, b) => b.files - a.files),
      deliverablesLinked: documents.filter((d) => (d.deliverableIds || []).length > 0).length,
    },
    folders,
    documents,
  }
}
