// Equipment Management System data layer (ES Module) — Postgres-backed via
// the shared prefix helpers in crmStore.js (jsonb-document rows; see the
// PREFIX_TABLE entries added there). Follows the projectStore.js patterns:
// normalise-on-read with preserved identity stamps, denormalised reference
// snapshots so deleting a project or staff member never corrupts equipment
// history, computed views for the UI, append-only history records, and
// exported pure helpers for scripts/emsLogicTests.mjs.
//
// Storage model (one table per kind — see supabase/migrations/):
//   equipment/…                  items, assignments, reservations,
//                                maintenance, calibrations, inspections,
//                                history, categories.
//
// Rules enforced here (PRD §35):
//   • Asset numbers are unique, stable and immutable once created.
//   • A single equipment item cannot have two overlapping active
//     assignments or reservations (conflicts throw 409 with details).
//   • Under Maintenance / Under Calibration / Damaged / Lost / Retired /
//     Archived items cannot be assigned or reserved.
//   • Archive/Retire instead of delete; hard delete is a guarded cleanup
//     path only. History survives everything.
import {
  readAll, putEntry, removeEntry, newId, allocateCode,
  EQUIPMENT_PREFIX, EQUIPMENT_CATEGORIES_PREFIX, EQUIPMENT_ASSIGNMENTS_PREFIX,
  EQUIPMENT_RESERVATIONS_PREFIX, EQUIPMENT_MAINTENANCE_PREFIX,
  EQUIPMENT_CALIBRATIONS_PREFIX, EQUIPMENT_INSPECTIONS_PREFIX,
  EQUIPMENT_HISTORY_PREFIX,
} from './crmStore.js'

// ------------------------------------------------------------- vocabulary

export const EQUIPMENT_STATUSES = [
  'Available', 'Assigned', 'Reserved', 'Under Maintenance', 'Under Calibration',
  'Damaged', 'Lost', 'Retired', 'Archived',
]
export const EQUIPMENT_CONDITIONS = ['Excellent', 'Good', 'Fair', 'Needs Repair', 'Damaged', 'Unusable']
export const MAINTENANCE_STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled']
export const MAINTENANCE_TYPES = ['Preventive', 'Corrective', 'Battery Replacement', 'Firmware/Software', 'Inspection', 'Other']
export const MAINTENANCE_FREQUENCIES = ['None', 'Monthly', 'Quarterly', 'Biannually', 'Annually', 'Custom']
export const CALIBRATION_RESULTS = ['Passed', 'Adjusted', 'Failed']
export const INSPECTION_RESULTS = ['Passed', 'Failed']
export const INSPECTION_TYPES = ['Pre-field', 'Post-field', 'Periodic', 'Damage Assessment', 'Other']
export const ASSIGNMENT_STATUSES = ['Assigned', 'Returned', 'Cancelled']
export const RESERVATION_STATUSES = ['Reserved', 'Fulfilled', 'Cancelled']
// Statuses that may receive a new assignment or reservation.
export const ASSIGNABLE_STATUSES = ['Available', 'Reserved']

export const EQUIPMENT_ACTIONS = [
  'created', 'edited', 'assigned', 'returned', 'reserved', 'reservation_cancelled',
  'maintenance_created', 'maintenance_updated', 'maintenance_completed',
  'calibration_recorded', 'inspection_recorded', 'condition_changed',
  'status_changed', 'location_changed', 'archived', 'restored', 'retired', 'deleted',
]

// The DMS link: every equipment document carries this tag so the equipment
// profile can find its files with a plain DMS query — no second document
// store, no duplicated files (PRD §18/§20).
export function equipmentDocTag(assetNumber) {
  return `equipment:${assetNumber}`
}

// System categories seeded on first read. Codes drive asset numbers
// (GML-<code>-NNN) and the id_counters kinds (equipment:<code>).
export const SYSTEM_CATEGORIES = [
  { code: 'GNSS', name: 'GNSS / GPS' },
  { code: 'TS', name: 'Total Stations' },
  { code: 'THEO', name: 'Theodolites' },
  { code: 'LEV', name: 'Levels' },
  { code: 'UAV', name: 'Drones / UAV' },
  { code: 'UAVA', name: 'Drone Accessories' },
  { code: 'SC', name: 'Survey Controllers' },
  { code: 'DC', name: 'Data Collectors' },
  { code: 'TRI', name: 'Tripods' },
  { code: 'PR', name: 'Prisms' },
  { code: 'PP', name: 'Prism Poles' },
  { code: 'RP', name: 'Range Poles' },
  { code: 'ME', name: 'Measuring Equipment' },
  { code: 'BAT', name: 'Batteries' },
  { code: 'CH', name: 'Chargers' },
  { code: 'IT', name: 'Computing Equipment' },
  { code: 'GIS', name: 'GIS Equipment' },
  { code: 'SE', name: 'Safety Equipment' },
  { code: 'FA', name: 'Field Accessories' },
  { code: 'OTH', name: 'Other' },
]

// ---------------------------------------------------------------- utilities

const str = (value, max) => String(value ?? '').trim().slice(0, max)
const iso = (value) => {
  const t = Date.parse(value)
  return Number.isFinite(t) ? new Date(t).toISOString() : ''
}
const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
const today = () => new Date().toISOString().slice(0, 10)
const minorOf = (value) => {
  const n = Math.round(Number(value) * 100)
  return Number.isFinite(n) && n > 0 ? n : 0
}
const majorOf = (minor) => (minor > 0 ? minor / 100 : null)

function addDays(day, days) {
  const t = Date.parse(`${day}T00:00:00Z`)
  if (!Number.isFinite(t)) return ''
  return new Date(t + days * 86400000).toISOString().slice(0, 10)
}

function addMonths(day, months) {
  const t = Date.parse(`${day}T00:00:00Z`)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

function fail(message, status = 400) {
  const error = new Error(message)
  error.status = status
  throw error
}

function snapshotRef(ref, idField, extra = {}) {
  return {
    id: str(ref?.[idField], 80),
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, str(ref?.[k], v[1])])),
  }
}

// ------------------------------------------------------------- normalisers

function normaliseCategory(input) {
  const name = str(input.name, 60)
  if (!name) fail('Category name is required')
  const code = (str(input.code, 8).toUpperCase().replace(/[^A-Z0-9]/g, '') ||
    name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'CAT')
  return {
    id: str(input.id, 80) || newId(),
    code,
    name,
    system: Boolean(input.system),
    description: str(input.description, 300),
    createdAt: iso(input.createdAt) || new Date().toISOString(),
    updatedAt: iso(input.updatedAt) || new Date().toISOString(),
  }
}

function normaliseSchedule(input) {
  const frequency = MAINTENANCE_FREQUENCIES.includes(input?.frequency) ? input.frequency : 'None'
  return {
    frequency,
    customDays: frequency === 'Custom' ? Math.max(1, Math.round(Number(input?.customDays) || 90)) : null,
    lastDate: isDay(input?.lastDate) ? input.lastDate : '',
    nextDate: isDay(input?.nextDate) ? input.nextDate : '',
  }
}

function normaliseCalibrationSchedule(input) {
  return {
    frequencyMonths: Math.max(0, Math.round(Number(input?.frequencyMonths) || 12)),
    lastDate: isDay(input?.lastDate) ? input.lastDate : '',
    nextDate: isDay(input?.nextDate) ? input.nextDate : '',
  }
}

function normalisePhoto(input) {
  return {
    url: str(input?.url, 600),
    label: str(input?.label, 80),
    uploadedAt: iso(input?.uploadedAt) || new Date().toISOString(),
  }
}

function normaliseEquipment(input) {
  const status = EQUIPMENT_STATUSES.includes(input.status) ? input.status : 'Available'
  const condition = EQUIPMENT_CONDITIONS.includes(input.condition) ? input.condition : 'Good'
  return {
    // Identity + stamps — preserved from the stored record (dropping these
    // broke lookups/mutations once storage moved to Postgres; see the
    // project/quotation normalisers).
    id: str(input.id, 80),
    createdAt: iso(input.createdAt),
    updatedAt: iso(input.updatedAt),
    assetNumber: str(input.assetNumber, 40),
    name: str(input.name, 160),
    category: {
      id: str(input.category?.id, 80),
      code: str(input.category?.code, 8).toUpperCase(),
      name: str(input.category?.name, 60),
    },
    manufacturer: str(input.manufacturer, 120),
    model: str(input.model, 120),
    serialNumber: str(input.serialNumber, 120),
    description: str(input.description, 3000),
    purchase: {
      date: isDay(input.purchase?.date) ? input.purchase.date : '',
      priceMinor: Math.max(0, Math.round(Number(input.purchase?.priceMinor) || 0)),
    },
    currentValueMinor: Math.max(0, Math.round(Number(input.currentValueMinor) || 0)),
    currency: {
      code: str(input.currency?.code, 8) || 'NGN',
      symbol: str(input.currency?.symbol, 8) || '₦',
      minorUnits: Math.min(4, Math.max(0, Math.round(Number(input.currency?.minorUnits ?? 2)))),
    },
    condition,
    status,
    location: str(input.location, 120),
    assignedStaff: { id: str(input.assignedStaff?.id, 80), name: str(input.assignedStaff?.name, 120) },
    assignedProject: { id: str(input.assignedProject?.id, 80), number: str(input.assignedProject?.number, 40), title: str(input.assignedProject?.title, 200) },
    warrantyExpiry: isDay(input.warrantyExpiry) ? input.warrantyExpiry : '',
    maintenanceSchedule: normaliseSchedule(input.maintenanceSchedule),
    calibrationSchedule: normaliseCalibrationSchedule(input.calibrationSchedule),
    notes: str(input.notes, 3000),
    photos: (Array.isArray(input.photos) ? input.photos : []).map(normalisePhoto).filter((p) => p.url).slice(0, 12),
    retiredAt: iso(input.retiredAt),
    archived: Boolean(input.archived),
  }
}

function isValidEquipment(item) {
  return Boolean(item.name && item.category.code && item.assetNumber)
}

function normaliseAssignment(input) {
  const status = ASSIGNMENT_STATUSES.includes(input.status) ? input.status : 'Assigned'
  return {
    id: str(input.id, 80) || newId(),
    equipmentId: str(input.equipmentId, 80),
    assetNumber: str(input.assetNumber, 40),
    equipmentName: str(input.equipmentName, 160),
    project: snapshotRef(input.project, 'id', { number: [40], title: [200] }),
    staff: snapshotRef(input.staff, 'id', { name: [120] }),
    startDate: isDay(input.startDate) ? input.startDate : today(),
    expectedReturnDate: isDay(input.expectedReturnDate) ? input.expectedReturnDate : '',
    assignedAt: iso(input.assignedAt) || new Date().toISOString(),
    returnedAt: iso(input.returnedAt),
    returnDate: isDay(input.returnDate) ? input.returnDate : '',
    conditionOnReturn: EQUIPMENT_CONDITIONS.includes(input.conditionOnReturn) ? input.conditionOnReturn : '',
    damageReport: str(input.damageReport, 2000),
    requiresMaintenance: Boolean(input.requiresMaintenance),
    notes: str(input.notes, 2000),
    status,
    createdBy: str(input.createdBy, 120) || 'Admin',
    createdAt: iso(input.createdAt) || new Date().toISOString(),
    updatedAt: iso(input.updatedAt) || new Date().toISOString(),
  }
}

function normaliseReservation(input) {
  const status = RESERVATION_STATUSES.includes(input.status) ? input.status : 'Reserved'
  return {
    id: str(input.id, 80) || newId(),
    equipmentId: str(input.equipmentId, 80),
    assetNumber: str(input.assetNumber, 40),
    equipmentName: str(input.equipmentName, 160),
    project: snapshotRef(input.project, 'id', { number: [40], title: [200] }),
    reservedDate: isDay(input.reservedDate) ? input.reservedDate : today(),
    usageStart: isDay(input.usageStart) ? input.usageStart : '',
    usageEnd: isDay(input.usageEnd) ? input.usageEnd : '',
    notes: str(input.notes, 1000),
    status,
    createdBy: str(input.createdBy, 120) || 'Admin',
    createdAt: iso(input.createdAt) || new Date().toISOString(),
    updatedAt: iso(input.updatedAt) || new Date().toISOString(),
  }
}

function normaliseMaintenance(input) {
  const status = MAINTENANCE_STATUSES.includes(input.status) ? input.status : 'Scheduled'
  return {
    id: str(input.id, 80) || newId(),
    equipmentId: str(input.equipmentId, 80),
    assetNumber: str(input.assetNumber, 40),
    equipmentName: str(input.equipmentName, 160),
    type: MAINTENANCE_TYPES.includes(input.type) ? input.type : 'Other',
    description: str(input.description, 2000),
    date: isDay(input.date) ? input.date : today(),
    serviceProvider: str(input.serviceProvider, 160),
    technician: str(input.technician, 120),
    costMinor: Math.max(0, Math.round(Number(input.costMinor) || 0)),
    partsReplaced: (Array.isArray(input.partsReplaced) ? input.partsReplaced : [])
      .map((p) => str(p, 120)).filter(Boolean).slice(0, 20),
    nextMaintenanceDate: isDay(input.nextMaintenanceDate) ? input.nextMaintenanceDate : '',
    status,
    notes: str(input.notes, 2000),
    createdBy: str(input.createdBy, 120) || 'Admin',
    createdAt: iso(input.createdAt) || new Date().toISOString(),
    updatedAt: iso(input.updatedAt) || new Date().toISOString(),
  }
}

function normaliseCalibration(input) {
  const result = CALIBRATION_RESULTS.includes(input.result) ? input.result : 'Passed'
  return {
    id: str(input.id, 80) || newId(),
    equipmentId: str(input.equipmentId, 80),
    assetNumber: str(input.assetNumber, 40),
    equipmentName: str(input.equipmentName, 160),
    date: isDay(input.date) ? input.date : today(),
    provider: str(input.provider, 160),
    certificateNumber: str(input.certificateNumber, 120),
    result,
    nextCalibrationDate: isDay(input.nextCalibrationDate) ? input.nextCalibrationDate : '',
    documentIds: (Array.isArray(input.documentIds) ? input.documentIds : [])
      .map((d) => str(d, 80)).filter(Boolean).slice(0, 20),
    notes: str(input.notes, 2000),
    status: result === 'Failed' ? 'Failed' : 'Valid',
    createdBy: str(input.createdBy, 120) || 'Admin',
    createdAt: iso(input.createdAt) || new Date().toISOString(),
    updatedAt: iso(input.updatedAt) || new Date().toISOString(),
  }
}

function normaliseInspection(input) {
  return {
    id: str(input.id, 80) || newId(),
    equipmentId: str(input.equipmentId, 80),
    assetNumber: str(input.assetNumber, 40),
    equipmentName: str(input.equipmentName, 160),
    date: isDay(input.date) ? input.date : today(),
    type: INSPECTION_TYPES.includes(input.type) ? input.type : 'Periodic',
    inspector: str(input.inspector, 120),
    condition: EQUIPMENT_CONDITIONS.includes(input.condition) ? input.condition : '',
    findings: str(input.findings, 3000),
    recommendations: str(input.recommendations, 2000),
    result: INSPECTION_RESULTS.includes(input.result) ? input.result : 'Passed',
    nextInspectionDate: isDay(input.nextInspectionDate) ? input.nextInspectionDate : '',
    notes: str(input.notes, 2000),
    createdBy: str(input.createdBy, 120) || 'Admin',
    createdAt: iso(input.createdAt) || new Date().toISOString(),
  }
}

function normaliseHistory(input) {
  return {
    id: str(input.id, 80) || newId(),
    equipmentId: str(input.equipmentId, 80),
    assetNumber: str(input.assetNumber, 40),
    action: str(input.action, 40),
    detail: str(input.detail, 500),
    project: snapshotRef(input.project, 'id', { number: [40], title: [200] }),
    staff: { id: str(input.staff?.id, 80), name: str(input.staff?.name, 120) },
    actor: str(input.actor, 120) || 'Admin',
    at: iso(input.at) || new Date().toISOString(),
  }
}

// ------------------------------------------------------------ read helpers

async function readAllEquipment() {
  const entries = await readAll(EQUIPMENT_PREFIX)
  return entries
    .map((entry) => normaliseEquipment(entry))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

async function readCategoriesRaw() {
  const rows = await readAll(EQUIPMENT_CATEGORIES_PREFIX)
  return rows.map((entry) => normaliseCategory(entry))
}

// Seeds the system categories once; safe to call on every read.
async function readCategoriesSeeded() {
  const existing = await readCategoriesRaw()
  if (existing.length > 0) return existing.sort((a, b) => a.name.localeCompare(b.name))
  const seeded = []
  for (const def of SYSTEM_CATEGORIES) {
    const category = normaliseCategory({ ...def, system: true })
    await putEntry(EQUIPMENT_CATEGORIES_PREFIX, category).catch(() => {})
    seeded.push(category)
  }
  return seeded.sort((a, b) => a.name.localeCompare(b.name))
}

async function readAssignments(equipmentId = '', { projectId = '' } = {}) {
  const rows = await readAll(EQUIPMENT_ASSIGNMENTS_PREFIX)
  const list = rows.map((entry) => normaliseAssignment(entry))
  const filtered = list.filter((a) =>
    (!equipmentId || a.equipmentId === equipmentId) &&
    (!projectId || a.project.id === projectId))
  return filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

async function readReservations(equipmentId = '', { projectId = '' } = {}) {
  const rows = await readAll(EQUIPMENT_RESERVATIONS_PREFIX)
  const list = rows.map((entry) => normaliseReservation(entry))
  const filtered = list.filter((r) =>
    (!equipmentId || r.equipmentId === equipmentId) &&
    (!projectId || r.project.id === projectId))
  return filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

async function readMaintenanceRecords(equipmentId = '') {
  const rows = await readAll(EQUIPMENT_MAINTENANCE_PREFIX)
  const list = rows.map((entry) => normaliseMaintenance(entry))
  const filtered = equipmentId ? list.filter((m) => m.equipmentId === equipmentId) : list
  return filtered.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)))
}

async function readCalibrations(equipmentId = '') {
  const rows = await readAll(EQUIPMENT_CALIBRATIONS_PREFIX)
  const list = rows.map((entry) => normaliseCalibration(entry))
  const filtered = equipmentId ? list.filter((c) => c.equipmentId === equipmentId) : list
  return filtered.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)))
}

async function readInspections(equipmentId = '') {
  const rows = await readAll(EQUIPMENT_INSPECTIONS_PREFIX)
  const list = rows.map((entry) => normaliseInspection(entry))
  const filtered = equipmentId ? list.filter((i) => i.equipmentId === equipmentId) : list
  return filtered.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)))
}

async function readHistory(equipmentId = '', limit = 100) {
  const rows = await readAll(EQUIPMENT_HISTORY_PREFIX)
  const list = rows.map((entry) => normaliseHistory(entry))
  const filtered = equipmentId ? list.filter((h) => h.equipmentId === equipmentId) : list
  return filtered
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, Math.min(500, Math.max(1, limit)))
}

// Best-effort audit trail — a history failure never fails the primary action.
async function writeHistory(equipment, action, detail, { actor = 'Admin', project = null, staff = null } = {}) {
  try {
    const entry = normaliseHistory({
      equipmentId: equipment.id,
      assetNumber: equipment.assetNumber,
      action,
      detail,
      project,
      staff,
      actor,
      at: new Date().toISOString(),
    })
    await putEntry(EQUIPMENT_HISTORY_PREFIX, entry)
    return entry
  } catch {
    return null
  }
}

// ------------------------------------------------------ computed view (UI)

// Pure date maths for the derived maintenance/calibration state. Exported
// for the logic tests.
export function deriveDueState(nextDate, dueSoonDays) {
  if (!nextDate) return { state: 'none', days: null, due: false, overdue: false, dueSoon: false }
  const t = today()
  const days = Math.round((Date.parse(`${nextDate}T00:00:00Z`) - Date.parse(`${t}T00:00:00Z`)) / 86400000)
  return {
    state: days < 0 ? 'overdue' : days <= dueSoonDays ? 'due-soon' : 'ok',
    days,
    due: days <= 0,
    overdue: days < 0,
    dueSoon: days >= 0 && days <= dueSoonDays,
  }
}

function withComputed(equipment, extras = {}) {
  const maintenance = deriveDueState(equipment.maintenanceSchedule.nextDate, 14)
  const calibration = deriveDueState(equipment.calibrationSchedule.nextDate, 30)
  const conditionBad = ['Needs Repair', 'Damaged', 'Unusable'].includes(equipment.condition)
  const needsAttention = maintenance.overdue || calibration.overdue || conditionBad || equipment.status === 'Lost'
  const warrantyExpired = Boolean(equipment.warrantyExpiry && equipment.warrantyExpiry < today())
  return {
    ...equipment,
    computed: {
      maintenanceState: maintenance.state,
      maintenanceDays: maintenance.days,
      maintenanceDue: maintenance.due,
      maintenanceOverdue: maintenance.overdue,
      maintenanceDueSoon: maintenance.dueSoon,
      calibrationState: calibration.state,
      calibrationDays: calibration.days,
      calibrationDue: calibration.due,
      calibrationOverdue: calibration.overdue,
      calibrationDueSoon: calibration.dueSoon,
      warrantyExpired,
      conditionBad,
      needsAttention,
      assignable: ASSIGNABLE_STATUSES.includes(equipment.status) && !equipment.archived,
      ...extras,
    },
  }
}

// Exported pure helpers for scripts/emsLogicTests.mjs.
export const _normaliseEquipment = normaliseEquipment
export const _normaliseAssignment = normaliseAssignment
export const _normaliseReservation = normaliseReservation
export const _withComputed = withComputed
export const _deriveDueState = deriveDueState
export const _addMonths = addMonths
export const _addDays = addDays

// --------------------------------------------------------------- conflicts

// Overlap test for two [start, end] windows where a missing end means
// open-ended (still out). Exported pure for tests.
export function windowsOverlap(startA, endA, startB, endB) {
  const aStart = startA || '0000-01-01'
  const bStart = startB || '0000-01-01'
  const aEnd = endA || '9999-12-31'
  const bEnd = endB || '9999-12-31'
  return aStart <= bEnd && bStart <= aEnd
}

function describeConflict(kind, record) {
  const window = record.usageStart
    ? `${record.usageStart} → ${record.usageEnd}`
    : `${record.startDate}${record.expectedReturnDate ? ` → ${record.expectedReturnDate}` : ' (open-ended)'}`
  const who = record.project?.title || record.project?.number || record.staff?.name || 'unlinked'
  return `${kind} for ${who} (${window})`
}

// Core conflict check for a proposed assignment/reservation window.
async function findConflicts(equipmentId, { startDate, endDate, excludeAssignmentId = '', excludeReservationId = '' }) {
  const [assignments, reservations] = await Promise.all([readAssignments(equipmentId), readReservations(equipmentId)])
  const conflictingAssignments = assignments.filter((a) =>
    a.id !== excludeAssignmentId &&
    a.status === 'Assigned' &&
    windowsOverlap(startDate, endDate, a.startDate, a.expectedReturnDate))
  const conflictingReservations = reservations.filter((r) =>
    r.id !== excludeReservationId &&
    r.status === 'Reserved' &&
    windowsOverlap(startDate, endDate, r.usageStart, r.usageEnd))
  return { conflictingAssignments, conflictingReservations }
}

function conflictError(conflicts) {
  const parts = [
    ...conflicts.conflictingAssignments.map((a) => describeConflict('Already assigned', a)),
    ...conflicts.conflictingReservations.map((r) => describeConflict('Already reserved', r)),
  ]
  const error = new Error(`This equipment is not free for the requested period — ${parts.join('; ')}`)
  error.status = 409
  error.code = 'EQUIPMENT_CONFLICT'
  error.conflicts = parts
  return error
}

// --------------------------------------------------------------- CRUD

function sortEquipment(list, sort = 'newest') {
  const byNewest = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt))
  const listCopy = [...list]
  switch (sort) {
    case 'oldest':
      return listCopy.sort(byNewest)
    case 'asset':
      return listCopy.sort((a, b) => a.assetNumber.localeCompare(b.assetNumber))
    case 'name':
      return listCopy.sort((a, b) => a.name.localeCompare(b.name))
    case 'condition':
      return listCopy.sort((a, b) => EQUIPMENT_CONDITIONS.indexOf(a.condition) - EQUIPMENT_CONDITIONS.indexOf(b.condition) || byNewest(a, b))
    default:
      return listCopy.sort(byNewest)
  }
}

export async function readEquipment(params = {}) {
  const all = await readAllEquipment()
  const pool = params.archived === 'true'
    ? all.filter((e) => e.archived || e.status === 'Archived' || e.status === 'Retired')
    : all.filter((e) => !e.archived && e.status !== 'Archived' && e.status !== 'Retired')
  const query = str(params.query, 120).toLowerCase()
  const categories = await readCategoriesSeeded()
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  const filtered = pool.filter((e) => {
    if (params.categoryId && e.category.id !== params.categoryId) return false
    if (params.status && e.status !== params.status) return false
    if (params.condition && e.condition !== params.condition) return false
    if (params.location && e.location.toLowerCase() !== String(params.location).toLowerCase()) return false
    if (params.projectId && e.assignedProject.id !== params.projectId) return false
    if (params.staffId && e.assignedStaff.id !== params.staffId) return false
    if (params.purchaseYear && (!e.purchase.date || e.purchase.date.slice(0, 4) !== String(params.purchaseYear))) return false
    if (params.maintenance === 'due' && !withComputed(e).computed.maintenanceDue) return false
    if (params.maintenance === 'overdue' && !withComputed(e).computed.maintenanceOverdue) return false
    if (params.calibration === 'due' && !withComputed(e).computed.calibrationDue) return false
    if (params.calibration === 'expired' && !withComputed(e).computed.calibrationOverdue) return false
    if (params.query) {
      const haystack = [e.name, e.assetNumber, e.serialNumber, e.manufacturer, e.model, e.category.name, e.location, e.assignedStaff.name, e.assignedProject.title, e.assignedProject.number, e.notes]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
  const computed = filtered.map((e) => {
    const category = categoryById.get(e.category.id)
    return withComputed(e, { categoryName: category?.name || e.category.name })
  })
  const sorted = sortEquipment(computed, params.sort)
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 25))
  return {
    equipment: sorted.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
  }
}

// Light list for pickers (assign dialogs, project integration).
export async function lookupEquipment(params = {}) {
  const all = await readAllEquipment()
  const query = str(params.query, 120).toLowerCase()
  const list = all
    .filter((e) => !e.archived && e.status !== 'Retired')
    .filter((e) => {
      if (params.availableOnly && !ASSIGNABLE_STATUSES.includes(e.status)) return false
      if (!query) return true
      return [e.name, e.assetNumber, e.serialNumber, e.manufacturer, e.model].join(' ').toLowerCase().includes(query)
    })
    .slice(0, 30)
    .map((e) => ({
      id: e.id,
      assetNumber: e.assetNumber,
      name: e.name,
      categoryCode: e.category.code,
      categoryName: e.category.name,
      status: e.status,
      condition: e.condition,
      location: e.location,
    }))
  return { equipment: list, total: list.length }
}

export async function getEquipmentById(id) {
  const all = await readAllEquipment()
  const equipment = all.find((e) => e.id === id)
  if (!equipment) return null
  const categories = await readCategoriesSeeded()
  const category = categories.find((c) => c.id === equipment.category.id)
  const [assignments, reservations, maintenance, calibrations, inspections, history] = await Promise.all([
    readAssignments(id),
    readReservations(id),
    readMaintenanceRecords(id),
    readCalibrations(id),
    readInspections(id),
    readHistory(id, 150),
  ])
  const activeAssignment = assignments.find((a) => a.status === 'Assigned') || null
  const activeReservations = reservations.filter((r) => r.status === 'Reserved')
  return {
    equipment: withComputed(equipment, {
      categoryName: category?.name || equipment.category.name,
      activeAssignment,
      activeReservations,
    }),
    assignments,
    reservations,
    maintenance,
    calibrations,
    inspections,
    history,
  }
}

async function nextAssetNumber(category) {
  const all = await readAllEquipment()
  return allocateCode(`equipment:${category.code}`, `GML-${category.code}`, false, async (code) =>
    all.some((e) => e.assetNumber === code))
}

export async function createEquipment(input, { actor = 'Admin' } = {}) {
  const categories = await readCategoriesSeeded()
  const category = categories.find((c) => c.id === input.categoryId)
  if (!category) fail('Pick a category for this equipment')

  const all = await readAllEquipment()
  const requestedAsset = str(input.assetNumber, 40).toUpperCase()
  if (requestedAsset) {
    if (all.some((e) => e.assetNumber === requestedAsset)) {
      fail(`Asset number ${requestedAsset} is already in use — asset numbers must be unique`, 409)
    }
  }
  const draft = normaliseEquipment({
    ...input,
    assetNumber: requestedAsset || (await nextAssetNumber(category)),
    category: { id: category.id, code: category.code, name: category.name },
    status: input.status || 'Available',
    condition: input.condition || 'Good',
  })
  if (!isValidEquipment(draft)) fail('Equipment name and category are required')
  if (draft.status === 'Retired' && !draft.retiredAt) draft.retiredAt = new Date().toISOString()

  const now = new Date().toISOString()
  const equipment = { ...draft, id: newId(), createdAt: now, updatedAt: now }
  await putEntry(EQUIPMENT_PREFIX, equipment)
  await writeHistory(equipment, 'created', `Registered with asset number ${equipment.assetNumber}`, { actor })
  return withComputed(equipment, { categoryName: category.name })
}

// General edit — identity (asset number, category snapshot) is immutable;
// other fields merge through the normaliser. Condition/location/status
// changes get their own history entries.
const EDITABLE_FIELDS = [
  'name', 'manufacturer', 'model', 'serialNumber', 'description', 'purchase',
  'currentValueMinor', 'condition', 'location', 'assignedStaff', 'assignedProject',
  'warrantyExpiry', 'maintenanceSchedule', 'calibrationSchedule', 'notes', 'photos',
]

export async function updateEquipment(id, patch, { actor = 'Admin' } = {}) {
  const all = await readAllEquipment()
  const current = all.find((e) => e.id === id)
  if (!current) return { applied: false }
  if (patch.assetNumber && str(patch.assetNumber, 40).toUpperCase() !== current.assetNumber) {
    fail('Asset numbers are immutable — archive this item and register a new one if the identity must change', 409)
  }
  const mergedInput = { ...current }
  for (const field of EDITABLE_FIELDS) {
    if (patch[field] !== undefined) mergedInput[field] = patch[field]
  }
  const merged = normaliseEquipment(mergedInput)
  const next = { ...merged, id: current.id, assetNumber: current.assetNumber, category: current.category, createdAt: current.createdAt, status: current.status }
  const changed = JSON.stringify({ ...next, updatedAt: '' }) !== JSON.stringify({ ...current, updatedAt: '' })
  if (changed) {
    next.updatedAt = new Date().toISOString()
    await putEntry(EQUIPMENT_PREFIX, next)
    const fieldsChanged = EDITABLE_FIELDS
      .filter((f) => f !== 'condition' && f !== 'location')
      .filter((f) => JSON.stringify(next[f]) !== JSON.stringify(current[f]))
    if (next.condition !== current.condition) {
      await writeHistory(next, 'condition_changed', `Condition: ${current.condition} → ${next.condition}`, { actor })
    }
    if (next.location !== current.location) {
      await writeHistory(next, 'location_changed', `Location: ${current.location || '—'} → ${next.location || '—'}`, { actor })
    }
    if (fieldsChanged.length > 0) {
      await writeHistory(next, 'edited', `Updated: ${fieldsChanged.join(', ')}`, { actor })
    }
  }
  return { applied: true, equipment: withComputed(next) }
}

export async function setEquipmentArchived(id, archived, { actor = 'Admin', notes = '' } = {}) {
  const all = await readAllEquipment()
  const current = all.find((e) => e.id === id)
  if (!current) return { applied: false }
  const active = (await readAssignments(id)).find((a) => a.status === 'Assigned')
  if (archived && active) {
    fail('Return this equipment before archiving — it is still assigned', 409)
  }
  const next = normaliseEquipment({ ...current, archived: Boolean(archived) })
  next.updatedAt = new Date().toISOString()
  await putEntry(EQUIPMENT_PREFIX, next)
  await writeHistory(next, archived ? 'archived' : 'restored', notes || (archived ? 'Moved to archive' : 'Restored from archive'), { actor })
  return { applied: true, equipment: withComputed(next) }
}

export async function retireEquipment(id, { actor = 'Admin', notes = '' } = {}) {
  const all = await readAllEquipment()
  const current = all.find((e) => e.id === id)
  if (!current) return { applied: false }
  const active = (await readAssignments(id)).find((a) => a.status === 'Assigned')
  if (active) fail('Return this equipment before retiring — it is still assigned', 409)
  const next = normaliseEquipment({ ...current, status: 'Retired', retiredAt: new Date().toISOString() })
  next.updatedAt = new Date().toISOString()
  await putEntry(EQUIPMENT_PREFIX, next)
  await writeHistory(next, 'retired', notes || 'Retired from service', { actor })
  return { applied: true, equipment: withComputed(next) }
}

// Hard delete exists for data-cleanup only — the router requires
// ?confirm=<assetNumber>; archive/retire is the normal path (PRD §35).
export async function deleteEquipment(id, confirm = '') {
  const all = await readAllEquipment()
  const equipment = all.find((e) => e.id === id)
  if (!equipment) return { deleted: false }
  if (confirm !== equipment.assetNumber) {
    fail(`Append ?confirm=${equipment.assetNumber} to delete this equipment record`, 400)
  }
  await removeEntry(EQUIPMENT_PREFIX, equipment)
  await writeHistory(equipment, 'deleted', `Record hard-deleted (asset ${equipment.assetNumber})`, {})
  return { deleted: true }
}

// ------------------------------------------------------------ assignment

export async function assignEquipment(id, input, { actor = 'Admin' } = {}) {
  const all = await readAllEquipment()
  const equipment = all.find((e) => e.id === id)
  if (!equipment) return { applied: false, reason: 'not-found' }

  const startDate = isDay(input.startDate) ? input.startDate : today()
  const expectedReturnDate = isDay(input.expectedReturnDate) ? input.expectedReturnDate : ''
  if (expectedReturnDate && expectedReturnDate < startDate) {
    fail('Expected return date cannot be before the assignment start date')
  }
  if (!ASSIGNABLE_STATUSES.includes(equipment.status)) {
    fail(`This equipment is ${equipment.status.toLowerCase()} and cannot be assigned right now`, 409)
  }
  if (!str(input.projectId, 80) && !str(input.staffId, 80) && !str(input.staffName, 120)) {
    fail('An assignment needs a project, a staff member, or both')
  }

  const conflicts = await findConflicts(id, { startDate, endDate: expectedReturnDate })
  // A reservation for the same project over the same window is not a
  // conflict — assigning fulfils it.
  const sameProjectReservation = conflicts.conflictingReservations.find(
    (r) => input.projectId && r.project.id === input.projectId)
  if (conflicts.conflictingAssignments.length > 0 || conflicts.conflictingReservations.some((r) => r !== sameProjectReservation)) {
    throw conflictError({ conflictingAssignments: conflicts.conflictingAssignments, conflictingReservations: conflicts.conflictingReservations.filter((r) => r !== sameProjectReservation) })
  }

  const project = input.projectId
    ? snapshotRef({ id: input.projectId, number: input.projectNumber, title: input.projectTitle }, 'id', { number: [40], title: [200] })
    : { id: '', number: '', title: '' }
  const staff = input.staffId || input.staffName
    ? snapshotRef({ id: input.staffId, name: input.staffName }, 'id', { name: [120] })
    : { id: '', name: '' }

  const assignment = normaliseAssignment({
    equipmentId: equipment.id,
    assetNumber: equipment.assetNumber,
    equipmentName: equipment.name,
    project,
    staff,
    startDate,
    expectedReturnDate,
    notes: input.notes,
    createdBy: actor,
  })
  await putEntry(EQUIPMENT_ASSIGNMENTS_PREFIX, assignment)

  const next = normaliseEquipment({
    ...equipment,
    status: 'Assigned',
    assignedStaff: staff,
    assignedProject: project,
  })
  next.updatedAt = new Date().toISOString()
  await putEntry(EQUIPMENT_PREFIX, next)
  await writeHistory(
    next,
    'assigned',
    `Assigned${project.title ? ` to ${project.title}` : ''}${staff.name ? ` — ${staff.name}` : ''}`,
    { actor, project: project.id ? project : null, staff: staff.id || staff.name ? staff : null },
  )

  if (sameProjectReservation) {
    const fulfilled = normaliseReservation({ ...sameProjectReservation, status: 'Fulfilled', updatedAt: new Date().toISOString() })
    await putEntry(EQUIPMENT_RESERVATIONS_PREFIX, fulfilled)
  }
  return { applied: true, equipment: withComputed(next), record: assignment }
}

export async function returnEquipment(id, input, { actor = 'Admin' } = {}) {
  const all = await readAllEquipment()
  const equipment = all.find((e) => e.id === id)
  if (!equipment) return { applied: false, reason: 'not-found' }
  const assignments = await readAssignments(id)
  const active = input.assignmentId
    ? assignments.find((a) => a.id === input.assignmentId)
    : assignments.find((a) => a.status === 'Assigned')
  if (!active || active.status !== 'Assigned') {
    fail('No active assignment found for this equipment', 404)
  }
  const returnDate = isDay(input.returnDate) ? input.returnDate : today()
  const conditionOnReturn = EQUIPMENT_CONDITIONS.includes(input.conditionOnReturn) ? input.conditionOnReturn : ''
  if (!conditionOnReturn) fail('Record the condition on return')

  const requiresMaintenance = Boolean(input.requiresMaintenance)
  const damaged = ['Damaged', 'Unusable'].includes(conditionOnReturn)
  const nextStatus = requiresMaintenance ? 'Under Maintenance' : damaged ? 'Damaged' : 'Available'

  const assignment = normaliseAssignment({
    ...active,
    status: 'Returned',
    returnDate,
    returnedAt: new Date().toISOString(),
    conditionOnReturn,
    damageReport: input.damageReport,
    requiresMaintenance,
    notes: input.notes ?? active.notes,
    updatedAt: new Date().toISOString(),
  })
  await putEntry(EQUIPMENT_ASSIGNMENTS_PREFIX, assignment)

  const next = normaliseEquipment({
    ...equipment,
    status: nextStatus,
    condition: conditionOnReturn || equipment.condition,
    assignedStaff: { id: '', name: '' },
    assignedProject: { id: '', number: '', title: '' },
  })
  next.updatedAt = new Date().toISOString()
  await putEntry(EQUIPMENT_PREFIX, next)
  await writeHistory(
    next,
    'returned',
    `Returned in ${conditionOnReturn} condition → ${nextStatus}`,
    { actor, project: active.project.id ? active.project : null, staff: active.staff.id || active.staff.name ? active.staff : null },
  )
  return { applied: true, equipment: withComputed(next), record: assignment }
}

// ------------------------------------------------------------- reservation

export async function reserveEquipment(id, input, { actor = 'Admin' } = {}) {
  const all = await readAllEquipment()
  const equipment = all.find((e) => e.id === id)
  if (!equipment) return { applied: false, reason: 'not-found' }
  if (!ASSIGNABLE_STATUSES.includes(equipment.status)) {
    fail(`This equipment is ${equipment.status.toLowerCase()} and cannot be reserved right now`, 409)
  }
  const usageStart = isDay(input.usageStart) ? input.usageStart : ''
  const usageEnd = isDay(input.usageEnd) ? input.usageEnd : ''
  if (!usageStart && !usageEnd) fail('A reservation needs an expected usage window')
  if (usageStart && usageEnd && usageEnd < usageStart) fail('Usage end cannot be before usage start')

  const conflicts = await findConflicts(id, { startDate: usageStart || usageEnd, endDate: usageEnd || usageStart })
  if (conflicts.conflictingAssignments.length > 0 || conflicts.conflictingReservations.length > 0) {
    throw conflictError(conflicts)
  }
  const project = snapshotRef({ id: input.projectId, number: input.projectNumber, title: input.projectTitle }, 'id', { number: [40], title: [200] })
  const reservation = normaliseReservation({
    equipmentId: equipment.id,
    assetNumber: equipment.assetNumber,
    equipmentName: equipment.name,
    project,
    reservedDate: isDay(input.reservedDate) ? input.reservedDate : today(),
    usageStart,
    usageEnd,
    notes: input.notes,
    createdBy: actor,
  })
  await putEntry(EQUIPMENT_RESERVATIONS_PREFIX, reservation)

  if (equipment.status === 'Available') {
    const next = normaliseEquipment({ ...equipment, status: 'Reserved' })
    next.updatedAt = new Date().toISOString()
    await putEntry(EQUIPMENT_PREFIX, next)
    await writeHistory(next, 'reserved', `Reserved${project.title ? ` for ${project.title}` : ''} (${usageStart || '?'} → ${usageEnd || 'open'})`, { actor, project: project.id ? project : null })
    return { applied: true, reservation, equipment: withComputed(next) }
  }
  await writeHistory(equipment, 'reserved', `Reserved${project.title ? ` for ${project.title}` : ''} (${usageStart || '?'} → ${usageEnd || 'open'})`, { actor, project: project.id ? project : null })
  return { applied: true, reservation, equipment: withComputed(equipment) }
}

export async function cancelReservation(equipmentId, reservationId, { actor = 'Admin' } = {}) {
  const reservations = await readReservations(equipmentId)
  const reservation = reservations.find((r) => r.id === reservationId)
  if (!reservation || reservation.status !== 'Reserved') {
    fail('Active reservation not found', 404)
  }
  const cancelled = normaliseReservation({ ...reservation, status: 'Cancelled', updatedAt: new Date().toISOString() })
  await putEntry(EQUIPMENT_RESERVATIONS_PREFIX, cancelled)

  const all = await readAllEquipment()
  const equipment = all.find((e) => e.id === equipmentId)
  if (equipment && equipment.status === 'Reserved') {
    const remaining = (await readReservations(equipmentId)).some((r) => r.status === 'Reserved')
    if (!remaining) {
      const next = normaliseEquipment({ ...equipment, status: 'Available' })
      next.updatedAt = new Date().toISOString()
      await putEntry(EQUIPMENT_PREFIX, next)
      await writeHistory(next, 'reservation_cancelled', `Reservation cancelled — available again`, { actor })
      return { applied: true, reservation: cancelled, equipment: withComputed(next) }
    }
  }
  await writeHistory(equipment, 'reservation_cancelled', 'Reservation cancelled', { actor })
  return { applied: true, reservation: cancelled, equipment: equipment ? withComputed(equipment) : null }
}

// ------------------------------------------------------------- maintenance

function computeNextMaintenance(schedule, fromDate) {
  const base = fromDate || schedule.lastDate || today()
  switch (schedule.frequency) {
    case 'Monthly':
      return addMonths(base, 1)
    case 'Quarterly':
      return addMonths(base, 3)
    case 'Biannually':
      return addMonths(base, 6)
    case 'Annually':
      return addMonths(base, 12)
    case 'Custom':
      return addDays(base, schedule.customDays || 90)
    default:
      return ''
  }
}

export async function createMaintenance(equipmentId, input, { actor = 'Admin' } = {}) {
  const all = await readAllEquipment()
  const equipment = all.find((e) => e.id === equipmentId)
  if (!equipment) fail('Equipment not found', 404)
  const record = normaliseMaintenance({
    ...input,
    equipmentId,
    assetNumber: equipment.assetNumber,
    equipmentName: equipment.name,
    createdBy: actor,
  })
  if (!record.description) fail('Describe the maintenance work')
  await putEntry(EQUIPMENT_MAINTENANCE_PREFIX, record)

  // Starting work moves the item Under Maintenance (if it is freely
  // available); Scheduled does not.
  let next = equipment
  if (record.status === 'In Progress' && equipment.status === 'Available') {
    next = normaliseEquipment({ ...equipment, status: 'Under Maintenance' })
    next.updatedAt = new Date().toISOString()
    await putEntry(EQUIPMENT_PREFIX, next)
  }
  await writeHistory(next, 'maintenance_created', `${record.type}: ${record.description} (${record.status})`, { actor })
  return { applied: true, record, equipment: withComputed(next) }
}

export async function updateMaintenance(equipmentId, recordId, patch, { actor = 'Admin' } = {}) {
  const records = await readMaintenanceRecords(equipmentId)
  const current = records.find((r) => r.id === recordId)
  if (!current) fail('Maintenance record not found', 404)
  const merged = normaliseMaintenance({ ...current, ...patch, id: current.id, createdAt: current.createdAt, updatedAt: new Date().toISOString() })
  await putEntry(EQUIPMENT_MAINTENANCE_PREFIX, merged)

  const all = await readAllEquipment()
  const equipment = all.find((e) => e.id === equipmentId)
  let next = equipment
  if (equipment) {
    const completingNow = merged.status === 'Completed' && current.status !== 'Completed'
    if (completingNow) {
      const schedule = { ...equipment.maintenanceSchedule }
      schedule.lastDate = merged.date
      schedule.nextDate = merged.nextMaintenanceDate || computeNextMaintenance(schedule, merged.date)
      const nextStatus = equipment.status === 'Under Maintenance'
        ? (['Damaged', 'Unusable'].includes(equipment.condition) ? 'Damaged' : 'Available')
        : equipment.status
      next = normaliseEquipment({ ...equipment, maintenanceSchedule: schedule, status: nextStatus })
      next.updatedAt = new Date().toISOString()
      await putEntry(EQUIPMENT_PREFIX, next)
      await writeHistory(next, 'maintenance_completed', `${merged.type}: ${merged.description} — next due ${schedule.nextDate || '—'}`, { actor })
    } else {
      await writeHistory(equipment, 'maintenance_updated', `${merged.type}: status ${current.status} → ${merged.status}`, { actor })
    }
  }
  return { applied: true, record: merged, equipment: next ? withComputed(next) : null }
}

// ------------------------------------------------------------- calibration

export async function createCalibration(equipmentId, input, { actor = 'Admin' } = {}) {
  const all = await readAllEquipment()
  const equipment = all.find((e) => e.id === equipmentId)
  if (!equipment) fail('Equipment not found', 404)
  const record = normaliseCalibration({
    ...input,
    equipmentId,
    assetNumber: equipment.assetNumber,
    equipmentName: equipment.name,
    createdBy: actor,
  })
  if (!record.date) fail('A calibration date is required')
  await putEntry(EQUIPMENT_CALIBRATIONS_PREFIX, record)

  const schedule = { ...equipment.calibrationSchedule }
  schedule.lastDate = record.date
  schedule.nextDate = record.nextCalibrationDate ||
    (schedule.frequencyMonths > 0 ? addMonths(record.date, schedule.frequencyMonths) : '')
  const nextStatus = record.result === 'Failed'
    ? 'Under Calibration'
    : equipment.status === 'Under Calibration' ? 'Available' : equipment.status
  const next = normaliseEquipment({ ...equipment, calibrationSchedule: schedule, status: nextStatus })
  next.updatedAt = new Date().toISOString()
  await putEntry(EQUIPMENT_PREFIX, next)
  await writeHistory(next, 'calibration_recorded', `${record.result} at ${record.provider || '—'} — certificate ${record.certificateNumber || '—'}, next due ${schedule.nextDate || '—'}`, { actor })
  return { applied: true, record, equipment: withComputed(next) }
}

// ------------------------------------------------------------- inspections

export async function createInspection(equipmentId, input, { actor = 'Admin' } = {}) {
  const all = await readAllEquipment()
  const equipment = all.find((e) => e.id === equipmentId)
  if (!equipment) fail('Equipment not found', 404)
  const record = normaliseInspection({
    ...input,
    equipmentId,
    assetNumber: equipment.assetNumber,
    equipmentName: equipment.name,
    createdBy: actor,
  })
  if (!record.inspector) fail('Name the inspector')
  await putEntry(EQUIPMENT_INSPECTIONS_PREFIX, record)

  const next = normaliseEquipment({ ...equipment })
  next.updatedAt = new Date().toISOString()
  const notes = []
  if (record.condition && record.condition !== equipment.condition) {
    next.condition = record.condition
    notes.push(`condition → ${record.condition}`)
  }
  if (record.nextInspectionDate) notes.push(`next inspection ${record.nextInspectionDate}`)
  await putEntry(EQUIPMENT_PREFIX, next)
  await writeHistory(next, 'inspection_recorded', `${record.type} inspection: ${record.result}${notes.length ? ` — ${notes.join(', ')}` : ''}`, { actor })
  return { applied: true, record, equipment: withComputed(next) }
}

// ------------------------------------------------------------- dashboard

export async function getEquipmentDashboard() {
  const all = await readAllEquipment()
  const active = all.filter((e) => !e.archived && e.status !== 'Retired')
  const computed = active.map((e) => withComputed(e))
  const [assignments, maintenance, calibrations, inspections] = await Promise.all([
    readAssignments(),
    readMaintenanceRecords(),
    readCalibrations(),
    readInspections(),
  ])
  const recentAssignments = assignments.filter((a) => a.status === 'Assigned').slice(0, 6)
  const recentReturns = assignments.filter((a) => a.status === 'Returned').slice(0, 5)
  const maintenanceDue = computed
    .filter((e) => e.computed.maintenanceDue)
    .sort((a, b) => String(a.maintenanceSchedule.nextDate).localeCompare(String(b.maintenanceSchedule.nextDate)))
    .slice(0, 6)
  const calibrationDue = computed
    .filter((e) => e.computed.calibrationDue)
    .sort((a, b) => String(a.calibrationSchedule.nextDate).localeCompare(String(b.calibrationSchedule.nextDate)))
    .slice(0, 6)
  const attention = computed.filter((e) => e.computed.needsAttention).slice(0, 8)
  const inspectionDue = computed.filter((e) => e.computed.conditionBad).slice(0, 6)
  return {
    cards: {
      total: active.length,
      available: computed.filter((e) => e.status === 'Available').length,
      assigned: computed.filter((e) => e.status === 'Assigned').length,
      reserved: computed.filter((e) => e.status === 'Reserved').length,
      underMaintenance: computed.filter((e) => e.status === 'Under Maintenance').length,
      underCalibration: computed.filter((e) => e.status === 'Under Calibration').length,
      calibrationDue: computed.filter((e) => e.computed.calibrationDue).length,
      inspectionDue: inspectionDue.length,
      damaged: computed.filter((e) => e.status === 'Damaged' || e.computed.conditionBad).length,
      lost: computed.filter((e) => e.status === 'Lost').length,
      retired: all.filter((e) => e.status === 'Retired').length,
      archived: all.filter((e) => e.archived || e.status === 'Archived').length,
    },
    recentlyAdded: [...computed]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 6),
    recentAssignments,
    recentReturns,
    maintenanceDue,
    calibrationDue,
    inspectionDue,
    attention,
    upcomingMaintenance: maintenance
      .filter((m) => m.status === 'Scheduled' && m.date >= today())
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 6),
  }
}

// --------------------------------------------------------------- reports

// Lightweight operational reports (PRD §27) — rows for the router's CSV.
export async function buildReport(type) {
  const all = await readAllEquipment()
  const active = all.filter((e) => !e.archived)
  const computed = active.map((e) => withComputed(e))
  const headers = ['Asset Number', 'Name', 'Category', 'Manufacturer', 'Model', 'Serial Number', 'Status', 'Condition', 'Location', 'Assigned Project', 'Assigned Staff', 'Maintenance Next', 'Calibration Next']
  const rowOf = (e) => [
    e.assetNumber, e.name, e.category.name, e.manufacturer, e.model, e.serialNumber,
    e.status, e.condition, e.location, e.assignedProject.title, e.assignedStaff.name,
    e.maintenanceSchedule.nextDate, e.calibrationSchedule.nextDate,
  ]
  switch (type) {
    case 'inventory':
      return { title: 'Equipment Inventory', headers, rows: computed.sort((a, b) => a.assetNumber.localeCompare(b.assetNumber)).map(rowOf) }
    case 'assigned':
      return { title: 'Equipment Currently Assigned', headers, rows: computed.filter((e) => e.status === 'Assigned').map(rowOf) }
    case 'maintenance':
      return { title: 'Equipment Under Maintenance', headers, rows: computed.filter((e) => e.status === 'Under Maintenance').map(rowOf) }
    case 'maintenance-due':
      return { title: 'Maintenance Due', headers, rows: computed.filter((e) => e.computed.maintenanceDue).sort((a, b) => String(a.maintenanceSchedule.nextDate).localeCompare(String(b.maintenanceSchedule.nextDate))).map(rowOf) }
    case 'calibration-due':
      return { title: 'Calibration Due', headers, rows: computed.filter((e) => e.computed.calibrationDue).sort((a, b) => String(a.calibrationSchedule.nextDate).localeCompare(String(b.calibrationSchedule.nextDate))).map(rowOf) }
    case 'damaged':
      return { title: 'Damaged Equipment', headers, rows: computed.filter((e) => e.status === 'Damaged' || e.computed.conditionBad).map(rowOf) }
    case 'by-category': {
      const map = new Map()
      for (const e of computed) map.set(e.category.name, (map.get(e.category.name) || 0) + 1)
      return { title: 'Equipment by Category', headers: ['Category', 'Count'], rows: [...map.entries()].sort((a, b) => b[1] - a[1]).map(([category, count]) => [category, String(count)]) }
    }
    case 'by-location': {
      const map = new Map()
      for (const e of computed) map.set(e.location || '—', (map.get(e.location || '—') || 0) + 1)
      return { title: 'Equipment by Location', headers: ['Location', 'Count'], rows: [...map.entries()].sort((a, b) => b[1] - a[1]).map(([location, count]) => [location, String(count)]) }
    }
    default:
      fail('Unknown report type', 404)
  }
}

// ----------------------------------------------------------- list exports

export const listAssignments = readAssignments
export const listReservations = readReservations
export const listMaintenanceRecords = readMaintenanceRecords
export const listCalibrations = readCalibrations
export const listInspections = readInspections
export const listEquipmentHistory = readHistory
export const listCategories = readCategoriesSeeded

export async function createCategory(input) {
  const categories = await readCategoriesRaw()
  const category = normaliseCategory(input)
  if (categories.some((c) => c.code === category.code || c.name.toLowerCase() === category.name.toLowerCase())) {
    fail('A category with this name or code already exists', 409)
  }
  await putEntry(EQUIPMENT_CATEGORIES_PREFIX, category)
  return category
}

export async function updateCategory(id, patch) {
  const categories = await readCategoriesRaw()
  const current = categories.find((c) => c.id === id)
  if (!current) return { applied: false }
  if (current.system && patch.name !== undefined && patch.name !== current.name) {
    fail('System categories cannot be renamed', 409)
  }
  if (patch.code !== undefined && patch.code !== current.code) {
    fail('Category codes drive asset numbers and cannot change', 409)
  }
  const next = normaliseCategory({ ...current, ...patch, id: current.id, code: current.code, system: current.system, createdAt: current.createdAt, updatedAt: new Date().toISOString() })
  const clash = categories.find((c) => c.id !== id && c.name.toLowerCase() === next.name.toLowerCase())
  if (clash) fail('A category with this name already exists', 409)
  await putEntry(EQUIPMENT_CATEGORIES_PREFIX, next)
  return next
}

export async function deleteCategory(id) {
  const categories = await readCategoriesRaw()
  const current = categories.find((c) => c.id === id)
  if (!current) return { deleted: false }
  if (current.system) fail('System categories cannot be deleted', 409)
  const all = await readAllEquipment()
  if (all.some((e) => e.category.id === id)) {
    fail('This category still has equipment registered against it', 409)
  }
  await removeEntry(EQUIPMENT_CATEGORIES_PREFIX, current)
  return { deleted: true }
}
