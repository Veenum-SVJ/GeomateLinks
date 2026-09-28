// Equipment API endpoint (ES Module) — private admin-area router, same shape
// as api/projects.js and api/crm.js: everything behind the shared admin
// session (see _lib/auth.js); nothing is exposed publicly; error messages
// surface verbatim (duplicate asset numbers, assignment conflicts, …).
//
//   GET    /api/equipment/dashboard                     overview cards + alert lists
//   GET    /api/equipment                               list ?query&categoryId&status&condition&location&projectId&staffId&purchaseYear&maintenance&calibration&archived&sort&page&pageSize
//   POST   /api/equipment                               register equipment
//   GET    /api/equipment/lookup                        picker ?query&availableOnly
//   GET    /api/equipment/categories                    categories (seeds system set)
//   POST   /api/equipment/categories                    create category
//   PATCH  /api/equipment/categories/:id                rename/describe category
//   DELETE /api/equipment/categories/:id                delete custom category
//   GET    /api/equipment/reports/:type                 report JSON (?format=csv → CSV download)
//   GET    /api/equipment/assignments                   ?equipmentId&status
//   GET    /api/equipment/reservations                  ?equipmentId&status
//   GET    /api/equipment/maintenance                   ?equipmentId
//   GET    /api/equipment/calibrations                  ?equipmentId
//   GET    /api/equipment/inspections                   ?equipmentId
//   GET    /api/equipment/history                       ?equipmentId&limit
//   GET    /api/equipment/:id                           profile (equipment + all related records)
//   PATCH  /api/equipment/:id                           edit (asset number immutable)
//   DELETE /api/equipment/:id                           hard delete — requires ?confirm=<assetNumber>
//   POST   /api/equipment/:id/assign                    {projectId?, projectNumber?, projectTitle?, staffId?, staffName?, startDate?, expectedReturnDate?, notes?}
//   POST   /api/equipment/:id/return                    {assignmentId?, returnDate?, conditionOnReturn, damageReport?, requiresMaintenance?, notes?}
//   POST   /api/equipment/:id/reserve                   {projectId?, projectNumber?, projectTitle?, reservedDate?, usageStart?, usageEnd?, notes?}
//   POST   /api/equipment/:id/reservations/:rid/cancel  cancel a reservation
//   POST   /api/equipment/:id/maintenance               record maintenance
//   PATCH  /api/equipment/:id/maintenance/:recordId     update maintenance (completing recalculates the schedule)
//   POST   /api/equipment/:id/calibrations              record calibration
//   POST   /api/equipment/:id/inspections               record inspection
//   POST   /api/equipment/:id/archive                   archive / restore {archived: bool, notes?}
//   POST   /api/equipment/:id/retire                    retire from service {notes?}
import {
  readEquipment, getEquipmentById, createEquipment, updateEquipment,
  deleteEquipment, setEquipmentArchived, retireEquipment, lookupEquipment,
  assignEquipment, returnEquipment, reserveEquipment, cancelReservation,
  createMaintenance, updateMaintenance, createCalibration, createInspection,
  getEquipmentDashboard, buildReport,
  listAssignments, listReservations, listMaintenanceRecords, listCalibrations,
  listInspections, listEquipmentHistory, listCategories,
  createCategory, updateCategory, deleteCategory,
} from './_lib/equipmentStore.js'
import { authDisabled, isAuthenticated } from './_lib/auth.js'

function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.status(status).json(data)
}

function csv(res, filename, headers, rows) {
  const escape = (value) => {
    const s = String(value ?? '')
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.status(200).send(`\uFEFF${body}`)
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body
}

export default async function handler(req, res) {
  const method = req.method || 'GET'
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const path = url.pathname.replace(/^\/api\/equipment/, '').replace(/\/+$/, '') || '/'
  const q = Object.fromEntries(url.searchParams.entries())

  // Equipment records, asset/serial numbers, maintenance and costs are
  // internal — the same session gate as the rest of the admin area.
  if (!authDisabled() && !isAuthenticated(req)) {
    return json(res, 401, { error: 'Unauthorized' })
  }

  const seg = path.split('/').filter(Boolean)
  // Path shapes after the prefix strip:
  //   /dashboard | /lookup | /categories[/:id] | /reports/:type
  //   /assignments | /reservations | /maintenance | /calibrations | /inspections | /history   (module-wide lists, ?equipmentId=…)
  //   / (list)  | /:id[/:action[/:subId[/:subAction]]]
  const KEYWORD_RESOURCES = [
    'dashboard', 'lookup', 'categories', 'reports',
    'assignments', 'reservations', 'maintenance', 'calibrations', 'inspections', 'history',
  ]
  const raw = seg[0] || ''
  let resource = raw
  let id = seg[1] || ''
  let action = seg[2] || ''
  let subId = seg[3] || ''
  if (raw && !KEYWORD_RESOURCES.includes(raw)) {
    // /api/equipment/<id>/… — normalise so the equipment branch matches.
    id = raw
    action = seg[1] || ''
    subId = seg[2] || ''
    resource = 'equipment'
  }

  try {
    // ---------------------------------------------------------- dashboard
    if (resource === 'dashboard' && method === 'GET' && !id) {
      return json(res, 200, await getEquipmentDashboard())
    }

    // ------------------------------------------------------------- lookup
    if (resource === 'lookup' && method === 'GET' && !id) {
      return json(res, 200, await lookupEquipment(q))
    }

    // --------------------------------------------------------- categories
    if (resource === 'categories') {
      if (method === 'GET' && !id) return json(res, 200, { categories: await listCategories() })
      if (method === 'POST' && !id) return json(res, 201, { ok: true, category: await createCategory(parseBody(req)) })
      if (id && method === 'PATCH') {
        const category = await updateCategory(id, parseBody(req))
        if (!category) return json(res, 404, { error: 'Category not found' })
        return json(res, 200, { ok: true, category })
      }
      if (id && method === 'DELETE') {
        const result = await deleteCategory(id)
        if (!result.deleted) return json(res, 404, { error: 'Category not found' })
        return json(res, 200, { ok: true, ...result })
      }
    }

    // ------------------------------------------------------------ reports
    if (resource === 'reports' && id && method === 'GET' && !action) {
      const report = await buildReport(id)
      const slug = report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      if (q.format === 'csv') return csv(res, `${slug}.csv`, report.headers, report.rows)
      return json(res, 200, report)
    }

    // ------------------------------------------------- module-wide lists
    const LIST_RESOURCES = {
      assignments: listAssignments,
      reservations: listReservations,
      maintenance: listMaintenanceRecords,
      calibrations: listCalibrations,
      inspections: listInspections,
      history: listEquipmentHistory,
    }
    if (LIST_RESOURCES[resource] && method === 'GET' && !id) {
      const rows = await LIST_RESOURCES[resource](
        q.equipmentId || '',
        { projectId: q.projectId || '' },
      )
      const filtered = q.status ? rows.filter((r) => r.status === q.status) : rows
      return json(res, 200, { [resource]: filtered.slice(0, q.limit ? Number(q.limit) : undefined || 500) })
    }

    // ----------------------------------------------------------- equipment
    if (resource === 'equipment' || resource === '') {
      if (method === 'GET' && !id) return json(res, 200, await readEquipment(q))
      if (method === 'POST' && !id) {
        const equipment = await createEquipment(parseBody(req))
        return json(res, 201, { ok: true, equipment })
      }
      if (id && !action) {
        if (method === 'GET') {
          const detail = await getEquipmentById(id)
          if (!detail) return json(res, 404, { error: 'Equipment not found' })
          return json(res, 200, detail)
        }
        if (method === 'PATCH') {
          const result = await updateEquipment(id, parseBody(req))
          if (!result.applied) return json(res, 404, { error: 'Equipment not found' })
          return json(res, 200, { ok: true, equipment: result.equipment })
        }
        if (method === 'DELETE') {
          const result = await deleteEquipment(id, q.confirm || '')
          if (!result.deleted) return json(res, 404, { error: 'Equipment not found' })
          return json(res, 200, { ok: true, ...result })
        }
      }
      if (id && action && method === 'POST') {
        const body = parseBody(req)
        if (action === 'assign') {
          const result = await assignEquipment(id, body)
          if (!result.applied) return json(res, 404, { error: 'Equipment not found' })
          return json(res, 200, { ok: true, ...result })
        }
        if (action === 'return') {
          const result = await returnEquipment(id, body)
          if (!result.applied) return json(res, 404, { error: 'Equipment not found' })
          return json(res, 200, { ok: true, ...result })
        }
        if (action === 'reserve') {
          const result = await reserveEquipment(id, body)
          if (!result.applied) return json(res, 404, { error: 'Equipment not found' })
          return json(res, 200, { ok: true, ...result })
        }
        if (action === 'archive') {
          const result = await setEquipmentArchived(id, Boolean(body.archived), { notes: body.notes })
          if (!result.applied) return json(res, 404, { error: 'Equipment not found' })
          return json(res, 200, { ok: true, ...result })
        }
        if (action === 'retire') {
          const result = await retireEquipment(id, { notes: body.notes })
          if (!result.applied) return json(res, 404, { error: 'Equipment not found' })
          return json(res, 200, { ok: true, ...result })
        }
        if (action === 'maintenance') {
          const result = await createMaintenance(id, body)
          return json(res, 201, { ok: true, ...result })
        }
        if (action === 'calibrations') {
          const result = await createCalibration(id, body)
          return json(res, 201, { ok: true, ...result })
        }
        if (action === 'inspections') {
          const result = await createInspection(id, body)
          return json(res, 201, { ok: true, ...result })
        }
      }
      if (id && action === 'maintenance' && subId && method === 'PATCH') {
        const result = await updateMaintenance(id, subId, parseBody(req))
        return json(res, 200, { ok: true, ...result })
      }
      if (id && action === 'reservations' && subId && (seg[3] === 'cancel' || seg[4] === 'cancel') && method === 'POST') {
        const result = await cancelReservation(id, subId)
        return json(res, 200, { ok: true, ...result })
      }
    }

    return json(res, 404, { error: 'Not found' })
  } catch (error) {
    const status = error.status || 500
    if (status >= 500) console.error('[equipment]', error)
    return json(res, status, { error: error.message || 'Equipment request failed', code: error.code, conflicts: error.conflicts })
  }
}
