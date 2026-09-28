// Equipment Management System smoke test — exercises the full equipment
// lifecycle against the live Supabase database (same conventions as
// supabaseSmoke.mjs): categories → registration → assignment → conflict
// rejection → reservation → return-with-damage → maintenance → available
// again → calibration → inspection → archive/retire → history, then removes
// every created record and verifies no residue.
//
//   node scripts/emsSmoke.mjs
import { loadEnv } from './lib/env.mjs'

loadEnv()

import {
  createEquipment, updateEquipment, getEquipmentById, deleteEquipment,
  setEquipmentArchived, retireEquipment, lookupEquipment,
  assignEquipment, returnEquipment, reserveEquipment, cancelReservation,
  createMaintenance, updateMaintenance, createCalibration, createInspection,
  getEquipmentDashboard, buildReport,
  listCategories, createCategory, deleteCategory,
  readEquipment, listAssignments, listReservations, listMaintenanceRecords,
  listCalibrations, listInspections, listEquipmentHistory,
  _deriveDueState, _addMonths,
} from '../api/_lib/equipmentStore.js'
import {
  readAll, removeEntry,
  EQUIPMENT_PREFIX, EQUIPMENT_ASSIGNMENTS_PREFIX, EQUIPMENT_RESERVATIONS_PREFIX,
  EQUIPMENT_MAINTENANCE_PREFIX, EQUIPMENT_CALIBRATIONS_PREFIX,
  EQUIPMENT_INSPECTIONS_PREFIX, EQUIPMENT_HISTORY_PREFIX,
} from '../api/_lib/crmStore.js'

let passed = 0
let failed = 0
const ok = (label, condition) => {
  if (condition) {
    passed++
    console.log('  ok', label)
  } else {
    failed++
    console.log('  FAIL', label)
  }
}
const throws = async (fn, needle) => {
  try {
    await fn()
    return false
  } catch (error) {
    return needle ? String(error.message).includes(needle) && [409, 400, 404].includes(error.status) : true
  }
}

const created = [] // { id, assetNumber }
let createdCategoryId = ''
const createdIds = () => created.map((c) => c.id)

async function cleanup() {
  for (const { id, assetNumber } of created) {
    try { await deleteEquipment(id, assetNumber) } catch { /* best-effort */ }
  }
  if (createdCategoryId) {
    try { await deleteCategory(createdCategoryId) } catch { /* best-effort */ }
  }
  // Related records are removed directly (history/records of test equipment
  // are test data, not audit-worthy).
  const RELATED = [
    EQUIPMENT_ASSIGNMENTS_PREFIX, EQUIPMENT_RESERVATIONS_PREFIX,
    EQUIPMENT_MAINTENANCE_PREFIX, EQUIPMENT_CALIBRATIONS_PREFIX,
    EQUIPMENT_INSPECTIONS_PREFIX, EQUIPMENT_HISTORY_PREFIX,
  ]
  for (const prefix of RELATED) {
    try {
      const rows = await readAll(prefix)
      const mine = rows.filter((r) => createdIds().includes(r.equipmentId))
      await Promise.all(mine.map((r) => removeEntry(prefix, r).catch(() => {})))
    } catch { /* best-effort */ }
  }
}

async function residueCheck() {
  const ids = createdIds()
  const assets = created.map((c) => c.assetNumber)
  const equipmentRows = await readAll(EQUIPMENT_PREFIX)
  ok('cleanup left no equipment', equipmentRows.every((r) => !ids.includes(r.id)))
  for (const [label, prefix] of [
    ['assignments', EQUIPMENT_ASSIGNMENTS_PREFIX],
    ['reservations', EQUIPMENT_RESERVATIONS_PREFIX],
    ['maintenance', EQUIPMENT_MAINTENANCE_PREFIX],
    ['calibrations', EQUIPMENT_CALIBRATIONS_PREFIX],
    ['inspections', EQUIPMENT_INSPECTIONS_PREFIX],
    ['history', EQUIPMENT_HISTORY_PREFIX],
  ]) {
    const rows = await readAll(prefix)
    ok(`cleanup left no ${label}`, rows.every((r) => !ids.includes(r.equipmentId) && !assets.includes(r.assetNumber)))
  }
  const categories = await listCategories()
  ok('cleanup left no smoke category', categories.every((c) => c.code !== 'EMSS'))
}

const today = () => new Date().toISOString().slice(0, 10)
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

try {
  // ---------------------------------------------------------- categories
  console.log('\n1 · categories')
  let categories = await listCategories()
  ok('system categories seeded', categories.length >= 20)
  const gnss = categories.find((c) => c.code === 'GNSS')
  ok('GNSS / GPS category present', Boolean(gnss))
  const custom = await createCategory({ name: 'EMS Smoke Cat', code: 'EMSS' })
  createdCategoryId = custom.id
  ok('custom category created', custom.system === false && custom.code === 'EMSS')
  ok('duplicate category rejected', await throws(() => createCategory({ name: 'EMS Smoke Cat', code: 'EMSS2' })))
  ok('system category rename rejected', await throws(() => import('../api/_lib/equipmentStore.js').then((m) => m.updateCategory(gnss.id, { name: 'Nope' })), 'cannot be renamed'))

  // ------------------------------------------------------- registration
  console.log('\n2 · registration')
  const item1 = await createEquipment({
    categoryId: gnss.id,
    name: 'EMS Smoke GNSS Receiver',
    manufacturer: 'Trimble',
    model: 'R10',
    serialNumber: 'SNK-EMS-0001',
    purchase: { date: '2024-03-15', priceMinor: 4_500_000 },
    location: 'Ibadan Office',
    warrantyExpiry: day(200),
  })
  created.push({ id: item1.id, assetNumber: item1.assetNumber })
  ok('auto asset number allocated', /^GML-GNSS-\d{4}$/.test(item1.assetNumber))
  ok('defaults: Available / Good', item1.status === 'Available' && item1.condition === 'Good')
  ok('purchase money stored as minor units', item1.purchase.priceMinor === 4_500_000)
  ok('category snapshot saved', item1.category.code === 'GNSS' && item1.category.name === 'GNSS / GPS')
  ok('no schedule yet → no due state', item1.computed.maintenanceState === 'none' && item1.computed.calibrationState === 'none')

  const item2 = await createEquipment({
    categoryId: gnss.id,
    name: 'EMS Smoke Total Station',
    assetNumber: 'GML-TEST-9001',
    serialNumber: 'SNK-EMS-0002',
  })
  created.push({ id: item2.id, assetNumber: item2.assetNumber })
  ok('explicit asset number kept', item2.assetNumber === 'GML-TEST-9001')
  ok('duplicate asset number rejected', await throws(
    () => createEquipment({ categoryId: gnss.id, name: 'Dup', assetNumber: 'GML-TEST-9001' }),
    'already in use'))

  // ------------------------------------------------------------- lookup
  console.log('\n3 · lookup')
  const lookup = await lookupEquipment({ availableOnly: true, query: 'EMS Smoke' })
  ok('available lookup finds both', lookup.equipment.length >= 2)

  // --------------------------------------------------------- assignment
  console.log('\n4 · assignment')
  const assigned = await assignEquipment(item2.id, {
    staffName: 'EMS Smoke Staff',
    startDate: today(),
    expectedReturnDate: day(5),
    notes: 'smoke assignment',
  })
  ok('assignment → status Assigned', assigned.record.status === 'Assigned' || assigned.equipment.status === 'Assigned')
  const detailAfterAssign = await getEquipmentById(item2.id)
  ok('equipment carries assignment snapshot', detailAfterAssign.equipment.assignedStaff.name === 'EMS Smoke Staff')
  ok('active assignment on profile', detailAfterAssign.equipment.computed.activeAssignment?.status === 'Assigned')

  ok('conflicting reservation rejected', await throws(
    () => reserveEquipment(item2.id, { usageStart: today(), usageEnd: day(2) }),
    'cannot be reserved'))

  // ------------------------------------------------------- reservation
  console.log('\n5 · reservation')
  const reserved = await reserveEquipment(item1.id, {
    projectId: '',
    projectTitle: 'EMS Smoke Future Project',
    usageStart: day(1),
    usageEnd: day(3),
  })
  ok('reservation → status Reserved', reserved.equipment.status === 'Reserved')
  ok('overlapping reservation rejected', await throws(
    () => reserveEquipment(item1.id, { usageStart: day(2), usageEnd: day(4) }),
    'not free'))
  ok('reservation visible on profile', (await getEquipmentById(item1.id)).equipment.computed.activeReservations.length === 1)
  const cancelled = await cancelReservation(item1.id, reserved.reservation.id)
  ok('cancel → available again', cancelled.equipment.status === 'Available')

  // ---------------------------------------------- return + maintenance
  console.log('\n6 · return + maintenance')
  const returned = await returnEquipment(item2.id, {
    conditionOnReturn: 'Damaged',
    damageReport: 'Smoke test — dropped on site',
    requiresMaintenance: true,
  })
  ok('return → status Under Maintenance', returned.equipment.status === 'Under Maintenance')
  const assignments = await listAssignments(item2.id)
  ok('assignment closed with condition', assignments[0].status === 'Returned' && assignments[0].conditionOnReturn === 'Damaged')
  ok('equipment unassigned on return', returned.equipment.assignedStaff.name === '')

  ok('assignment while unavailable rejected', await throws(
    () => assignEquipment(item2.id, { staffName: 'X' }),
    'cannot be assigned'))

  await updateEquipment(item2.id, { condition: 'Fair' })
  const completed = await updateMaintenance(item2.id, (
    await createMaintenance(item2.id, {
      type: 'Corrective',
      description: 'Smoke test repair',
      status: 'In Progress',
      serviceProvider: 'EMS Service Centre',
      costMinor: 850_000,
      partsReplaced: ['Prism'],
    })
  ).record.id, { status: 'Completed', nextMaintenanceDate: day(90) })
  ok('maintenance completion → available', completed.equipment.status === 'Available')
  ok('schedule updated on completion', completed.equipment.maintenanceSchedule.nextDate === day(90))

  const scheduled = await createMaintenance(item2.id, { type: 'Preventive', description: 'Scheduled check', date: day(30), status: 'Scheduled' })
  const scheduledPatched = await updateMaintenance(item2.id, scheduled.record.id, { status: 'Cancelled' })
  ok('scheduled maintenance does not flip status', scheduledPatched.equipment.status === 'Available')

  // ------------------------------------------------------- calibration
  console.log('\n7 · calibration')
  const calibrated = await createCalibration(item2.id, {
    date: today(),
    provider: 'EMS Calibration Lab',
    certificateNumber: 'CAL-EMS-2026-001',
    result: 'Passed',
  })
  ok('calibration schedule set (+12 months)', calibrated.equipment.calibrationSchedule.nextDate === _addMonths(today(), 12))
  ok('due-state derives from schedule', _deriveDueState(calibrated.equipment.calibrationSchedule.nextDate, 30).state === 'ok')

  // -------------------------------------------------------- inspections
  console.log('\n8 · inspection')
  const inspected = await createInspection(item2.id, {
    type: 'Pre-field',
    inspector: 'EMS Smoke Inspector',
    condition: 'Excellent',
    findings: 'All checks passed',
    result: 'Passed',
  })
  ok('inspection updates condition', inspected.equipment.condition === 'Excellent')

  // ------------------------------------------------------------- edits
  console.log('\n9 · edits')
  const edited = await updateEquipment(item1.id, { manufacturer: 'Leica', location: 'Abuja Office' })
  ok('edit applies immutable-identity fields only', edited.equipment.manufacturer === 'Leica' && edited.equipment.assetNumber === item1.assetNumber)
  ok('asset number change rejected', await throws(() => updateEquipment(item1.id, { assetNumber: 'GML-XXX-9999' }), 'immutable'))
  const detail1 = await getEquipmentById(item1.id)
  ok('edit history recorded', detail1.history.some((h) => h.action === 'edited'))

  // ------------------------------------------------- archive and retire
  console.log('\n10 · archive + retire')
  const archived = await setEquipmentArchived(item1.id, true)
  ok('archive hides from default list', (await readEquipment({ query: 'EMS Smoke' })).equipment.every((e) => e.id !== item1.id))
  ok('archive keeps item in archive pool', (await readEquipment({ archived: 'true', query: 'EMS Smoke' })).equipment.some((e) => e.id === item1.id))
  await setEquipmentArchived(item1.id, false)
  ok('restore returns item to default list', (await readEquipment({ query: 'EMS Smoke' })).equipment.some((e) => e.id === item1.id))
  const retired = await retireEquipment(item2.id, { notes: 'EMS smoke retire' })
  ok('retire sets status Retired', retired.equipment.status === 'Retired')

  // ---------------------------------------------------------- dashboard
  console.log('\n11 · dashboard + reports')
  const dashboard = await getEquipmentDashboard()
  ok('dashboard counts include smoke items', dashboard.cards.total >= 1)
  ok('retired card counts item2', dashboard.cards.retired >= 1)
  ok('attention list renders', Array.isArray(dashboard.attention))
  const report = await buildReport('inventory')
  ok('inventory report lists smoke items', report.rows.some((r) => r[0] === 'GML-TEST-9001'))
  const byCategory = await buildReport('by-category')
  ok('category report has headers+rows', byCategory.headers.length === 2 && byCategory.rows.length > 0)

  // ------------------------------------------------------------ history
  console.log('\n12 · history')
  const history = await listEquipmentHistory(item2.id)
  const actions = new Set(history.map((h) => h.action))
  for (const action of ['created', 'assigned', 'returned', 'maintenance_created', 'maintenance_completed', 'calibration_recorded', 'inspection_recorded', 'condition_changed', 'retired']) {
    ok(`history has ${action}`, actions.has(action))
  }

  // ------------------------------------------------- pure helpers (no DB)
  console.log('\n13 · pure helpers')
  ok('deriveDueState overdue', _deriveDueState('2020-01-01', 30).overdue === true)
  ok('deriveDueState due-soon', _deriveDueState(day(5), 30).dueSoon === true)
  ok('deriveDueState none', _deriveDueState('', 30).state === 'none')
  ok('addMonths crosses year', _addMonths('2026-11-15', 3) === '2027-02-15')
} catch (error) {
  failed++
  console.error('\nUNEXPECTED FAILURE:', error.message)
} finally {
  console.log('\ncleanup')
  await cleanup()
  await residueCheck()
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
