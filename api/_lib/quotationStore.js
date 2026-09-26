// Quotation data layer (ES Module) — per-entry Vercel Blob stores for
// quotation versions and their audit history, following the proven CRM
// patterns in crmStore.js (append-only writes, pre-write-derived mutation
// responses, hardened sequential numbering, lazy derived state).
//
// Storage model:
//   crm/quotations/<stamp>-<id>.json        one blob per quotation VERSION.
//                                           Revisions are separate entries
//                                           sharing the same `number`
//                                           (GML-QT-2026-0018) with
//                                           version/rootId/supersedesId —
//                                           the append-only store preserves
//                                           prior versions for free; only
//                                           the latest version of a chain is
//                                           "current" (supersedesId empty).
//   crm/quotations-history/<stamp>-<id>.json  append-only audit entries —
//                                           separate blobs so a history
//                                           append can never clobber a
//                                           concurrent quotation edit (the
//                                           CRM notes lesson).
//   crm/counters/ids.json                   shared counter blob — quotation
//                                           numbers are kind 'quotations'
//                                           with the same stale-counter
//                                           duplicate protection as leads.
//
// Money: every amount is stored as an INTEGER number of minor units (kobo
// for NGN; the minor-unit exponent ships with the currency). Percentage
// values are integer basis points (1000 bp = 10%). Quantity is a decimal
// STRING (non-monetary, up to 2 dp). All arithmetic is done on integers —
// never on floating-point intermediate values. The formulas here are the
// authoritative server-side mirror of src/lib/money.ts (used for the live
// editor preview); both must stay identical.
import {
  readAll, putEntry, removeEntry, newId, allocateCode,
  readLeads, getLeadById, getClientById, createClient, createActivity, updateLead,
} from './crmStore.js'
import { readContent } from './store.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const fallbackModule = require('../_data/content.json')
const fallbackContent = fallbackModule.default || fallbackModule

const QUOTATIONS_PREFIX = 'crm/quotations/'
const HISTORY_PREFIX = 'crm/quotations-history/'

export const QUOTATION_STATUSES = ['Draft', 'Sent', 'Under Review', 'Accepted', 'Rejected', 'Expired', 'Cancelled']
export const REJECTION_REASONS = ['Budget too high', 'Project postponed', 'Competitor selected', 'Project cancelled', 'Other']
// Statuses that count as "waiting on the client" (Awaiting Response cards).
export const AWAITING_STATUSES = ['Sent', 'Under Review']
// Statuses whose validUntil can lapse into Expired.
const EXPIRABLE_STATUSES = ['Sent', 'Under Review']
// Only drafts are freely editable; anything sent goes through Create Revision.
const EDITABLE_STATUSES = ['Draft']
// History action values (quotation-side audit trail).
export const QUOTATION_ACTIONS = [
  'created', 'edited', 'sent', 'resent', 'status_changed', 'revision_created',
  'accepted', 'rejected', 'cancelled', 'archived', 'unarchived', 'duplicated', 'email_failed',
]

const str = (value, max) => String(value ?? '').trim().slice(0, max)
const iso = (value) => {
  const t = Date.parse(value)
  return Number.isFinite(t) ? new Date(t).toISOString() : ''
}
const dayOf = (value) => (iso(value) ? iso(value).slice(0, 10) : '')
const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
const today = () => new Date().toISOString().slice(0, 10)

// ------------------------------------------------------------ money engine
// Integer math only. See also src/lib/money.ts (frontend mirror).

function parseMinor(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(Math.abs(n))
}

// quantity is a decimal string; qtyBp is the same quantity in hundredths
// (1.00 → 100). Returns the gross (before discount) in minor units.
function lineGross(qtyBp, unitPriceMinor) {
  return Math.round((qtyBp * unitPriceMinor) / 100)
}

// Exported so the money engine can be exercised in isolation (the totals
// aggregator expects pre-normalised lines).
export function normaliseLineItem(input) {
  const quantity = /^(\d{1,4})(\.\d{1,2})?$/.test(String(input.quantity ?? '').trim())
    ? String(input.quantity).trim()
    : '1'
  const qtyBp = Math.round(Number(quantity) * 100) || 100
  const unitPriceMinor = parseMinor(input.unitPriceMinor)
  // Discount: {mode:'percent', bp} or {mode:'fixed', minor}.
  const gross = lineGross(qtyBp, unitPriceMinor)
  let discount = { mode: 'none', bp: 0, minor: 0 }
  if (input.discount?.mode === 'percent' && Number(input.discount.bp) > 0) {
    discount = { mode: 'percent', bp: Math.min(10000, Math.round(Number(input.discount.bp))), minor: 0 }
  } else if (input.discount?.mode === 'fixed' && parseMinor(input.discount.minor) > 0) {
    // A fixed discount can never exceed the line gross (keeps totals ≥ 0).
    discount = { mode: 'fixed', bp: 0, minor: Math.min(gross, parseMinor(input.discount.minor)) }
  }
  let tax = { mode: 'none', bp: 0 }
  if (input.tax?.mode === 'percent' && Number(input.tax.bp) > 0) {
    tax = { mode: 'percent', bp: Math.min(10000, Math.round(Number(input.tax.bp))) }
  }
  const discountValue = discount.mode === 'percent' ? Math.round((gross * discount.bp) / 10000) : discount.mode === 'fixed' ? discount.minor : 0
  const net = Math.max(0, gross - discountValue)
  const taxValue = tax.mode === 'percent' ? Math.round((net * tax.bp) / 10000) : 0
  return {
    id: str(input.id, 40) || newId(),
    description: str(input.description, 300),
    service: { id: str(input.service?.id, 80), title: str(input.service?.title, 120) },
    quantity,
    unit: str(input.unit, 40),
    unitPriceMinor,
    discount,
    tax,
    // Computed totals stored for reporting/sorting; recomputed on every save.
    grossMinor: gross,
    discountMinor: discountValue,
    taxMinor: taxValue,
    totalMinor: net + taxValue,
  }
}

// Quote-level totals. Tax rule (no double taxation, well-defined for any
// mix): a line with its own tax rate pays tax on its own net; the quote-level
// rate applies only to what the lines did NOT already tax (remaining net
// after discounts, plus additional charges).
export function computeTotals(lines, quoteDiscount = { mode: 'none', bp: 0, minor: 0 }, additionalChargesMinor = 0, taxBp = 0) {
  const subtotalMinor = lines.reduce((sum, l) => sum + l.grossMinor, 0)
  const lineDiscountMinor = lines.reduce((sum, l) => sum + l.discountMinor, 0)
  const lineTaxMinor = lines.reduce((sum, l) => sum + (l.taxMinor || 0), 0)
  const taxedLinesNetMinor = lines.reduce((sum, l) => (l.tax && l.tax.mode === 'percent' && l.tax.bp > 0 ? sum + (l.grossMinor - l.discountMinor) : sum), 0)
  const netAfterLines = subtotalMinor - lineDiscountMinor
  const quoteDiscountValue =
    quoteDiscount.mode === 'percent' ? Math.round((netAfterLines * Math.min(10000, Math.max(0, quoteDiscount.bp))) / 10000)
    : quoteDiscount.mode === 'fixed' ? Math.min(netAfterLines, parseMinor(quoteDiscount.minor))
    : 0
  const netMinor = Math.max(0, netAfterLines - quoteDiscountValue)
  const chargesMinor = Math.max(0, parseMinor(additionalChargesMinor))
  const untaxedBaseMinor = Math.max(0, netMinor - taxedLinesNetMinor) + chargesMinor
  const quoteTaxMinor = taxBp > 0 ? Math.round((untaxedBaseMinor * Math.min(10000, taxBp)) / 10000) : 0
  const taxMinor = lineTaxMinor + quoteTaxMinor
  return {
    subtotalMinor,
    lineDiscountMinor,
    quoteDiscountMinor: quoteDiscountValue,
    discountMinor: lineDiscountMinor + quoteDiscountValue,
    additionalChargesMinor: chargesMinor,
    taxBp: Math.min(10000, Math.max(0, Math.round(taxBp))),
    taxMinor,
    grandTotalMinor: netMinor + chargesMinor + taxMinor,
  }
}

function normaliseTotalsInput(input) {
  const qd = input.quoteDiscount || {}
  return {
    quoteDiscount:
      qd.mode === 'percent' && Number(qd.bp) > 0 ? { mode: 'percent', bp: Math.min(10000, Math.round(Number(qd.bp))), minor: 0 }
      : qd.mode === 'fixed' && parseMinor(qd.minor) > 0 ? { mode: 'fixed', bp: 0, minor: parseMinor(qd.minor) }
      : { mode: 'none', bp: 0, minor: 0 },
    additionalChargesMinor: parseMinor(input.additionalChargesMinor),
    taxBp: Math.min(10000, Math.max(0, Math.round(Number(input.taxBp) || 0))),
  }
}

// Currency: per-quotation, editable in the editor. Ships with a small
// preset list; anything custom is accepted as {code, symbol, minorUnits}.
const CURRENCY_PRESETS = [
  { code: 'NGN', symbol: '₦', minorUnits: 2 },
  { code: 'USD', symbol: '$', minorUnits: 2 },
  { code: 'EUR', symbol: '€', minorUnits: 2 },
  { code: 'GBP', symbol: '£', minorUnits: 2 },
  { code: 'GHS', symbol: 'GH₵', minorUnits: 2 },
  { code: 'XOF', symbol: 'CFA', minorUnits: 0 },
]

function normaliseCurrency(input) {
  const code = str(input?.code, 8).toUpperCase() || 'NGN'
  const preset = CURRENCY_PRESETS.find((c) => c.code === code)
  return {
    code,
    symbol: str(input?.symbol, 8) || preset?.symbol || '',
    minorUnits: Math.min(4, Math.max(0, Math.round(Number(input?.minorUnits ?? preset?.minorUnits ?? 2)))),
  }
}

export { CURRENCY_PRESETS }

// ------------------------------------------------------------ normalisation

function normaliseQuotation(input) {
  const lines = (Array.isArray(input.items) ? input.items : [])
    .map(normaliseLineItem)
    .filter((l) => l.description || l.service.id)
  const totalsInput = normaliseTotalsInput(input)
  const totals = computeTotals(lines, totalsInput.quoteDiscount, totalsInput.additionalChargesMinor, totalsInput.taxBp)
  const status = QUOTATION_STATUSES.includes(input.status) ? input.status : 'Draft'
  return {
    // Identity
    number: str(input.number, 40),
    version: Math.max(1, Math.round(Number(input.version) || 1)),
    rootId: str(input.rootId, 80),
    supersedesId: str(input.supersedesId, 80),
    // Client + lead links (snapshots + references — CRM edits never corrupt history)
    client: {
      id: str(input.client?.id, 80),
      code: str(input.client?.code, 40),
      name: str(input.client?.name, 120),
      company: str(input.client?.company, 160),
      email: str(input.client?.email, 200).toLowerCase(),
      phone: str(input.client?.phone, 40),
      address: str(input.client?.address, 300),
    },
    lead: {
      id: str(input.lead?.id, 80),
      code: str(input.lead?.code, 40),
      name: str(input.lead?.name, 120),
    },
    // Dates
    quotationDate: isDay(input.quotationDate) ? input.quotationDate : today(),
    validUntil: isDay(input.validUntil) ? input.validUntil : '',
    // Project
    projectTitle: str(input.projectTitle, 200),
    location: str(input.location, 200),
    // Descriptive sections
    projectDescription: str(input.projectDescription, 5000),
    scopeOfWork: str(input.scopeOfWork, 5000),
    notes: str(input.notes, 3000),
    paymentTerms: str(input.paymentTerms, 2000),
    terms: str(input.terms, 5000),
    preparedBy: str(input.preparedBy, 120),
    // Money
    currency: normaliseCurrency(input.currency),
    items: lines,
    ...totalsInput,
    ...totals,
    // Status
    status,
    rejectionReason: REJECTION_REASONS.includes(input.rejectionReason) ? input.rejectionReason : '',
    rejectionNotes: str(input.rejectionNotes, 1000),
    // Sending interface (no provider this phase)
    sentVia: str(input.sentVia, 40),
    email: {
      to: str(input.email?.to, 500),
      cc: str(input.email?.cc, 500),
      subject: str(input.email?.subject, 300),
      message: str(input.email?.message, 3000),
    },
    // Behaviour flags
    archived: Boolean(input.archived),
    sentAt: iso(input.sentAt),
    acceptedAt: iso(input.acceptedAt),
    rejectedAt: iso(input.rejectedAt),
    cancelledAt: iso(input.cancelledAt),
  }
}

function isValidQuotation(quotation) {
  return Boolean(quotation.client.name && quotation.projectTitle)
}

// ------------------------------------------------------------- read helpers

// Newest first (fixed-width stamp prefix → lexical order), with the computed
// isCurrent flag: a version is current when no other entry in its chain
// supersedes it (revisions carry supersedesId = the version they replace).
async function readAllQuotations() {
  const entries = await readAll(QUOTATIONS_PREFIX)
  const normalised = entries
    .map((entry) => normaliseQuotation(entry))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  const supersededIds = new Set(normalised.map((q) => q.supersedesId).filter(Boolean))
  return normalised.map((q) => ({ ...q, isCurrent: !supersededIds.has(q.id) }))
}

async function readHistory(quotationId) {
  const entries = await readAll(HISTORY_PREFIX)
  return entries
    .filter((h) => h.quotationId === quotationId)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

// The "current" quotation of a chain is the one not superseded by another.
function currentOfChain(quotations) {
  return quotations.find((q) => !q.supersedesId) || quotations[quotations.length - 1]
}

async function writeHistory(quotation, action, detail, { actor = 'Admin' } = {}) {
  const now = new Date().toISOString()
  const entry = {
    id: newId(),
    quotationId: quotation.id,
    quotationNumber: quotation.number,
    quotationVersion: quotation.version,
    action,
    detail: str(detail, 500),
    at: now,
    createdBy: str(actor, 120),
  }
  await putEntry(HISTORY_PREFIX, entry)
  return entry
}

// CRM side-effects: mirror status-relevant events on the linked lead's
// activity timeline (only when the quotation came from a lead).
async function syncLeadActivity(quotation, type, description, { actor = 'Admin' } = {}) {
  if (!quotation.lead?.id) return
  try {
    await createActivity(
      {
        ownerType: 'lead',
        ownerId: quotation.lead.id,
        ownerCode: quotation.lead.code,
        type,
        description,
      },
      { actor },
    )
  } catch {
    // best-effort — the quotation is the source of truth
  }
}

// Keeps the lead's pipeline quotationRef pointing at the latest quotation of
// the chain (field-wise patch through savePipelineData via updateLead — never
// a core-blob rewrite, per the pipeline-split lesson).
async function syncLeadQuotationRef(quotation, { actor = 'Admin' } = {}) {
  if (!quotation.lead?.id) return
  try {
    const lead = await getLeadById(quotation.lead.id)
    if (!lead) return
    const currentRef = lead.quotationRef || { code: '', createdAt: '' }
    // Keep the earliest createdAt for the chain; always point at the newest code.
    const patch = {
      quotationRef: {
        code: quotation.number,
        createdAt: currentRef.createdAt || quotation.createdAt,
      },
    }
    if (currentRef.code !== quotation.number || !currentRef.createdAt) {
      await updateLead(quotation.lead.id, patch, { actor })
    }
  } catch {
    // best-effort
  }
}

// ------------------------------------------------------------ CRUD

export async function readQuotations(params = {}) {
  const all = await readAllQuotations()
  // Only current versions of each chain by default (prior revisions are
  // reachable from the detail page's version list).
  const currentOnly = params.allVersions !== 'true'
  const pool = currentOnly ? all.filter((q) => q.isCurrent !== false) : all

  const query = str(params.query, 120).toLowerCase()
  const toIso = params.to && String(params.to).length === 10 ? `${params.to}T23:59:59.999Z` : params.to
  const amountMin = Number(params.amountMin) || 0
  const amountMax = Number(params.amountMax) || 0
  const expiredAsOf = isDay(params.expiredBefore) ? params.expiredBefore : ''
  const expiredAfter = isDay(params.expiredAfter) ? params.expiredAfter : ''

  const filtered = pool.filter((q) => {
    if (params.status && q.status !== params.status) return false
    if (params.clientId && q.client.id !== params.clientId) return false
    if (params.leadId && q.lead.id !== params.leadId) return false
    if (params.serviceId && !q.items.some((item) => item.service.id === params.serviceId)) return false
    if (params.from && q.quotationDate < params.from) return false
    if (toIso && q.quotationDate > String(toIso).slice(0, 10)) return false
    if (amountMin && q.grandTotalMinor < amountMin) return false
    if (amountMax && q.grandTotalMinor > amountMax) return false
    if (expiredAsOf && !(q.validUntil && q.validUntil < expiredAsOf)) return false
    if (expiredAfter && !(q.validUntil && q.validUntil > expiredAfter)) return false
    if (params.archived === 'true' ? !q.archived : q.archived) return false
    if (query) {
      const haystack = [q.number, q.client.name, q.client.company, q.client.email, q.client.phone, q.client.code, q.projectTitle, q.location, q.preparedBy]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })

  const sorted = sortQuotations(filtered, params.sort)
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 25))
  return {
    quotations: sorted.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
  }
}

function sortQuotations(quotations, sort = 'newest') {
  const byNewest = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt))
  const list = [...quotations]
  switch (sort) {
    case 'oldest':
      return list.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    case 'highest':
      return list.sort((a, b) => b.grandTotalMinor - a.grandTotalMinor || byNewest(a, b))
    case 'lowest':
      return list.sort((a, b) => a.grandTotalMinor - b.grandTotalMinor || byNewest(a, b))
    case 'expiration':
      return list.sort((a, b) => String(a.validUntil || '9999').localeCompare(String(b.validUntil || '9999')) || byNewest(a, b))
    default:
      return list.sort(byNewest)
  }
}

export async function getQuotationById(id) {
  const all = await readAllQuotations()
  const quotation = all.find((q) => q.id === id) || null
  if (!quotation) return null
  const [history, siblings] = await Promise.all([
    readHistory(quotation.id),
    all.filter((q) => q.rootId === quotation.rootId || q.id === quotation.rootId),
  ])
  return {
    quotation,
    history: history.sort((a, b) => String(b.at).localeCompare(String(a.at))),
    versions: siblings
      .sort((a, b) => a.version - b.version)
      .map((v) => ({ id: v.id, version: v.version, status: v.status, createdAt: v.createdAt, grandTotalMinor: v.grandTotalMinor, isCurrent: v.isCurrent !== false })),
  }
}

export async function createQuotation(input, { actor = 'Admin' } = {}) {
  const now = new Date().toISOString()

  // Resolve client: explicit clientId → load; leadId → link (and auto-create
  // the client if the lead is not yet converted — the quotation needs a
  // client for the future PMS chain).
  let client = null
  let lead = null
  if (input.clientId) {
    client = await getClientById(input.clientId)
    if (!client) {
      const error = new Error('Client not found')
      error.status = 404
      throw error
    }
  }
  if (input.leadId) {
    lead = await getLeadById(input.leadId)
    if (!lead) {
      const error = new Error('Lead not found')
      error.status = 404
      throw error
    }
    if (!client) {
      if (lead.clientId) {
        client = await getClientById(lead.clientId)
      } else {
        // Auto-create the client from the lead (convertLead dedupes by
        // email/phone; quotation creation reuses that dedupe by calling it).
        const { convertLead } = await import('./crmStore.js')
        const converted = await convertLead(lead.id, {}, { actor })
        client = converted.client
        lead = converted.lead || lead
      }
    }
  }

  // Resolve service snapshots for line items from the CMS catalogue when the
  // payload only carries ids (no duplication of the service catalogue).
  const services = await readServiceCatalogue()
  const items = (Array.isArray(input.items) ? input.items : []).map((item) => {
    const serviceId = str(item?.service?.id, 80)
    const known = services.find((s) => s.id === serviceId)
    if (known) return { ...item, service: { id: known.id, title: known.title } }
    return item
  })

  const draft = normaliseQuotation({
    ...input,
    items,
    status: 'Draft',
    client: client
      ? {
          id: client.id,
          code: client.code,
          name: client.name,
          company: client.company,
          email: client.email,
          phone: client.phone,
          address: client.address,
        }
      : input.client,
    lead: lead ? { id: lead.id, code: lead.code, name: lead.name } : input.lead,
    preparedBy: input.preparedBy || actor,
  })
  if (!isValidQuotation(draft)) {
    const error = new Error('Client name and project title are required')
    error.status = 400
    throw error
  }

  const quotation = {
    ...draft,
    id: newId(),
    supersedesId: draft.supersedesId || '',
    number: await allocateCode('quotations', 'GML-QT', true, async (code) => {
      const existing = await readAllQuotations()
      return existing.some((q) => q.number === code)
    }),
    createdAt: now,
    updatedAt: now,
  }
  // rootId must exist from v1 — point it at itself.
  quotation.rootId = draft.rootId || quotation.id

  await putEntry(QUOTATIONS_PREFIX, quotation)
  await writeHistory(quotation, 'created', `Quotation created (${quotation.number} · v${quotation.version})`, { actor })
  await syncLeadQuotationRef(quotation, { actor })
  if (quotation.lead.id) {
    await syncLeadActivity(quotation, 'note_added', `Quotation ${quotation.number} drafted for ${formatMajor(quotation)}`, { actor })
  }
  return quotation
}

// Loads the CMS service catalogue (id + title) for line-item dropdowns.
export async function readServiceCatalogue() {
  const content = await readContent(fallbackContent)
  return (Array.isArray(content?.services) ? content.services : []).map((s) => ({ id: s.id, title: s.title }))
}

function formatMajor(quotation) {
  const symbol = quotation.currency.symbol || ''
  return `${symbol}${(quotation.grandTotalMinor / 10 ** quotation.currency.minorUnits).toLocaleString()}`
}

// Patch-in-place. Only Drafts are freely editable; sent quotations must go
// through reviseQuotation (409 otherwise — the PRD's "do not overwrite a
// quotation after it has been sent" rule, enforced server-side).
export async function updateQuotation(id, patch, { actor = 'Admin' } = {}) {
  const all = await readAllQuotations()
  const target = all.find((q) => q.id === id)
  if (!target) return { applied: false }
  if (!EDITABLE_STATUSES.includes(target.status)) {
    const error = new Error(`Only draft quotations can be edited — create a revision of ${target.number} instead`)
    error.status = 409
    throw error
  }
  // Identity, numbering, dates and links are immutable on edit.
  const merged = normaliseQuotation({
    ...target,
    ...patch,
    number: target.number,
    version: target.version,
    rootId: target.rootId,
    supersedesId: target.supersedesId,
    quotationDate: target.quotationDate,
    client: target.client,
    lead: target.lead,
  })
  const next = { ...target, ...merged, id: target.id, createdAt: target.createdAt, updatedAt: new Date().toISOString() }
  if (JSON.stringify(stripVolatile(next)) !== JSON.stringify(stripVolatile(target))) {
    await putEntry(QUOTATIONS_PREFIX, next)
    await writeHistory(next, 'edited', 'Quotation details updated', { actor })
  }
  return { applied: true, quotation: next }
}

function stripVolatile(q) {
  const { updatedAt, ...rest } = q
  return rest
}

// Status transitions. Expired is computed (lazy) but can also be set
// explicitly; Cancelled is allowed from most states; Accepted/Rejected close
// the review. Transitions from terminal states require a revision instead.
const TERMINAL_STATUSES = ['Accepted', 'Rejected', 'Cancelled', 'Expired']

export async function changeStatus(id, statusInput, { actor = 'Admin', reason = '', notes = '', dryRun = false } = {}) {
  const all = await readAllQuotations()
  const target = all.find((q) => q.id === id)
  if (!target) return { applied: false, reason: 'not-found' }
  const status = QUOTATION_STATUSES.includes(statusInput) ? statusInput : ''
  if (!status) {
    const error = new Error('Invalid status')
    error.status = 400
    throw error
  }
  if (status === target.status) return { applied: true, quotation: target, unchanged: true }
  if (TERMINAL_STATUSES.includes(target.status)) {
    const error = new Error(`${target.number} is ${target.status.toLowerCase()} — create a revision instead of changing status`)
    error.status = 409
    throw error
  }
  if (status === 'Rejected' && reason && !REJECTION_REASONS.includes(reason)) {
    const error = new Error('Invalid rejection reason')
    error.status = 400
    throw error
  }

  const now = new Date().toISOString()
  const next = { ...target, status, updatedAt: now }
  if (status === 'Sent') next.sentAt = next.sentAt || now
  if (status === 'Accepted') next.acceptedAt = now
  if (status === 'Rejected') {
    next.rejectedAt = now
    if (reason) next.rejectionReason = reason
    if (notes) next.rejectionNotes = str(notes, 1000)
  }
  if (status === 'Cancelled') next.cancelledAt = now

  if (dryRun) return { applied: true, quotation: next, dryRun: true }

  await putEntry(QUOTATIONS_PREFIX, next)
  await writeHistory(next, status === 'Accepted' ? 'accepted' : status === 'Rejected' ? 'rejected' : status === 'Cancelled' ? 'cancelled' : 'status_changed', `${target.status} → ${status}`, { actor })

  // CRM side-effects (best-effort, after the quotation write).
  if (status === 'Sent') {
    await syncLeadActivity(next, 'quotation_sent', `Quotation ${next.number} sent (${formatMajor(next)})`, { actor })
  } else if (status === 'Accepted') {
    await syncLeadActivity(next, 'note_added', `Quotation ${next.number} accepted (${formatMajor(next)}) — ready for project creation`, { actor })
  } else if (status === 'Rejected') {
    const reasonLabel = next.rejectionReason ? ` — ${next.rejectionReason}` : ''
    await syncLeadActivity(next, 'note_added', `Quotation ${next.number} rejected${reasonLabel}`, { actor })
  }
  return { applied: true, quotation: next }
}

// Create Revision: a new draft entry, same number, version+1, pointing at
// the same root chain. The previous version keeps its own blob untouched.
export async function reviseQuotation(id, { actor = 'Admin' } = {}) {
  const all = await readAllQuotations()
  const target = all.find((q) => q.id === id)
  if (!target) return { applied: false, reason: 'not-found' }
  if (target.status === 'Draft') {
    const error = new Error('This quotation is still a draft — edit it directly instead of creating a revision')
    error.status = 409
    throw error
  }
  const chain = all.filter((q) => q.rootId === target.rootId)
  const latestVersion = Math.max(...chain.map((q) => q.version))
  const previousCurrent = chain.find((q) => q.isCurrent !== false) || target

  const now = new Date().toISOString()
  const revision = {
    ...normaliseQuotation({ ...target, status: 'Draft' }),
    id: newId(),
    rootId: target.rootId,
    supersedesId: previousCurrent.id,
    number: target.number,
    version: latestVersion + 1,
    sentAt: '',
    acceptedAt: '',
    rejectedAt: '',
    cancelledAt: '',
    rejectionReason: '',
    rejectionNotes: '',
    sentVia: '',
    createdAt: now,
    updatedAt: now,
  }
  await putEntry(QUOTATIONS_PREFIX, revision)
  // The forward pointer (revision.supersedesId = previousCurrent.id) is all
  // that is stored; isCurrent is derived on read, so the previous version's
  // blob is never rewritten — one write, truly append-only.
  await writeHistory(revision, 'revision_created', `Version ${revision.version} created from v${previousCurrent.version}`, { actor })
  await syncLeadQuotationRef(revision, { actor })
  return { applied: true, quotation: revision, previousVersion: previousCurrent }
}

// Duplicate → a brand-new draft with a NEW number (no overwrite of the
// original). Works from any state, including expired ones.
export async function duplicateQuotation(id, { actor = 'Admin' } = {}) {
  const all = await readAllQuotations()
  const target = all.find((q) => q.id === id)
  if (!target) return { applied: false, reason: 'not-found' }
  const now = new Date().toISOString()
  const copy = {
    ...normaliseQuotation({ ...target, status: 'Draft' }),
    id: newId(),
    rootId: undefined,
    supersedesId: undefined,
    version: 1,
    sentAt: '',
    acceptedAt: '',
    rejectedAt: '',
    cancelledAt: '',
    rejectionReason: '',
    rejectionNotes: '',
    sentVia: '',
    quotationDate: today(),
    validUntil: '',
    createdAt: now,
    updatedAt: now,
  }
  copy.number = await allocateCode('quotations', 'GML-QT', true, async (code) => {
    const existing = await readAllQuotations()
    return existing.some((q) => q.number === code)
  })
  copy.rootId = copy.id
  await putEntry(QUOTATIONS_PREFIX, copy)
  await writeHistory(copy, 'created', `Duplicated from ${target.number} (v${target.version})`, { actor })
  return { applied: true, quotation: copy, sourceNumber: target.number }
}

export async function setArchived(id, archived, { actor = 'Admin' } = {}) {
  const all = await readAllQuotations()
  const target = all.find((q) => q.id === id)
  if (!target) return { applied: false }
  const next = { ...target, archived: Boolean(archived), updatedAt: new Date().toISOString() }
  await putEntry(QUOTATIONS_PREFIX, next)
  await writeHistory(next, archived ? 'archived' : 'unarchived', archived ? 'Moved to archive' : 'Restored from archive', { actor })
  return { applied: true, quotation: next }
}

// Hard delete exists for data-cleanup/GDPR cases only — the router guards it
// behind an explicit confirm-by-number and it is never surfaced in the UI.
export async function deleteQuotation(id) {
  const all = await readAllQuotations()
  const target = all.find((q) => q.id === id)
  if (!target) return { deleted: false }
  await removeEntry(QUOTATIONS_PREFIX, target)
  const history = await readAll(HISTORY_PREFIX)
  const related = history.filter((h) => h.quotationId === id)
  await Promise.all(related.map((h) => removeEntry(HISTORY_PREFIX, h).catch(() => {})))
  return { deleted: true, deletedHistory: related.length }
}

// ------------------------------------------------------- sending interface

// Records the composed email and marks the quotation Sent. No provider is
// integrated this phase — the response carries emailConfigured: false and the
// UI states that plainly. Internal notes never ride along.
export async function sendQuotation(id, emailInput = {}, { actor = 'Admin', isResend = false } = {}) {
  const all = await readAllQuotations()
  const target = all.find((q) => q.id === id)
  if (!target) return { applied: false, reason: 'not-found' }
  if (TERMINAL_STATUSES.includes(target.status)) {
    const error = new Error(`${target.number} is ${target.status.toLowerCase()} — create a revision to send a new version`)
    error.status = 409
    throw error
  }

  const now = new Date().toISOString()
  const email = {
    to: str(emailInput.to, 500),
    cc: str(emailInput.cc, 500),
    subject: str(emailInput.subject || `Quotation ${target.number} — ${target.projectTitle}`, 300),
    message: str(emailInput.message, 3000),
  }
  if (!email.to) {
    const error = new Error('Recipient email is required')
    error.status = 400
    throw error
  }

  const wasSent = Boolean(target.sentAt)
  const next = {
    ...target,
    // First send flips the status; a resend keeps the current state.
    status: wasSent && isResend ? target.status : 'Sent',
    sentAt: target.sentAt || now,
    sentVia: 'email-interface',
    email,
    updatedAt: now,
  }
  await putEntry(QUOTATIONS_PREFIX, next)
  await writeHistory(next, wasSent && isResend ? 'resent' : 'sent', `Email interface → ${email.to}${email.cc ? ` (cc: ${email.cc})` : ''} — provider not configured yet`, { actor })
  if (!wasSent) {
    await syncLeadActivity(next, 'quotation_sent', `Quotation ${next.number} sent (${formatMajor(next)})`, { actor })
  }
  return { applied: true, quotation: next, emailConfigured: false }
}

// ------------------------------------------------------------- expiration
// Lazy: on read, Sent/Under Review quotations past validUntil move to
// Expired (persisted once, with a history entry). No cron needed.

async function applyExpiration(quotations) {
  const t = today()
  const due = quotations.filter((q) => EXPIRABLE_STATUSES.includes(q.status) && q.validUntil && q.validUntil < t)
  for (const quotation of due) {
    try {
      await changeStatus(quotation.id, 'Expired', { actor: 'System' })
    } catch {
      // best-effort; it will retry on the next read
    }
  }
  return due.length
}

// List wrapper that lazily expires first, then reads (used by the router so
// dashboard, lists and detail all agree).
export async function readQuotationsWithExpiration(params = {}) {
  const all = await readAllQuotations()
  const expired = await applyExpiration(all)
  const result = await readQuotations(params)
  return { ...result, newlyExpired: expired }
}

export async function getQuotationByIdWithExpiration(id) {
  const all = await readAllQuotations()
  await applyExpiration(all)
  return getQuotationById(id)
}

// -------------------------------------------------------------- dashboard

export async function getQuotationDashboard() {
  const all = await readAllQuotations()
  await applyExpiration(all)
  const fresh = await readAllQuotations()
  const current = fresh.filter((q) => q.isCurrent !== false && !q.archived)

  const byStatus = (status) => current.filter((q) => q.status === status)
  const awaiting = byStatus('Sent').concat(byStatus('Under Review'))
  const byRecency = (list, field) =>
    [...list].sort((a, b) => String(b[field] || b.createdAt).localeCompare(String(a[field] || a.createdAt)))

  return {
    cards: {
      total: current.length,
      draft: byStatus('Draft').length,
      sent: byStatus('Sent').length,
      underReview: byStatus('Under Review').length,
      accepted: byStatus('Accepted').length,
      rejected: byStatus('Rejected').length,
      expired: byStatus('Expired').length,
      cancelled: byStatus('Cancelled').length,
      awaitingResponse: awaiting.length,
      acceptedValueMinor: byStatus('Accepted').reduce((sum, q) => sum + q.grandTotalMinor, 0),
    },
    recentQuotations: current.slice(0, 6),
    awaitingResponse: byRecency(awaiting, 'sentAt').slice(0, 6),
    recentlyAccepted: byRecency(byStatus('Accepted'), 'acceptedAt').slice(0, 4),
    recentlyRejected: byRecency(byStatus('Rejected'), 'rejectedAt').slice(0, 4),
  }
}

// --------------------------------------------------------- CRM list views

// Quotations shown on a lead profile (all current + prior versions of this
// lead's chains, newest first).
export async function listQuotationsByLead(leadId) {
  const all = await readAllQuotations()
  return all
    .filter((q) => q.lead.id === leadId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export async function listQuotationsByClient(clientId) {
  const all = await readAllQuotations()
  return all
    .filter((q) => q.client.id === clientId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

// -------------------------------------------------- accepted → next phase

// Integration point for the future Project Management System: prepares the
// handoff payload and stamps the linked lead's projectRef. The PMS itself is
// a later module — nothing else happens here.
export async function prepareProjectHandoff(id, { actor = 'Admin' } = {}) {
  const all = await readAllQuotations()
  const target = all.find((q) => q.id === id)
  if (!target) return { applied: false, reason: 'not-found' }
  if (target.status !== 'Accepted') {
    const error = new Error('Only accepted quotations can create a project')
    error.status = 409
    throw error
  }
  const handoff = {
    quotationId: target.id,
    quotationNumber: target.number,
    version: target.version,
    client: target.client,
    lead: target.lead,
    project: {
      title: target.projectTitle,
      location: target.location,
      description: target.projectDescription,
      scopeOfWork: target.scopeOfWork,
      services: target.items.map((item) => ({ id: item.service.id, title: item.service.title })).filter((s) => s.id),
    },
    finance: {
      currency: target.currency,
      grandTotalMinor: target.grandTotalMinor,
      paymentTerms: target.paymentTerms,
    },
    preparedBy: target.preparedBy,
    acceptedAt: target.acceptedAt,
  }
  // Stamp the lead's projectRef (pipeline blob — never the core record) so
  // the CRM shows the handoff happened. Light reference only.
  if (target.lead.id) {
    try {
      await updateLead(target.lead.id, { projectRef: { id: target.id, title: `${target.number} — ${target.projectTitle}` } }, { actor })
    } catch {
      // best-effort
    }
  }
  await writeHistory(target, 'status_changed', 'Project handoff prepared (PMS integration point)', { actor })
  return { applied: true, handoff }
}
