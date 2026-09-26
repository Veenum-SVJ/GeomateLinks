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

function newId() {
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
async function readAll(prefix) {
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

async function putEntry(prefix, entry) {
  await put(entryPathname(prefix, entry), JSON.stringify(entry, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  })
}

async function removeEntry(prefix, entry) {
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
// read-modify-write on one small blob with retry — safe for a single-admin
// tool; codes are never reused even if a rare concurrent allocation retries.
async function allocateCode(kind, prefix, withYear) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const counter = await readCounter()
      const next = (Number(counter.counts[kind]) || 0) + 1
      const code = withYear
        ? `${prefix}-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`
        : `${prefix}-${String(next).padStart(4, '0')}`
      await put(COUNTER_BLOB, JSON.stringify({ counts: { ...counter.counts, [kind]: next } }, null, 2), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        cacheControlMaxAge: 0,
      })
      return code
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
  return readAll(LEADS_PREFIX)
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
    code: await allocateCode('leads', 'GML', true),
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

// Patch-in-place. Returns the updated lead derived from the pre-write read —
// never a read-after-write. Status changes are audited on the lead timeline
// and in the dashboard activity feed. clientId/convertedAt are protected
// from ordinary PATCHes (they change only via convertLead, which passes
// allowProtected) so an edited form can never unlink a converted lead.
export async function updateLead(id, patch, { actor = 'Admin', allowProtected = false } = {}) {
  const leads = await readAllLeads()
  const target = leads.find((l) => l.id === id)
  if (!target) return { applied: false, leads }
  const clean = normaliseLead({ ...target, ...patch })
  const next = { ...target, ...clean, id: target.id, code: target.code, createdAt: target.createdAt, updatedAt: new Date().toISOString() }
  // normaliseLead does not carry clientId/convertedAt, so overlay them from
  // the patch explicitly. Only convertLead (allowProtected) may change them;
  // ordinary PATCHes keep the stored values.
  if (patch.clientId !== undefined || patch.convertedAt !== undefined) {
    if (allowProtected) {
      if (patch.clientId !== undefined) next.clientId = str(patch.clientId, 80)
      if (patch.convertedAt !== undefined) next.convertedAt = iso(patch.convertedAt)
    } else {
      next.clientId = target.clientId
      next.convertedAt = target.convertedAt
    }
  }
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
  return { applied: true, lead: next, leads: leads.map((l) => (l.id === id ? next : l)) }
}

export async function deleteLead(id) {
  const leads = await readAllLeads()
  const target = leads.find((l) => l.id === id)
  if (!target) return { deleted: false }
  await removeEntry(LEADS_PREFIX, target)
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
    { actor, allowProtected: true },
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
    code: await allocateCode('clients', 'CLI', false),
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
