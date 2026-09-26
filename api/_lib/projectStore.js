// Project data layer (ES Module) — the Project Management System's records,
// following the proven per-entry Vercel Blob patterns in crmStore.js and
// quotationStore.js (append-only writes, pre-write-derived mutation
// responses, hardened sequential numbering, best-effort CRM side-effects).
//
// Storage model:
//   crm/projects/<stamp>-<id>.json          one blob per PROJECT. Tasks,
//                                           milestones, team, deliverables,
//                                           phases and the embedded audit
//                                           history live ON the project
//                                           blob (single-admin CMS; keeps
//                                           the detail page one read).
//   crm/project-activities/<stamp>-<id>.json  append-only TIMELINE entries,
//                                           one blob each (the QMS history
//                                           lesson: an append can never
//                                           clobber a concurrent project
//                                           edit). Cross-project recent
//                                           activity reads this prefix.
//   crm/staff/<stamp>-<id>.json             the staff/team directory (no
//                                           logins — names, roles, contact).
//   crm/counters/ids.json                   shared counter — project numbers
//                                           are kind 'projects' (GML-PRJ).
//
// Relationships: projects reference client/lead/quotation/service by id and
// keep a light denormalised snapshot (names/contacts) so deleting or editing
// a CRM record never corrupts project history. Quotation VALUES are
// snapshotted for display only — the quotation record itself is never copied.
// Publication to the public portfolio is metadata on the project; the actual
// SiteContent write goes through the existing admin content flow.
import {
  readAll, putEntry, removeEntry, newId, allocateCode,
  getLeadById, getClientById, updateLead, createActivity,
} from './crmStore.js'
import { getQuotationById } from './quotationStore.js'

const PROJECTS_PREFIX = 'crm/projects/'
const ACTIVITIES_PREFIX = 'crm/project-activities/'
const STAFF_PREFIX = 'crm/staff/'

// ------------------------------------------------------------- vocabulary

export const PROJECT_STATUSES = [
  'Planning', 'Scheduled', 'Field Work', 'Processing', 'Quality Control',
  'Awaiting Delivery', 'Completed', 'On Hold', 'Cancelled', 'Archived',
]
// The seven working statuses before the terminal ones.
export const ACTIVE_PROJECT_STATUSES = ['Planning', 'Scheduled', 'Field Work', 'Processing', 'Quality Control', 'Awaiting Delivery']
export const STATUS_PROGRESS_DEFAULTS = {
  Planning: 10, Scheduled: 20, 'Field Work': 40, Processing: 60,
  'Quality Control': 80, 'Awaiting Delivery': 90, Completed: 100,
}
export const DEFAULT_PHASES = ['Planning', 'Field Work', 'Data Processing', 'Quality Control', 'Deliverables', 'Completion']
export const PROJECT_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent']
export const PROJECT_TYPES = [
  'Topographical Survey', 'Boundary/Cadastral Survey', 'Engineering Survey',
  'Drone Mapping', 'GIS Project', 'Digitization', 'Hydrographic Survey',
  'Training', 'Other',
]
export const TASK_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Blocked', 'Cancelled']
export const MILESTONE_STATUSES = ['Upcoming', 'In Progress', 'Completed']
export const DELIVERABLE_STATUSES = ['Pending', 'In Progress', 'Ready', 'Delivered']
export const STAFF_STATUSES = ['Active', 'Inactive']
// Embedded audit actions (history on the project blob).
export const PROJECT_ACTIONS = [
  'created', 'edited', 'status_changed', 'progress_updated', 'completed',
  'archived', 'restored', 'published', 'unpublished', 'team_added',
  'team_removed', 'task_created', 'task_updated', 'task_completed',
  'milestone_completed', 'deliverable_updated',
]
// Timeline activity types (separate append-only blobs).
export const PROJECT_ACTIVITY_TYPES = [
  'project_created', 'status_changed', 'progress_updated', 'note_added',
  'task_created', 'task_completed', 'milestone_completed', 'team_added',
  'team_removed', 'quotation_linked', 'published',
]

const str = (value, max) => String(value ?? '').trim().slice(0, max)
const iso = (value) => {
  const t = Date.parse(value)
  return Number.isFinite(t) ? new Date(t).toISOString() : ''
}
const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
const today = () => new Date().toISOString().slice(0, 10)
const intOf = (value, fallback = 0) => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? n : fallback
}

// ------------------------------------------------------- normalisation

function normaliseLocation(input) {
  // A plain string location (e.g. the quotation handoff's single-line
  // location) becomes the description until the administrator structures it.
  if (typeof input === 'string') input = { description: input }
  const latRaw = Number(input?.lat)
  const lonRaw = Number(input?.lon)
  const lat = Number.isFinite(latRaw) && input?.lat !== '' && input?.lat !== null && input?.lat !== undefined ? latRaw : null
  const lon = Number.isFinite(lonRaw) && input?.lon !== '' && input?.lon !== null && input?.lon !== undefined ? lonRaw : null
  return {
    address: str(input?.address, 200),
    area: str(input?.area, 120),
    city: str(input?.city, 120),
    state: str(input?.state, 120),
    country: str(input?.country, 120),
    lat,
    lon,
    description: str(input?.description, 500),
  }
}

function normalisePhases(input) {
  const list = (Array.isArray(input) ? input : [])
    .map((p) => str(p, 60))
    .filter(Boolean)
  return list.length > 0 ? list.slice(0, 12) : [...DEFAULT_PHASES]
}

function normaliseTask(input) {
  const status = TASK_STATUSES.includes(input?.status) ? input.status : 'Not Started'
  return {
    id: str(input?.id, 40) || newId(),
    name: str(input?.name, 200),
    description: str(input?.description, 2000),
    phase: str(input?.phase, 60),
    status,
    priority: PROJECT_PRIORITIES.includes(input?.priority) ? input.priority : 'Normal',
    assigneeStaffId: str(input?.assigneeStaffId, 80),
    assigneeName: str(input?.assigneeName, 120),
    startDate: isDay(input?.startDate) ? input.startDate : '',
    dueDate: isDay(input?.dueDate) ? input.dueDate : '',
    completedAt: status === 'Completed' ? iso(input?.completedAt) || new Date().toISOString() : '',
    notes: str(input?.notes, 1000),
    createdAt: iso(input?.createdAt) || new Date().toISOString(),
  }
}

function normaliseMilestone(input) {
  const status = MILESTONE_STATUSES.includes(input?.status) ? input.status : 'Upcoming'
  return {
    id: str(input?.id, 40) || newId(),
    name: str(input?.name, 200),
    description: str(input?.description, 1000),
    dueDate: isDay(input?.dueDate) ? input.dueDate : '',
    status,
    completedAt: status === 'Completed' ? iso(input?.completedAt) || new Date().toISOString() : '',
    notes: str(input?.notes, 1000),
    createdAt: iso(input?.createdAt) || new Date().toISOString(),
  }
}

function normaliseDeliverable(input) {
  const status = DELIVERABLE_STATUSES.includes(input?.status) ? input.status : 'Pending'
  return {
    id: str(input?.id, 40) || newId(),
    name: str(input?.name, 200),
    description: str(input?.description, 1000),
    expectedDate: isDay(input?.expectedDate) ? input.expectedDate : '',
    status,
    deliveredAt: status === 'Delivered' ? iso(input?.deliveredAt) || new Date().toISOString() : '',
    notes: str(input?.notes, 500),
    // Placeholder for the future Document Management System — metadata only.
    attachments: [],
    createdAt: iso(input?.createdAt) || new Date().toISOString(),
  }
}

function normaliseTeamMember(input) {
  return {
    id: str(input?.id, 40) || newId(),
    staffId: str(input?.staffId, 80),
    name: str(input?.name, 120),
    role: str(input?.role, 120),
    isManager: Boolean(input?.isManager),
    addedAt: iso(input?.addedAt) || new Date().toISOString(),
  }
}

function normalisePublication(input) {
  return {
    published: Boolean(input?.published),
    portfolioProjectId: str(input?.portfolioProjectId, 80),
    publishedAt: iso(input?.publishedAt),
    title: str(input?.title, 120),
    category: str(input?.category, 120),
    location: str(input?.location, 160),
    completionYear: str(input?.completionYear, 10),
    image: str(input?.image, 1000),
    thumb: str(input?.thumb, 1000),
    alt: str(input?.alt, 200),
    description: str(input?.description, 2000),
  }
}

function normaliseProject(input) {
  const status = PROJECT_STATUSES.includes(input.status) ? input.status : 'Planning'
  const phases = normalisePhases(input.phases)
  // Progress: the status default applies unless an administrator set a
  // manual percentage. A stored record always carries the flag explicitly;
  // at creation time (flag absent) an explicit value differing from the
  // default IS a manual choice. When not overridden, the current status's
  // default always wins — so status changes keep advancing progress.
  const progressRaw = intOf(input.progressPct, -1)
  const defaultPct = STATUS_PROGRESS_DEFAULTS[status] ?? 0
  const progressOverridden = input.progressOverridden === undefined
    ? progressRaw >= 0 && progressRaw !== defaultPct
    : Boolean(input.progressOverridden)
  const progressPct = progressOverridden && progressRaw >= 0 ? Math.min(100, Math.max(0, progressRaw)) : defaultPct
  const progress = { progressPct, progressOverridden }
  const tasks = (Array.isArray(input.tasks) ? input.tasks : []).map(normaliseTask).filter((t) => t.name)
  const milestones = (Array.isArray(input.milestones) ? input.milestones : []).map(normaliseMilestone).filter((m) => m.name)
  const deliverables = (Array.isArray(input.deliverables) ? input.deliverables : []).map(normaliseDeliverable).filter((d) => d.name)
  const team = (Array.isArray(input.team) ? input.team : []).map(normaliseTeamMember).filter((m) => m.name)
  return {
    number: str(input.number, 40),
    title: str(input.title, 200),
    status,
    ...progress,
    currentPhase: str(input.currentPhase, 60) || phases[0],
    phases,
    priority: PROJECT_PRIORITIES.includes(input.priority) ? input.priority : 'Normal',
    projectType: str(input.projectType, 120),
    // CRM/QMS references + snapshots (see file header — never deep copies).
    client: {
      id: str(input.client?.id, 80),
      code: str(input.client?.code, 40),
      name: str(input.client?.name, 120),
      company: str(input.client?.company, 160),
      email: str(input.client?.email, 200).toLowerCase(),
      phone: str(input.client?.phone, 40),
    },
    lead: { id: str(input.lead?.id, 80), code: str(input.lead?.code, 40), name: str(input.lead?.name, 120) },
    quotation: { id: str(input.quotation?.id, 80), number: str(input.quotation?.number, 40), acceptedAt: iso(input.quotation?.acceptedAt) },
    service: { id: str(input.service?.id, 80), title: str(input.service?.title, 120) },
    // Finance snapshot (display only — the quotation stays the source of truth).
    quotedValueMinor: intOf(input.quotedValueMinor, 0),
    currency: {
      code: str(input.currency?.code, 8) || 'NGN',
      symbol: str(input.currency?.symbol, 8) || '₦',
      minorUnits: Math.min(4, Math.max(0, intOf(input.currency?.minorUnits, 2))),
    },
    paymentTerms: str(input.paymentTerms, 2000),
    // Content
    description: str(input.description, 5000),
    objectives: str(input.objectives, 5000),
    internalNotes: str(input.internalNotes, 3000),
    clientFacingSummary: str(input.clientFacingSummary, 2000),
    completionSummary: str(input.completionSummary, 5000),
    location: normaliseLocation(input.location),
    // Dates
    startDate: isDay(input.startDate) ? input.startDate : '',
    expectedCompletionDate: isDay(input.expectedCompletionDate) ? input.expectedCompletionDate : '',
    actualCompletionDate: isDay(input.actualCompletionDate) ? input.actualCompletionDate : '',
    // Team
    team,
    managerMemberId: str(input.managerMemberId, 40),
    // Embedded records
    tasks,
    milestones,
    deliverables,
    history: Array.isArray(input.history) ? input.history.slice(0, 500) : [],
    // Publication + future-module placeholders
    publication: normalisePublication(input.publication),
    // equipmentIds: reserved for the future Equipment Management System.
    equipmentIds: Array.isArray(input.equipmentIds) ? input.equipmentIds.slice(0, 200) : [],
    archived: Boolean(input.archived),
  }
}

function isValidProject(project) {
  return Boolean(project.title && project.client.id)
}

// ------------------------------------------------------- read helpers

async function readAllProjects() {
  const entries = await readAll(PROJECTS_PREFIX)
  return entries
    .map((entry) => normaliseProject(entry))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

async function readProjectActivities(projectId) {
  const entries = await readAll(ACTIVITIES_PREFIX)
  return entries
    .filter((a) => !projectId || a.projectId === projectId)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

async function writeHistory(project, action, detail, { actor = 'Admin' } = {}) {
  const entry = {
    id: newId(),
    action,
    detail: str(detail, 500),
    at: new Date().toISOString(),
    createdBy: str(actor, 120),
  }
  project.history = [entry, ...(project.history || [])].slice(0, 500)
  return entry
}

// Timeline entries live in their own blobs so an append can never clobber a
// concurrent project edit (and the dashboard can read recent activity across
// projects without opening every project blob).
async function writeActivity(project, type, description, { actor = 'Admin', progressPct } = {}) {
  const now = new Date().toISOString()
  const activity = {
    id: newId(),
    projectId: project.id,
    projectNumber: project.number,
    projectTitle: project.title,
    type: PROJECT_ACTIVITY_TYPES.includes(type) ? type : 'note_added',
    description: str(description, 2000),
    progressPct: progressPct === undefined ? null : Math.min(100, Math.max(0, intOf(progressPct, 0))),
    at: now,
    createdBy: str(actor, 120),
    createdAt: now,
  }
  await putEntry(ACTIVITIES_PREFIX, activity).catch(() => {})
  return activity
}

// Best-effort CRM side-effect: mirror key project events on the linked
// lead's activity timeline.
async function syncLeadActivity(project, type, description, { actor = 'Admin' } = {}) {
  if (!project.lead.id) return
  try {
    await createActivity(
      { ownerType: 'lead', ownerId: project.lead.id, ownerCode: project.lead.code, type, description },
      { actor },
    )
  } catch {
    // best-effort — the project record is the source of truth
  }
}

// Derived/computed view of a project for the UI: overdue flags, task counts,
// outstanding lists for the completion dialog, alert flags.
function withComputed(project) {
  const t = today()
  const openTasks = project.tasks.filter((task) => task.status !== 'Completed' && task.status !== 'Cancelled')
  const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < t)
  const openMilestones = project.milestones.filter((m) => m.status !== 'Completed')
  const overdueMilestones = openMilestones.filter((m) => m.dueDate && m.dueDate < t)
  const pendingDeliverables = project.deliverables.filter((d) => d.status !== 'Delivered')
  const isTerminal = project.status === 'Completed' || project.status === 'Cancelled'
  const isActive = ACTIVE_PROJECT_STATUSES.includes(project.status) && !project.archived
  const overdueProject = isActive && project.expectedCompletionDate && project.expectedCompletionDate < t
  const dueSoon = isActive && project.expectedCompletionDate && project.expectedCompletionDate >= t &&
    project.expectedCompletionDate <= new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  const stalled = isActive && project.updatedAt && (Date.now() - Date.parse(project.updatedAt)) > 21 * 86400000
  return {
    ...project,
    computed: {
      tasksTotal: project.tasks.length,
      tasksOpen: openTasks.length,
      tasksCompleted: project.tasks.filter((task) => task.status === 'Completed').length,
      tasksOverdue: overdueTasks.length,
      milestonesOverdue: overdueMilestones.length,
      deliverablesPending: pendingDeliverables.length,
      isTerminal,
      isActive,
      isOverdue: overdueProject,
      isDueSoon: dueSoon,
      isStalled: stalled,
      outstanding: { tasks: openTasks, milestones: openMilestones, deliverables: pendingDeliverables },
      manager: project.team.find((m) => m.id === project.managerMemberId) || project.team.find((m) => m.isManager) || null,
    },
  }
}

// Exported pure derivations for unit tests (scripts/pmsLogicTests.mjs) —
// normalisation, progress defaults and alert computation without Blob access.
export const _normaliseProject = normaliseProject
export const _withComputed = withComputed

// ------------------------------------------------------------ CRUD

function sortProjects(projects, sort = 'newest') {
  const byNewest = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt))
  const list = [...projects]
  switch (sort) {
    case 'oldest':
      return list.sort(byNewest)
    case 'deadline':
      return list.sort((a, b) => String(a.expectedCompletionDate || '9999').localeCompare(String(b.expectedCompletionDate || '9999')) || byNewest(a, b))
    case 'progress':
      return list.sort((a, b) => b.progressPct - a.progressPct || byNewest(a, b))
    case 'priority':
      return list.sort((a, b) => PROJECT_PRIORITIES.indexOf(b.priority) - PROJECT_PRIORITIES.indexOf(a.priority) || byNewest(a, b))
    case 'title':
      return list.sort((a, b) => a.title.localeCompare(b.title))
    default:
      return list.sort(byNewest)
  }
}

export async function readProjects(params = {}) {
  const all = await readAllProjects()
  const pool = params.archived === 'true' ? all.filter((p) => p.archived) : all.filter((p) => !p.archived)
  const query = str(params.query, 120).toLowerCase()
  const filtered = pool.filter((p) => {
    if (params.status && p.status !== params.status) return false
    if (params.serviceId && p.service.id !== params.serviceId) return false
    if (params.clientId && p.client.id !== params.clientId) return false
    if (params.quotationId && p.quotation.id !== params.quotationId) return false
    if (params.leadId && p.lead.id !== params.leadId) return false
    if (params.priority && p.priority !== params.priority) return false
    if (params.projectType && p.projectType !== params.projectType) return false
    if (params.managerStaffId && !p.team.some((m) => m.staffId === params.managerStaffId && (m.isManager || m.id === p.managerMemberId))) return false
    if (params.staffId && !p.team.some((m) => m.staffId === params.staffId)) return false
    if (params.from && p.startDate && p.startDate < params.from) return false
    if (params.to && p.startDate && p.startDate > params.to) return false
    if (params.query) {
      // PRD §30: number, title, client, location, service, manager, staff,
      // quotation number.
      const manager = p.team.find((m) => m.id === p.managerMemberId || m.isManager)
      const haystack = [p.number, p.title, p.client.name, p.client.company, p.client.code, p.location.city, p.location.state, p.location.area, p.location.address, p.service.title, p.projectType, p.quotation.number, manager?.name, p.team.map((m) => m.name).join(' ')]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
  const sorted = sortProjects(filtered, params.sort)
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 25))
  return {
    projects: sorted.slice((page - 1) * pageSize, page * pageSize).map(withComputed),
    total: filtered.length,
    page,
    pageSize,
  }
}

export async function getProjectById(id) {
  const all = await readAllProjects()
  const project = all.find((p) => p.id === id)
  if (!project) return null
  const activities = await readProjectActivities(id)
  return { project: withComputed(project), activities }
}

export async function createProject(input, { actor = 'Admin' } = {}) {
  // Resolve the client (required). A lead may imply the client.
  let client = null
  if (input.clientId) {
    client = await getClientById(input.clientId)
    if (!client) {
      const error = new Error('Client not found')
      error.status = 404
      throw error
    }
  }
  let lead = null
  if (input.leadId) {
    lead = await getLeadById(input.leadId)
    if (!lead) {
      const error = new Error('Lead not found')
      error.status = 404
      throw error
    }
    if (!client && lead.clientId) client = await getClientById(lead.clientId)
  }
  if (!client) {
    const error = new Error('A project needs a client — select or create one in the CRM first')
    error.status = 400
    throw error
  }

  // Quotation link (optional but the primary path): must be Accepted and not
  // already used by another project — one project per quotation.
  let quotation = null
  if (input.quotationId) {
    const detail = await getQuotationById(input.quotationId)
    quotation = detail?.quotation || null
    if (!quotation) {
      const error = new Error('Quotation not found')
      error.status = 404
      throw error
    }
    if (quotation.status !== 'Accepted') {
      const error = new Error('Only accepted quotations can create a project')
      error.status = 409
      throw error
    }
    const existing = await readAllProjects()
    if (existing.some((p) => p.quotation.id === quotation.id && !p.archived)) {
      const error = new Error(`A project already exists for quotation ${quotation.number}`)
      error.status = 409
      throw error
    }
  }

  // Resolve team members from the staff directory where ids were given.
  const staff = await readStaff()
  const resolveMember = (m) => {
    const member = normaliseTeamMember(m)
    const known = member.staffId ? staff.find((s) => s.id === member.staffId) : null
    return known
      ? { ...member, name: known.name, role: member.role || known.role }
      : member
  }
  const team = (Array.isArray(input.team) ? input.team : []).map(resolveMember)
  const managerCandidate = team.find((m) => m.isManager || m.id === input.managerMemberId)

  const services = quotation
    ? quotation.items.map((item) => ({ id: item.service.id, title: item.service.title })).filter((s) => s.id)
    : []
  const serviceSnapshot = input.serviceId
    ? { id: str(input.serviceId, 80), title: str(input.serviceTitle, 120) }
    : services[0] || { id: str(input.service?.id, 80), title: str(input.service?.title, 120) }

  const draft = normaliseProject({
    ...input,
    title: input.title || quotation?.projectTitle || '',
    status: input.status || 'Planning',
    currentPhase: input.currentPhase || 'Planning',
    description: input.description || quotation?.projectDescription || '',
    // The quotation's scope of work seeds the project objectives.
    objectives: input.objectives || quotation?.scopeOfWork || '',
    location: input.location && Object.keys(input.location).length ? input.location : { description: quotation?.location || '' },
    service: serviceSnapshot,
    team,
    managerMemberId: input.managerMemberId || managerCandidate?.id || '',
    tasks: Array.isArray(input.tasks) ? input.tasks.map(resolveTaskNames(staff)) : [],
    client: {
      id: client.id,
      code: client.code,
      name: client.name,
      company: client.company,
      email: client.email,
      phone: client.phone,
    },
    lead: lead ? { id: lead.id, code: lead.code, name: lead.name } : input.lead,
    quotation: quotation
      ? { id: quotation.id, number: quotation.number, acceptedAt: quotation.acceptedAt }
      : { id: '', number: '', acceptedAt: '' },
    quotedValueMinor: input.quotedValueMinor ?? quotation?.grandTotalMinor ?? 0,
    currency: input.currency ?? quotation?.currency ?? { code: 'NGN', symbol: '₦', minorUnits: 2 },
    paymentTerms: input.paymentTerms ?? quotation?.paymentTerms ?? '',
  })
  if (!isValidProject(draft)) {
    const error = new Error('Project title and a client are required')
    error.status = 400
    throw error
  }

  const now = new Date().toISOString()
  const project = {
    ...draft,
    id: newId(),
    number: await allocateCode('projects', 'GML-PRJ', true, async (code) => {
      const existing = await readAllProjects()
      return existing.some((p) => p.number === code)
    }),
    createdAt: now,
    updatedAt: now,
  }
  await writeHistory(project, 'created', `Project created${quotation ? ` from quotation ${quotation.number}` : ''}`, { actor })
  await putEntry(PROJECTS_PREFIX, project)
  await writeActivity(project, 'project_created', `Project created — ${project.title}${quotation ? ` (from ${quotation.number})` : ''}`, { actor, progressPct: project.progressPct })

  // CRM + QMS side-effects (best-effort, after the project write).
  if (lead) {
    try {
      await updateLead(lead.id, { projectRef: { id: project.id, title: `${project.number} — ${project.title}` } }, { actor })
    } catch { /* best-effort */ }
    await syncLeadActivity(project, 'project_created', `Project ${project.number} created for ${project.title}`, { actor })
  }
  if (quotation) {
    await writeActivity(project, 'quotation_linked', `Quotation ${quotation.number} linked (${formatValue(project)})`, { actor })
    await syncLeadActivity(project, 'note_added', `Quotation ${quotation.number} became project ${project.number}`, { actor })
  }
  return project
}

// Task-name resolver used at creation: fill assigneeName from the staff
// directory when the payload only carries ids.
function resolveTaskNames(staff) {
  return (task) => {
    const normalised = normaliseTask(task)
    if (normalised.assigneeStaffId && !normalised.assigneeName) {
      const known = staff.find((s) => s.id === normalised.assigneeStaffId)
      if (known) normalised.assigneeName = known.name
    }
    return normalised
  }
}

function formatValue(project) {
  const symbol = project.currency.symbol || ''
  return `${symbol}${(project.quotedValueMinor / 10 ** project.currency.minorUnits).toLocaleString()}`
}

async function loadForMutation(id) {
  const all = await readAllProjects()
  const project = all.find((p) => p.id === id)
  if (!project) return null
  return project
}

async function saveMutated(project, { actor, activityType, activityDescription, progressPct } = {}) {
  project.updatedAt = new Date().toISOString()
  await putEntry(PROJECTS_PREFIX, project)
  if (activityType) {
    await writeActivity(project, activityType, activityDescription || '', { actor, progressPct })
  }
  return project
}

// General edit — identity, numbering, CRM/QMS links and finance snapshots are
// immutable here (they are set at creation and owned by their modules).
const EDITABLE_FIELDS = ['title', 'projectType', 'priority', 'description', 'objectives', 'internalNotes', 'clientFacingSummary', 'completionSummary', 'location', 'startDate', 'expectedCompletionDate', 'phases', 'currentPhase', 'service', 'paymentTerms']

export async function updateProject(id, patch, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  if (patch.status && patch.status !== project.status) {
    const error = new Error('Use the status action to change a project status')
    error.status = 409
    throw error
  }
  const mergedInput = { ...project }
  for (const field of EDITABLE_FIELDS) {
    if (patch[field] !== undefined) mergedInput[field] = patch[field]
  }
  if (patch.managerMemberId !== undefined) mergedInput.managerMemberId = str(patch.managerMemberId, 40)
  const merged = normaliseProject(mergedInput)
  const next = { ...project, ...merged, id: project.id, number: project.number, createdAt: project.createdAt }
  const changed = JSON.stringify({ ...next, updatedAt: '' }) !== JSON.stringify({ ...project, updatedAt: '' })
  if (changed) {
    await writeHistory(next, 'edited', 'Project details updated', { actor })
    await saveMutated(next, { actor })
  }
  return { applied: true, project: withComputed(next) }
}

// Status change: history + timeline + progress defaults (unless manually
// overridden). Terminal-state rules: Archived requires restore first;
// Cancelled is allowed from any non-archived state.
export async function changeProjectStatus(id, statusInput, { actor = 'Admin', notes = '' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false, reason: 'not-found' }
  const status = PROJECT_STATUSES.includes(statusInput) ? statusInput : ''
  if (!status) {
    const error = new Error('Invalid status')
    error.status = 400
    throw error
  }
  if (status === project.status) return { applied: true, project: withComputed(project), unchanged: true }
  if (project.status === 'Archived' && status !== 'Archived') {
    const error = new Error('This project is archived — restore it before changing the status')
    error.status = 409
    throw error
  }
  const previous = project.status
  project.status = status
  // The Archived status and the archive flag move together; restore resets
  // the status to Completed (the state archived projects come from).
  if (status === 'Archived') project.archived = true
  if (!project.progressOverridden && STATUS_PROGRESS_DEFAULTS[status] !== undefined) {
    project.progressPct = STATUS_PROGRESS_DEFAULTS[status]
  }
  // Phase follows the status when the status is a known phase name.
  if (project.phases.includes(status)) project.currentPhase = status
  if (status === 'Completed') {
    project.actualCompletionDate = project.actualCompletionDate || today()
    project.progressPct = 100
  }
  await writeHistory(project, 'status_changed', `${previous} → ${status}${notes ? ` — ${notes}` : ''}`, { actor })
  await saveMutated(project, { actor, activityType: 'status_changed', activityDescription: `Status changed: ${previous} → ${status}${notes ? ` — ${notes}` : ''}`, progressPct: project.progressPct })
  if (project.lead.id && status === 'Completed') {
    await syncLeadActivity(project, 'note_added', `Project ${project.number} completed`, { actor })
  }
  return { applied: true, project: withComputed(project) }
}

export async function updateProjectProgress(id, progressInput, { actor = 'Admin', note = '' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  const progressPct = Math.min(100, Math.max(0, Math.round(Number(progressInput))))
  if (!Number.isFinite(progressPct)) {
    const error = new Error('Progress must be a number between 0 and 100')
    error.status = 400
    throw error
  }
  const previous = project.progressPct
  if (progressPct === previous) return { applied: true, project: withComputed(project), unchanged: true }
  project.progressPct = progressPct
  project.progressOverridden = true
  await writeHistory(project, 'progress_updated', `${previous}% → ${progressPct}%${note ? ` — ${note}` : ''}`, { actor })
  await saveMutated(project, { actor, activityType: 'progress_updated', activityDescription: `Progress updated: ${previous}% → ${progressPct}%${note ? ` — ${note}` : ''}`, progressPct })
  return { applied: true, project: withComputed(project) }
}

// Completion: shows what is outstanding (the router exposes it before the
// fact via the computed block) and stamps completion.
export async function completeProject(id, { completionSummary = '', finalNotes = '', clientFacingSummary = '' } = {}, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  if (project.status === 'Completed') {
    const error = new Error('This project is already completed')
    error.status = 409
    throw error
  }
  const previous = project.status
  project.status = 'Completed'
  project.progressPct = 100
  project.actualCompletionDate = project.actualCompletionDate || today()
  if (completionSummary) project.completionSummary = str(completionSummary, 5000)
  if (finalNotes) project.internalNotes = str(finalNotes, 3000)
  if (clientFacingSummary) project.clientFacingSummary = str(clientFacingSummary, 2000)
  const outstanding = withComputed(project).computed.outstanding
  const summary = [
    `Project completed (${previous} → Completed)`,
    `${outstanding.tasks.length} outstanding task${outstanding.tasks.length === 1 ? '' : 's'}, ${outstanding.milestones.length} open milestone${outstanding.milestones.length === 1 ? '' : 's'}, ${outstanding.deliverables.length} pending deliverable${outstanding.deliverables.length === 1 ? '' : 's'}`,
  ].join(' · ')
  await writeHistory(project, 'completed', summary, { actor })
  await saveMutated(project, { actor, activityType: 'status_changed', activityDescription: summary, progressPct: 100 })
  if (project.lead.id) await syncLeadActivity(project, 'note_added', `Project ${project.number} completed`, { actor })
  return { applied: true, project: withComputed(project), outstanding }
}

export async function setProjectArchived(id, archived, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  project.archived = Boolean(archived)
  if (!archived && project.status === 'Archived') project.status = 'Completed'
  await writeHistory(project, archived ? 'archived' : 'restored', archived ? 'Moved to archive' : 'Restored from archive', { actor })
  await saveMutated(project, { actor })
  return { applied: true, project: withComputed(project) }
}

// Hard delete exists for data-cleanup only — guarded in the router, never in
// the UI. Archiving is the normal retirement path.
export async function deleteProject(id) {
  const all = await readAllProjects()
  const project = all.find((p) => p.id === id)
  if (!project) return { deleted: false }
  await removeEntry(PROJECTS_PREFIX, project)
  const activities = await readAll(ACTIVITIES_PREFIX)
  const related = activities.filter((a) => a.projectId === id)
  await Promise.all(related.map((a) => removeEntry(ACTIVITIES_PREFIX, a).catch(() => {})))
  return { deleted: true, deletedActivities: related.length }
}

// ------------------------------------------------------------- tasks

export async function addTask(id, input, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  const task = normaliseTask(input)
  if (!task.name) {
    const error = new Error('Task name is required')
    error.status = 400
    throw error
  }
  if (task.assigneeStaffId && !task.assigneeName) {
    const staff = await readStaff()
    const known = staff.find((s) => s.id === task.assigneeStaffId)
    if (known) task.assigneeName = known.name
  }
  project.tasks = [task, ...project.tasks]
  await writeHistory(project, 'task_created', `Task created: ${task.name}`, { actor })
  await saveMutated(project, { actor, activityType: 'task_created', activityDescription: `Task created: ${task.name}` })
  return { applied: true, project: withComputed(project), task }
}

export async function updateTask(id, taskId, patch, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  const task = project.tasks.find((t) => t.id === taskId)
  if (!task) {
    const error = new Error('Task not found')
    error.status = 404
    throw error
  }
  const next = normaliseTask({ ...task, ...patch, id: task.id, createdAt: task.createdAt })
  project.tasks = project.tasks.map((t) => (t.id === taskId ? next : t))
  const completedNow = next.status === 'Completed' && task.status !== 'Completed'
  if (completedNow) {
    await writeHistory(project, 'task_completed', `Task completed: ${next.name}`, { actor })
  } else {
    await writeHistory(project, 'task_updated', `Task updated: ${next.name} (${task.status} → ${next.status})`, { actor })
  }
  await saveMutated(project, { actor, activityType: completedNow ? 'task_completed' : 'note_added', activityDescription: completedNow ? `Task completed: ${next.name}` : `Task updated: ${next.name} (${task.status} → ${next.status})` })
  return { applied: true, project: withComputed(project), task: next }
}

export async function removeTask(id, taskId, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  const task = project.tasks.find((t) => t.id === taskId)
  if (!task) return { applied: false }
  project.tasks = project.tasks.filter((t) => t.id !== taskId)
  await writeHistory(project, 'task_updated', `Task removed: ${task.name}`, { actor })
  await saveMutated(project, { actor })
  return { applied: true, project: withComputed(project) }
}

// --------------------------------------------------------- milestones

export async function addMilestone(id, input, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  const milestone = normaliseMilestone(input)
  if (!milestone.name) {
    const error = new Error('Milestone name is required')
    error.status = 400
    throw error
  }
  project.milestones = [...project.milestones, milestone]
  await writeHistory(project, 'milestone_completed', `Milestone added: ${milestone.name}`, { actor })
  await saveMutated(project, { actor })
  return { applied: true, project: withComputed(project), milestone }
}

export async function updateMilestone(id, milestoneId, patch, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  const milestone = project.milestones.find((m) => m.id === milestoneId)
  if (!milestone) {
    const error = new Error('Milestone not found')
    error.status = 404
    throw error
  }
  const next = normaliseMilestone({ ...milestone, ...patch, id: milestone.id, createdAt: milestone.createdAt })
  project.milestones = project.milestones.map((m) => (m.id === milestoneId ? next : m))
  const completedNow = next.status === 'Completed' && milestone.status !== 'Completed'
  if (completedNow) {
    await writeHistory(project, 'milestone_completed', `Milestone completed: ${next.name}`, { actor })
    await saveMutated(project, { actor, activityType: 'milestone_completed', activityDescription: `Milestone completed: ${next.name}` })
  } else {
    await writeHistory(project, 'edited', `Milestone updated: ${next.name} (${milestone.status} → ${next.status})`, { actor })
    await saveMutated(project, { actor })
  }
  return { applied: true, project: withComputed(project), milestone: next }
}

export async function removeMilestone(id, milestoneId, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  const milestone = project.milestones.find((m) => m.id === milestoneId)
  if (!milestone) return { applied: false }
  project.milestones = project.milestones.filter((m) => m.id !== milestoneId)
  await writeHistory(project, 'edited', `Milestone removed: ${milestone.name}`, { actor })
  await saveMutated(project, { actor })
  return { applied: true, project: withComputed(project) }
}

// --------------------------------------------------------- deliverables

export async function addDeliverable(id, input, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  const deliverable = normaliseDeliverable(input)
  if (!deliverable.name) {
    const error = new Error('Deliverable name is required')
    error.status = 400
    throw error
  }
  project.deliverables = [...project.deliverables, deliverable]
  await writeHistory(project, 'deliverable_updated', `Deliverable added: ${deliverable.name}`, { actor })
  await saveMutated(project, { actor })
  return { applied: true, project: withComputed(project), deliverable }
}

export async function updateDeliverable(id, deliverableId, patch, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  const deliverable = project.deliverables.find((d) => d.id === deliverableId)
  if (!deliverable) {
    const error = new Error('Deliverable not found')
    error.status = 404
    throw error
  }
  const next = normaliseDeliverable({ ...deliverable, ...patch, id: deliverable.id, createdAt: deliverable.createdAt })
  project.deliverables = project.deliverables.map((d) => (d.id === deliverableId ? next : d))
  await writeHistory(project, 'deliverable_updated', `Deliverable updated: ${next.name} (${deliverable.status} → ${next.status})`, { actor })
  await saveMutated(project, { actor })
  return { applied: true, project: withComputed(project), deliverable: next }
}

export async function removeDeliverable(id, deliverableId, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  const deliverable = project.deliverables.find((d) => d.id === deliverableId)
  if (!deliverable) return { applied: false }
  project.deliverables = project.deliverables.filter((d) => d.id !== deliverableId)
  await writeHistory(project, 'deliverable_updated', `Deliverable removed: ${deliverable.name}`, { actor })
  await saveMutated(project, { actor })
  return { applied: true, project: withComputed(project) }
}

// --------------------------------------------------------------- team

export async function addTeamMember(id, input, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  const member = normaliseTeamMember(input)
  if (!member.name && member.staffId) {
    const staff = (await readStaff()).find((s) => s.id === member.staffId)
    if (staff) {
      member.name = staff.name
      member.role = member.role || staff.role
    }
  }
  if (!member.name) {
    const error = new Error('Pick a staff member or enter a name')
    error.status = 400
    throw error
  }
  if (project.team.some((m) => m.staffId && m.staffId === member.staffId)) {
    const error = new Error(`${member.name} is already on this project`)
    error.status = 409
    throw error
  }
  project.team = [...project.team, member]
  if (member.isManager || (!project.managerMemberId && input.makeManager)) project.managerMemberId = member.id
  await writeHistory(project, 'team_added', `${member.name} (${member.role || 'team member'}) added to the project`, { actor })
  await saveMutated(project, { actor, activityType: 'team_added', activityDescription: `${member.name} added to the project team` })
  return { applied: true, project: withComputed(project), member }
}

export async function removeTeamMember(id, memberId, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  const member = project.team.find((m) => m.id === memberId)
  if (!member) return { applied: false }
  project.team = project.team.filter((m) => m.id !== memberId)
  if (project.managerMemberId === memberId) project.managerMemberId = ''
  await writeHistory(project, 'team_removed', `${member.name} removed from the project`, { actor })
  await saveMutated(project, { actor, activityType: 'team_removed', activityDescription: `${member.name} removed from the project team` })
  return { applied: true, project: withComputed(project) }
}

export async function setProjectManager(id, memberId, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  const member = project.team.find((m) => m.id === memberId)
  if (!member) {
    const error = new Error('Team member not found')
    error.status = 404
    throw error
  }
  project.managerMemberId = member.id
  project.team = project.team.map((m) => ({ ...m, isManager: m.id === memberId }))
  await writeHistory(project, 'team_added', `${member.name} is now the project manager`, { actor })
  await saveMutated(project, { actor })
  return { applied: true, project: withComputed(project) }
}

// ------------------------------------------------------ activity log

export async function addProjectActivity(id, input, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  const description = str(input.description, 2000)
  if (!description) {
    const error = new Error('Activity description is required')
    error.status = 400
    throw error
  }
  let progressPct
  if (input.progressPct !== undefined && input.progressPct !== null && input.progressPct !== '') {
    const result = await updateProjectProgress(id, input.progressPct, { actor, note: description })
    if (result.applied && !result.unchanged) progressPct = Math.round(Number(input.progressPct))
  }
  const activity = await writeActivity(project, input.type, description, { actor, progressPct })
  return { applied: true, activity, project: withComputed(project) }
}

// -------------------------------------------------------- publication

// Records the publication metadata on the project. The actual write to the
// public portfolio (SiteContent.projects) goes through the EXISTING admin
// content flow from the client (publish dialog → saveContent), so internal
// information becomes public only when the administrator explicitly saves it.
export async function publishProject(id, pubInput = {}, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  if (project.status !== 'Completed') {
    const error = new Error('Only completed projects can be published to the portfolio')
    error.status = 409
    throw error
  }
  const publication = normalisePublication({
    ...project.publication,
    ...pubInput,
    published: true,
    publishedAt: new Date().toISOString(),
  })
  if (!publication.title) publication.title = project.title
  if (!publication.location) publication.location = [project.location.city, project.location.state].filter(Boolean).join(', ')
  if (!publication.completionYear) publication.completionYear = project.actualCompletionDate ? project.actualCompletionDate.slice(0, 4) : String(new Date().getFullYear())
  if (!publication.category) publication.category = project.service.title || project.projectType
  project.publication = publication
  await writeHistory(project, 'published', `Published to portfolio: ${publication.title || project.title}`, { actor })
  await saveMutated(project, { actor, activityType: 'published', activityDescription: `Published to the public portfolio as “${publication.title || project.title}”` })
  return { applied: true, project: withComputed(project), publication }
}

export async function unpublishProject(id, { actor = 'Admin' } = {}) {
  const project = await loadForMutation(id)
  if (!project) return { applied: false }
  project.publication = normalisePublication({ ...project.publication, published: false, portfolioProjectId: '', publishedAt: '' })
  await writeHistory(project, 'unpublished', 'Removed from the public portfolio', { actor })
  await saveMutated(project, { actor })
  return { applied: true, project: withComputed(project) }
}

// ------------------------------------------------------- CRM list views

export async function listProjectsByClient(clientId) {
  const all = await readAllProjects()
  return all.filter((p) => p.client.id === clientId).map(withComputed)
}

export async function listProjectsByLead(leadId) {
  const all = await readAllProjects()
  return all.filter((p) => p.lead.id === leadId).map(withComputed)
}

export async function listProjectsByQuotation(quotationId) {
  const all = await readAllProjects()
  return all.filter((p) => p.quotation.id === quotationId).map(withComputed)
}

// ----------------------------------------------------------- dashboard

export async function getProjectDashboard() {
  const all = await readAllProjects()
  const active = all.filter((p) => ACTIVE_PROJECT_STATUSES.includes(p.status) && !p.archived)
  const computed = all.map(withComputed)
  const attention = computed
    .filter((p) => !p.archived && (p.computed.isOverdue || p.computed.isDueSoon || p.computed.isStalled || p.computed.tasksOverdue > 0 || p.computed.milestonesOverdue > 0))
    .slice(0, 8)
  const upcoming = active
    .filter((p) => p.expectedCompletionDate)
    .sort((a, b) => String(a.expectedCompletionDate).localeCompare(String(b.expectedCompletionDate)))
    .slice(0, 6)
  const recentActivity = (await readProjectActivities(null)).slice(0, 8)
  return {
    cards: {
      total: all.filter((p) => !p.archived).length,
      active: active.length,
      planning: active.filter((p) => p.status === 'Planning').length,
      scheduled: active.filter((p) => p.status === 'Scheduled').length,
      fieldWork: active.filter((p) => p.status === 'Field Work').length,
      processing: active.filter((p) => p.status === 'Processing').length,
      qualityControl: active.filter((p) => p.status === 'Quality Control').length,
      awaitingDelivery: active.filter((p) => p.status === 'Awaiting Delivery').length,
      completed: all.filter((p) => p.status === 'Completed' && !p.archived).length,
      onHold: all.filter((p) => p.status === 'On Hold' && !p.archived).length,
      cancelled: all.filter((p) => p.status === 'Cancelled' && !p.archived).length,
      archived: all.filter((p) => p.archived).length,
      overdue: computed.filter((p) => p.computed.isActive && p.computed.isOverdue).length,
    },
    recentProjects: computed.filter((p) => !p.archived).slice(0, 6),
    requiringAttention: attention,
    upcomingDeadlines: upcoming,
    recentlyCompleted: computed
      .filter((p) => p.status === 'Completed' && !p.archived)
      .sort((a, b) => String(b.actualCompletionDate || b.updatedAt).localeCompare(String(a.actualCompletionDate || a.updatedAt)))
      .slice(0, 4),
    overdueProjects: computed.filter((p) => p.computed.isActive && p.computed.isOverdue).slice(0, 6),
    recentActivity,
  }
}

// ------------------------------------------------------------- staff

function normaliseStaff(input) {
  return {
    name: str(input.name, 120),
    role: str(input.role, 120),
    phone: str(input.phone, 40),
    email: str(input.email, 200).toLowerCase(),
    specialization: str(input.specialization, 200),
    status: STAFF_STATUSES.includes(input.status) ? input.status : 'Active',
    notes: str(input.notes, 1000),
  }
}

export async function readStaff() {
  const entries = await readAll(STAFF_PREFIX)
  return entries
    .map((entry) => ({ ...entry, ...normaliseStaff(entry) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createStaff(input, { actor = 'Admin' } = {}) {
  const now = new Date().toISOString()
  const staff = {
    ...normaliseStaff(input),
    id: newId(),
    createdAt: now,
    updatedAt: now,
  }
  if (!staff.name) {
    const error = new Error('Staff name is required')
    error.status = 400
    throw error
  }
  await putEntry(STAFF_PREFIX, staff)
  return staff
}

export async function updateStaff(id, patch) {
  const all = await readAll(STAFF_PREFIX)
  const target = all.find((s) => s.id === id)
  if (!target) return { applied: false }
  const next = {
    ...target,
    ...normaliseStaff({ ...target, ...patch }),
    id: target.id,
    createdAt: target.createdAt,
    updatedAt: new Date().toISOString(),
  }
  await putEntry(STAFF_PREFIX, next)
  return { applied: true, staff: next }
}

export async function deleteStaff(id) {
  const all = await readAll(STAFF_PREFIX)
  const target = all.find((s) => s.id === id)
  if (!target) return { deleted: false }
  await removeEntry(STAFF_PREFIX, target)
  return { deleted: true }
}
