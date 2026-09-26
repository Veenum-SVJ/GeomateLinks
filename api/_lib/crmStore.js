// CRM data layer — Vercel Blob-backed stores for leads, clients, activities
// and follow-ups (ES Module).
//
// Storage model follows the proven per-entry pattern used for messages and
// activity: every record is its own Blob object under a fixed prefix
// (crm/leads/<stamp>-<id>.json …). A new record is a pure append, so
// concurrent writes (two admins, or a website enquiry landing while an admin
// edits a lead) can never overwrite each other — Blob is last-write-wins with
// read-after-write lag, which a single shared document would not survive.
//
// Responses for updates/deletes are derived from the PRE-WRITE read with the
// change applied in memory — never a read-after-write (same rule as
// updateMessage in store.js).
//
// Notes are stored as activities of type "note" (append-only) rather than as
// an array on the lead/client record: appending never rewrites the owner
// blob, so a note landing mid-edit can never clobber a concurrent status
// change.
import { put, head, list, del } from '@vercel/blob'
import { createRequire } from 'module'
import { readContent } from './store.js'

const require = createRequire(import.meta.url)
const fallbackModule = require('../_data/content.json')
const fallbackContent = fallbackModule.default || fallbackModule

const LEADS_PREFIX = 'crm/leads/'
const PIPELINE_PREFIX = 'crm/pipeline/'
const CLIENTS_PREFIX = 'crm/clients/'
const ACTIVITIES_PREFIX = 'crm/activities/'
const FOLLOWUPS_PREFIX = 'crm/followups/'
const COUNTER_BLOB = 'crm/counters/ids.json'

export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Quotation Sent', 'Negotiation', 'Won', 'Lost', 'On Hold']
export const LEAD_SOURCES = ['Website', 'Phone', 'WhatsApp', 'Email', 'Referral', 'Social Media', 'Walk-in', 'Existing Client', 'Other']
export const LEAD_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent']
export const CLIENT_TYPES = ['Individual', 'Company', 'Government', 'NGO', 'Institution', 'Other']
export const FOLLOWUP_STATUSES = ['Pending', 'Completed', 'Cancelled']
export const ACTIVITY_TYPES = [
  'lead_created', 'phone_call', 'email', 'whatsapp', 'meeting', 'site_visit',
  'quotation_sent', 'follow_up', 'status_changed', 'note_added',
  'client_converted', 'project_created',
]
// Leads currently in the pipeline (everything except New and terminal states).
export const ACTIVE_LEAD_STATUSES = ['Contacted', 'Qualified', 'Quotation Sent', 'Negotiation']
// Leads with a quotation out but no decision yet.
export const QUOTATION_PENDING_STATUSES = ['Quotation Sent', 'Negotiation']

// ---------------------------------------------------------------- utilities

// Pipeline facets (client link, contact/follow-up dates, project & quotation
// references) live in their OWN blob (crm/pipeline/<id>.json), separate from
// the lead's core record. Blob rewrites are read-modify-write and can serve
// stale reads inside a propagation window; keeping disjoint field sets in
// different blobs means a core edit (status, contact details) can never
// durably erase a conversion link or follow-up sync — and vice versa.
const PIPELINE_FIELDS = ['clientId', 'convertedAt', 'nextFollowUpAt', 'lastContactedAt', 'projectRef', 'quotationRef']

function emptyPipeline() {
  return {
    clientId: '',
    convertedAt: '',
    nextFollowUpAt: '',
    lastContactedAt: '',
    projectRef: { id: '', title: '' },
    quotationRef: { code: '', createdAt: '' },
  }
}

function pipelinePathname(id) {
  return `${PIPELINE_PREFIX}${id}.json`
}

async function readPipelineBlob(id) {
  if (!hasStorage()) return null
  try {
    const meta = await head(pipelinePathname(id))
    const res = await fetch(meta.url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await safeParse(await res.text(), null)
    return data && typeof data === 'object' ? data : null
  } catch {
    return null // blob does not exist yet — normal for records created before this split
  }
}



function pickPipeline(lead) {
  const picked = {}
  for (const field of PIPELINE_FIELDS) picked[field] = lead[field]
  return picked
}

// Backfill: leads created before the pipeline split (and any facet write
// lost to an earlier race) get their facet values restored from the core
// record whenever the facet blob is missing or lacks a value. Idempotent.
async function backfillPipeline(id, core) {
  try {
    const current = await readPipelineBlob(id)
    const facet = current || emptyPipeline()
    const patch = {}
    for (const field of PIPELINE_FIELDS) {
      if (!facet[field] && core[field]) patch[field] = core[field]
      if (field === 'projectRef' || field === 'quotationRef') {
        const facetRef = facet[field]
        if ((!facetRef || !facetRef.id) && core[field] && core[field].id) patch[field] = core[field]
      }
    }
    if (Object.keys(patch).length > 0) await savePipelineData(id, patch)
  } catch {
    // best-effort backfill
  }
}

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const str = (value, max) => String(value ?? '').trim().slice(0, max)

function iso(value) {
  const t = Date.parse(value)
  return Number.isFinite(t) ? new Date(t).toISOString() : ''
}

// Exported for the quotations store (api/_lib/quotationStore.js), which
// reuses this exact append-only blob idiom instead of duplicating it.
export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// Fixed-width base36 ms timestamp prefix → lexical list order = newest first.
function stampOf(entry) {
  const ts = Date.parse(entry.createdAt)
  return (Number.isFinite(ts) ? ts : Date.now()).toString(36).padStart(11, '0')
}

function entryPathname(prefix, entry) {
  return `${prefix}${stampOf(entry)}-${entry.id}.json`
}

async function listBlobs(prefix) {
  const blobs = []
  let cursor
  do {
    const result = await list({ prefix, limit: 1000, cursor })
    blobs.push(...(result.blobs || []))
    cursor = result.cursor && blobs.length < 5000 ? result.cursor : undefined
  } while (cursor)
  return blobs
}

async function fetchEntry(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await safeParse(await res.text(), null)
    return data && typeof data === 'object' && data.id ? data : null
  } catch {
    return null
  }
}

// Reads every record under a prefix, newest first. Callers must paginate or
// aggregate before returning to the client (see readLeads/getDashboard).
// Exported for the quotations store — same per-entry read/write/remove
// helpers, one implementation of the append-only pattern.
export async function readAll(prefix) {
  if (!hasStorage()) return []
  try {
    const blobs = await listBlobs(prefix)
    const entries = await Promise.all(blobs.map((blob) => fetchEntry(blob.url)))
    return entries
      .filter(Boolean)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  } catch {
    return []
  }
}

export async function putEntry(prefix, entry) {
  await put(entryPathname(prefix, entry), JSON.stringify(entry, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  })
}

export async function removeEntry(prefix, entry) {
  const blobs = await listBlobs(prefix)
  const pathname = entryPathname(prefix, entry)
  const blob = blobs.find((b) => b.pathname === pathname)
  if (blob) await del(blob.url)
}

// ------------------------------------------------------- ID code allocation

async function readCounter() {
  try {
    const meta = await head(COUNTER_BLOB)
    const res = await fetch(meta.url, { cache: 'no-store' })
    if (!res.ok) return { counts: {} }
    const data = await safeParse(await res.text(), { counts: {} })
    return data && data.counts ? data : { counts: {} }
  } catch {
    return { counts: {} }
  }
}

// Sequential human-friendly codes: GML-2026-0001, CLI-0007. The counter is a
// read-modify-write on one small blob; because Blob reads can be stale inside
// a propagation window, the candidate code is verified against the records
// actually stored (createLead/createClient pass their own check) and the
// counter is bumped past any collision before the code is handed out.
// Exported for the quotations module (GML-QT-… numbers) — same shared counter
// blob and the same stale-counter duplicate protection.
export async function allocateCode(kind, prefix, withYear, isTaken) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const counter = await readCounter()
      let next = (Number(counter.counts[kind]) || 0) + 1
      const codeFor = (n) =>
        withYear ? `${prefix}-${new Date().getFullYear()}-${String(n).padStart(4, '0')}` : `${prefix}-${String(n).padStart(4, '0')}`
      // Skip codes already in use (stale-counter collision protection).
      while (isTaken && (await isTaken(codeFor(next)))) next++
      await put(COUNTER_BLOB, JSON.stringify({ counts: { ...counter.counts, [kind]: next } }, null, 2), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        cacheControlMaxAge: 0,
      })
      return codeFor(next)
    } catch {
      await sleep(40 + Math.random() * 80)
    }
  }
  // Never block record creation on counter problems.
  return `${prefix}-X${Date.now().toString(36).toUpperCase().slice(-6)}`
}

// ------------------------------------------------------------------ leads

function normaliseLead(input) {
  const attachments = Array.isArray(input.attachments)
    ? input.attachments
        .slice(0, 10)
        .map((a) => ({ name: str(a?.name, 200), url: str(a?.url, 1000) }))
        .filter((a) => a.url)
    : []
  return {
    name: str(input.name, 120),
    company: str(input.company, 160),
    email: str(input.email, 200).toLowerCase(),
    phone: str(input.phone, 40),
    whatsapp: str(input.whatsapp, 40),
    // Service is a snapshot + reference: {id, title} copied from the CMS at
    // creation, so renaming/removing a service never corrupts history.
    service: {
      id: str(input.service?.id, 80),
      title: str(input.service?.title, 120),
    },
    projectType: str(input.projectType, 120),
    location: str(input.location, 160),
    source: LEAD_SOURCES.includes(input.source) ? input.source : 'Other',
    description: str(input.description, 5000),
    status: LEAD_STATUSES.includes(input.status) ? input.status : 'New',
    priority: LEAD_PRIORITIES.includes(input.priority) ? input.priority : 'Normal',
    assigned: str(input.assigned, 120),
    nextFollowUpAt: iso(input.nextFollowUpAt),
    lastContactedAt: iso(input.lastContactedAt),
    messageRef: str(input.messageRef, 80),
    // Integration points: a link to a CMS portfolio project (Phase 8) and a
    // quotation reference for the future quotation module (Phase 9). Stored
    // as light references so later modules can attach richer records
    // without restructuring the lead.
    projectRef: {
      id: str(input.projectRef?.id, 80),
      title: str(input.projectRef?.title, 160),
    },
    quotationRef: {
      code: str(input.quotationRef?.code, 40),
      createdAt: iso(input.quotationRef?.createdAt),
    },
    attachments,
  }
}

function isValidLead(lead) {
  return Boolean(lead.name && (lead.email || lead.phone))
}

export async function readAllLeads() {
  const [coreLeads, pipelines] = await Promise.all([readAll(LEADS_PREFIX), readPipelineIndex()])
  return coreLeads.map((lead) => {
    backfillPipeline(lead.id, lead)
    return { ...lead, ...(pipelines[lead.id] || {}) }
  })
}

// Reads every pipeline facet blob into an id-keyed index. Pipeline blobs are
// single-key (pathname ends with the lead id), so no filename parsing is
// needed beyond the prefix.
async function readPipelineIndex() {
  if (!hasStorage()) return {}
  try {
    const blobs = await listBlobs(PIPELINE_PREFIX)
    const entries = await Promise.all(
      blobs.map(async (blob) => {
        // pathname is crm/pipeline/<id>.json — strip the suffix; the bare id
        // keys the index and re-reads the facet.
        const raw = blob.pathname.slice(PIPELINE_PREFIX.length)
        const id = raw.endsWith('.json') ? raw.slice(0, -'.json'.length) : raw
        if (!id) return null
        const data = await readPipelineBlob(id)
        return data ? [id, data] : null
      }),
    )
    return Object.fromEntries(entries.filter(Boolean))
  } catch {
    return {}
  }
}

function filterLeads(leads, params = {}) {
  const query = str(params.query, 120).toLowerCase()
  const toIso = params.to && String(params.to).length === 10 ? `${params.to}T23:59:59.999Z` : params.to
  return leads.filter((lead) => {
    if (params.archived === 'true' ? !lead.archived : lead.archived) return false
    if (params.status && lead.status !== params.status) return false
    if (params.source && lead.source !== params.source) return false
    if (params.priority && lead.priority !== params.priority) return false
    if (params.assigned && lead.assigned !== params.assigned) return false
    if (params.service && lead.service?.id !== params.service) return false
    if (params.clientId && lead.clientId !== params.clientId) return false
    if (params.from && lead.createdAt < params.from) return false
    if (toIso && lead.createdAt > toIso) return false
    if (query) {
      const haystack = [lead.name, lead.company, lead.email, lead.phone, lead.code, lead.location, lead.description, lead.assigned]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

function sortLeads(leads, sort = 'newest') {
  const byNewest = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt))
  const priorityRank = (p) => LEAD_PRIORITIES.indexOf(p)
  const list = [...leads]
  switch (sort) {
    case 'oldest':
      return list.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    case 'contacted':
      return list.sort((a, b) =>
        String(b.lastContactedAt || '').localeCompare(String(a.lastContactedAt || '')) || byNewest(a, b))
    case 'followup':
      return list.sort((a, b) =>
        String(a.nextFollowUpAt || '9999').localeCompare(String(b.nextFollowUpAt || '9999')) || byNewest(a, b))
    case 'priority':
      return list.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || byNewest(a, b))
    default:
      return list.sort(byNewest)
  }
}

// Paginated, filtered, sorted list. Never returns everything to the client.
export async function readLeads(params = {}) {
  const all = await readAllLeads()
  const filtered = sortLeads(filterLeads(all, params), params.sort)
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 25))
  return {
    leads: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
  }
}

export async function getLeadById(id) {
  const leads = await readAllLeads()
  return leads.find((l) => l.id === id) || null
}

export async function createLead(input, { actor = 'Admin', skipActivity = false } = {}) {
  const now = new Date().toISOString()
  const lead = {
    ...normaliseLead(input),
    id: newId(),
    code: await allocateCode('leads', 'GML', true, async (code) => (await readAllLeads()).some((l) => l.code === code)),
    clientId: '',
    convertedAt: '',
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
  if (!isValidLead(lead)) {
    const error = new Error('Name is required, plus at least an email or phone number')
    error.status = 400
    throw error
  }
  // Persist the pipeline facets (dates/refs) in their own blob, then the
  // core record. A failure in either leaves no orphan of the other.
  await savePipelineData(lead.id, pickPipeline(lead))
  await putEntry(LEADS_PREFIX, lead)
  if (!skipActivity) {
    await createActivity(
      {
        ownerType: 'lead',
        ownerId: lead.id,
        ownerCode: lead.code,
        type: 'lead_created',
        description: `Lead created${lead.source === 'Website' ? ' from website enquiry' : ''}`,
      },
      { actor },
    )
  }
  return lead
}

// Writes the pipeline facet blob (read-modify-write against the CURRENT
// stored facet, merging only the provided fields).
async function savePipelineData(id, patch) {
  const current = (await readPipelineBlob(id)) || emptyPipeline()
  const merged = { ...emptyPipeline(), ...current }
  for (const field of PIPELINE_FIELDS) {
    if (patch[field] !== undefined) merged[field] = patch[field]
  }
  await put(pipelinePathname(id), JSON.stringify(merged, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  })
  return merged
}

// Patch-in-place. Returns the updated lead derived from the pre-write read —
// never a read-after-write. The two halves of a lead live in separate blobs:
// core fields rewrite the lead blob; pipeline facets (client link, dates,
// project/quotation refs) go through their own read-modify-write in
// crm/pipeline/<id>.json, so a core edit can never durably erase a
// conversion link or a follow-up sync (and vice versa).
export async function updateLead(id, patch, { actor = 'Admin' } = {}) {
  const leads = await readAllLeads()
  const target = leads.find((l) => l.id === id)
  if (!target) return { applied: false, leads }
  const clean = normaliseLead({ ...target, ...patch })
  const next = { ...target, ...clean, id: target.id, code: target.code, createdAt: target.createdAt, updatedAt: new Date().toISOString() }
  const statusChanged = patch.status && patch.status !== target.status
  if (statusChanged) next.statusChangedAt = next.updatedAt
  if (JSON.stringify(next) !== JSON.stringify(target)) {
    await putEntry(LEADS_PREFIX, next)
    if (statusChanged) {
      await createActivity(
        {
          ownerType: 'lead',
          ownerId: next.id,
          ownerCode: next.code,
          type: 'status_changed',
          description: `Status changed: ${target.status} → ${next.status}`,
        },
        { actor },
      )
    }
  }
  // Pipeline facets are written through their own blob merge (converting,
  // follow-up scheduling/completion, "mark contacted", project/quotation
  // refs). Unchanged for plain field edits — no write, no race.
  const pipelinePatch = {}
  for (const field of PIPELINE_FIELDS) {
    if (patch[field] !== undefined) pipelinePatch[field] = patch[field]
  }
  let finalLead = next
  if (Object.keys(pipelinePatch).length > 0) {
    // Reflect the freshly merged facet in the response instead of the
    // pre-write read (which may lag the facet blob just written).
    const merged = await savePipelineData(id, pipelinePatch)
    finalLead = { ...next, ...merged }
  }
  return { applied: true, lead: finalLead, leads: leads.map((l) => (l.id === id ? finalLead : l)) }
}

export async function deleteLead(id) {
  const leads = await readAllLeads()
  const target = leads.find((l) => l.id === id)
  if (!target) return { deleted: false }
  await removeEntry(LEADS_PREFIX, target)
  // Remove the lead's pipeline facet blob too.
  await del(pipelinePathname(id)).catch(() => {})
  // Remove dependent records so no orphans are left behind. The lead's own
  // history is gone by explicit admin choice — archiving preserves it.
  const [activities, followups] = await Promise.all([readAll(ACTIVITIES_PREFIX), readAll(FOLLOWUPS_PREFIX)])
  await Promise.all([
    ...activities.filter((a) => a.ownerId === id).map((a) => removeEntry(ACTIVITIES_PREFIX, a).catch(() => {})),
    ...followups.filter((f) => f.relatedId === id).map((f) => removeEntry(FOLLOWUPS_PREFIX, f).catch(() => {})),
  ])
  const deletedActivities = activities.filter((a) => a.ownerId === id).length
  const deletedFollowups = followups.filter((f) => f.relatedId === id).length
  return { deleted: true, deletedActivities, deletedFollowups }
}

// ------------------------------------------------------------- conversion

// Converts a lead into (or links it to) an existing client. Dedupe by email
// or phone: if a client with the same email/phone exists, the lead is linked
// to that client instead of creating a duplicate. The original lead is
// always preserved.
export async function convertLead(id, clientInput = {}, { actor = 'Admin' } = {}) {
  const leads = await readAllLeads()
  const lead = leads.find((l) => l.id === id)
  if (!lead) return { applied: false, reason: 'not-found' }
  if (lead.clientId) {
    const clients = await readAll(CLIENTS_PREFIX)
    return { applied: true, created: false, lead, client: clients.find((c) => c.id === lead.clientId) || null }
  }

  const clients = await readAll(CLIENTS_PREFIX)
  const digits = (v) => String(v || '').replace(/\D/g, '')
  const match =
    clients.find((c) => lead.email && c.email && c.email === lead.email) ||
    clients.find((c) => lead.phone && digits(c.phone) && digits(c.phone) === digits(lead.phone))

  let client
  let created = false
  if (match) {
    client = match
  } else {
    client = await createClient(
      {
        name: clientInput.name || lead.name,
        company: clientInput.company ?? lead.company,
        email: clientInput.email ?? lead.email,
        phone: clientInput.phone ?? lead.phone,
        whatsapp: clientInput.whatsapp ?? lead.whatsapp,
        address: clientInput.address ?? '',
        industry: clientInput.industry ?? '',
        type: clientInput.type || (lead.company ? 'Company' : 'Individual'),
        notes: clientInput.notes ?? '',
      },
      { actor },
    )
    created = true
  }

  const updated = await updateLead(
    id,
    // Conversion only links the client and stamps the date — the pipeline
    // status stays under the administrator's control (Change Status).
    { clientId: client.id, convertedAt: new Date().toISOString() },
    { actor },
  )
  const leadNext = updated.lead || lead
  await createActivity(
    {
      ownerType: 'lead',
      ownerId: leadNext.id,
      ownerCode: leadNext.code,
      type: 'client_converted',
      description: `${leadNext.code} converted to client ${client.code}${created ? '' : ' (matched existing client)'}`,
    },
    { actor },
  )
  return { applied: true, created, lead: leadNext, client }
}

// -------------------------------------------------------------- clients

function normaliseClient(input) {
  return {
    name: str(input.name, 120),
    company: str(input.company, 160),
    email: str(input.email, 200).toLowerCase(),
    phone: str(input.phone, 40),
    whatsapp: str(input.whatsapp, 40),
    address: str(input.address, 300),
    industry: str(input.industry, 120),
    type: CLIENT_TYPES.includes(input.type) ? input.type : 'Individual',
    notes: str(input.notes, 3000),
  }
}

function isValidClient(client) {
  return Boolean(client.name && (client.email || client.phone))
}

export async function readClients(params = {}) {
  const all = await readAll(CLIENTS_PREFIX)
  const query = str(params.query, 120).toLowerCase()
  const filtered = all.filter((client) => {
    if (params.type && client.type !== params.type) return false
    if (query) {
      const haystack = [client.name, client.company, client.email, client.phone, client.code, client.industry, client.address]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 25))
  return {
    clients: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
  }
}

export async function getClientById(id) {
  const clients = await readAll(CLIENTS_PREFIX)
  return clients.find((c) => c.id === id) || null
}

export async function createClient(input, { actor = 'Admin' } = {}) {
  const now = new Date().toISOString()
  const client = {
    ...normaliseClient(input),
    id: newId(),
    code: await allocateCode('clients', 'CLI', false, async (code) => (await readAll(CLIENTS_PREFIX)).some((c) => c.code === code)),
    createdAt: now,
    updatedAt: now,
  }
  if (!isValidClient(client)) {
    const error = new Error('Name is required, plus at least an email or phone number')
    error.status = 400
    throw error
  }
  await putEntry(CLIENTS_PREFIX, client)
  return client
}

export async function updateClient(id, patch) {
  const clients = await readAll(CLIENTS_PREFIX)
  const target = clients.find((c) => c.id === id)
  if (!target) return { applied: false, clients }
  const next = {
    ...target,
    ...normaliseClient({ ...target, ...patch }),
    id: target.id,
    code: target.code,
    createdAt: target.createdAt,
    updatedAt: new Date().toISOString(),
  }
  if (JSON.stringify(next) !== JSON.stringify(target)) {
    await putEntry(CLIENTS_PREFIX, next)
  }
  return { applied: true, client: next, clients: clients.map((c) => (c.id === id ? next : c)) }
}

export async function deleteClient(id) {
  const clients = await readAll(CLIENTS_PREFIX)
  const target = clients.find((c) => c.id === id)
  if (!target) return { deleted: false }
  await removeEntry(CLIENTS_PREFIX, target)
  return { deleted: true }
}

// Leads linked to a client (for the client history view).
export async function listLeadsByClient(clientId) {
  const leads = await readAllLeads()
  return leads.filter((l) => l.clientId === clientId)
}

// ------------------------------------------------------------ activities

// Activity types map to the PRD timeline: lead_created, phone_call, email,
// whatsapp, meeting, site_visit, quotation_sent, follow_up, status_changed,
// note_added, client_converted, project_created. Notes are activities of
// type "note_added" — private, author + timestamp, never public.
export async function createActivity(input, { actor = 'Admin' } = {}) {
  const now = new Date().toISOString()
  const activity = {
    id: newId(),
    ownerType: input.ownerType === 'client' ? 'client' : 'lead',
    ownerId: str(input.ownerId, 80),
    ownerCode: str(input.ownerCode, 40),
    type: ACTIVITY_TYPES.includes(input.type) ? input.type : 'note_added',
    description: str(input.description, 2000),
    at: iso(input.at) || now,
    createdBy: str(input.createdBy || actor, 120),
    createdAt: now,
  }
  if (!activity.ownerId) {
    const error = new Error('Activity owner is required')
    error.status = 400
    throw error
  }
  await putEntry(ACTIVITIES_PREFIX, activity)
  return activity
}

export async function readActivities(params = {}) {
  const all = await readAll(ACTIVITIES_PREFIX)
  const filtered = all.filter((a) => {
    if (params.ownerType && a.ownerType !== params.ownerType) return false
    if (params.ownerId && a.ownerId !== params.ownerId) return false
    if (params.type && a.type !== params.type) return false
    return true
  })
  const limit = Math.min(200, Math.max(1, Number(params.limit) || 50))
  return filtered.slice(0, limit)
}

// ------------------------------------------------------------ follow-ups

function isValidDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

function normaliseFollowup(input) {
  return {
    relatedType: input.relatedType === 'client' ? 'client' : 'lead',
    relatedId: str(input.relatedId, 80),
    relatedCode: str(input.relatedCode, 40),
    date: isValidDay(input.date) ? input.date : '',
    time: str(input.time, 8),
    title: str(input.title, 160),
    description: str(input.description, 2000),
    priority: LEAD_PRIORITIES.includes(input.priority) ? input.priority : 'Normal',
    status: FOLLOWUP_STATUSES.includes(input.status) ? input.status : 'Pending',
  }
}

export async function createFollowup(input) {
  const now = new Date().toISOString()
  const followup = {
    ...normaliseFollowup(input),
    id: newId(),
    createdAt: now,
    updatedAt: now,
  }
  if (!followup.relatedId || !followup.date) {
    const error = new Error('Related lead/client and follow-up date are required')
    error.status = 400
    throw error
  }
  await putEntry(FOLLOWUPS_PREFIX, followup)
  return followup
}

export async function readFollowups(params = {}) {
  const all = await readAll(FOLLOWUPS_PREFIX)
  const filtered = all.filter((f) => {
    if (params.status && f.status !== params.status) return false
    if (params.relatedType && f.relatedType !== params.relatedType) return false
    if (params.relatedId && f.relatedId !== params.relatedId) return false
    return true
  })
  return filtered.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time || '').localeCompare(String(b.time || '')))
}

export async function getFollowupById(id) {
  const followups = await readAll(FOLLOWUPS_PREFIX)
  return followups.find((f) => f.id === id) || null
}

export async function updateFollowup(id, patch) {
  const followups = await readAll(FOLLOWUPS_PREFIX)
  const target = followups.find((f) => f.id === id)
  if (!target) return { applied: false, followups }
  const next = {
    ...target,
    ...normaliseFollowup({ ...target, ...patch }),
    id: target.id,
    createdAt: target.createdAt,
    updatedAt: new Date().toISOString(),
  }
  if (JSON.stringify(next) !== JSON.stringify(target)) {
    await putEntry(FOLLOWUPS_PREFIX, next)
  }
  return { applied: true, followup: next, followups: followups.map((f) => (f.id === id ? next : f)) }
}

export async function deleteFollowup(id) {
  const followups = await readAll(FOLLOWUPS_PREFIX)
  const target = followups.find((f) => f.id === id)
  if (!target) return { deleted: false }
  await removeEntry(FOLLOWUPS_PREFIX, target)
  return { deleted: true }
}

// ------------------------------------------------------------ dashboard

function dayString(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000)
  return d.toISOString().slice(0, 10)
}

export async function getDashboard() {
  const [leads, clients, followups, activities] = await Promise.all([
    readAllLeads(),
    readAll(CLIENTS_PREFIX),
    readFollowups({ status: 'Pending' }),
    readActivities({ limit: 8 }),
  ])
  const open = leads.filter((l) => !l.archived)

  const pending = followups.filter((f) => f.status === 'Pending')
  const today = dayString(0)
  const tomorrow = dayString(1)
  const overdue = pending.filter((f) => f.date && f.date < today)
  const dueToday = pending.filter((f) => f.date === today)
  const dueTomorrow = pending.filter((f) => f.date === tomorrow)
  const upcoming = pending.filter((f) => f.date && f.date > tomorrow)

  return {
    cards: {
      totalLeads: open.length,
      newLeads: open.filter((l) => l.status === 'New').length,
      activeLeads: open.filter((l) => ACTIVE_LEAD_STATUSES.includes(l.status)).length,
      qualifiedLeads: open.filter((l) => l.status === 'Qualified').length,
      quotationsPending: open.filter((l) => QUOTATION_PENDING_STATUSES.includes(l.status)).length,
      activeClients: clients.length,
      followupsDue: overdue.length + dueToday.length + dueTomorrow.length,
      projectsWon: open.filter((l) => l.status === 'Won').length,
    },
    recentLeads: open.slice(0, 5),
    recentActivities: activities,
    upcomingFollowups: {
      overdue: overdue.slice(0, 6),
      today: dueToday.slice(0, 6),
      tomorrow: dueTomorrow.slice(0, 6),
      upcoming: upcoming.slice(0, 6),
    },
    recentlyConverted: open
      .filter((l) => l.convertedAt)
      .sort((a, b) => String(b.convertedAt).localeCompare(String(a.convertedAt)))
      .slice(0, 5),
  }
}

// ------------------------------------------------- contact-form integration

// Builds a CRM lead from a website contact-form message. Dedupe: if a lead
// already references this message, nothing is created. Best-effort matching
// of the enquiry text against CMS service titles (snapshot stored — CMS
// renames never corrupt the lead).
export async function leadFromMessage(message) {
  const existing = await readAllLeads()
  const dupe = existing.find((l) => l.messageRef === message.id)
  if (dupe) return { created: false, lead: dupe }

  const content = await readContent(fallbackContent)
  const services = Array.isArray(content?.services) ? content.services : []
  const haystack = `${message.subject} ${message.message}`.toLowerCase()
  const matched = services.find((s) => s.title && haystack.includes(String(s.title).toLowerCase()))

  const lead = await createLead(
    {
      name: message.name,
      email: message.email,
      phone: message.phone,
      source: 'Website',
      status: 'New',
      description: [message.subject, message.message].filter(Boolean).join('\n\n').slice(0, 5000),
      messageRef: message.id,
      service: matched ? { id: matched.id, title: matched.title } : { id: '', title: '' },
    },
    { actor: 'Website' },
  )
  return { created: true, lead }
}
