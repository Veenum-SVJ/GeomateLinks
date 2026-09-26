// Quotations API endpoint (ES Module) — private admin-area router, same
// shape as api/crm.js: everything behind the shared admin session
// (see _lib/auth.js); nothing is exposed publicly; mutation responses are
// derived from the pre-write read, never a read-after-write.
//
//   GET    /api/quotations/dashboard            overview cards + lists
//   GET    /api/quotations/services             CMS service list (id+title)
//   GET    /api/quotations                      ?query&status&clientId&leadId&serviceId&from&to&amountMin&amountMax&expiredBefore&expiredAfter&archived&sort&allVersions&page&pageSize
//   POST   /api/quotations                      create quotation (client/lead resolution server-side)
//   GET    /api/quotations/:id                  quotation + history + version siblings
//   PATCH  /api/quotations/:id                  update (Drafts only — 409 otherwise)
//   POST   /api/quotations/:id/status           change status {status, reason?, notes?}
//   POST   /api/quotations/:id/send             sending interface {to, cc?, subject?, message?} → marks Sent (no provider yet)
//   POST   /api/quotations/:id/revise           create revision (same number, version+1)
//   POST   /api/quotations/:id/duplicate        duplicate → new draft with a new number
//   POST   /api/quotations/:id/archive          archive / restore {archived: bool}
//   GET    /api/quotations/:id/history          audit entries
//   GET    /api/quotations/:id/versions         version chain
//   GET    /api/quotations/by-lead/:leadId      quotations for a lead (CRM view)
//   GET    /api/quotations/by-client/:clientId  quotations for a client (CRM view)
//   POST   /api/quotations/:id/project-handoff  Accepted → future PMS integration point
//   DELETE /api/quotations/:id                  hard delete — NOT in the UI; requires ?confirm=<number>
//                                               (archiving/cancelling is the normal path)
import {
  readQuotationsWithExpiration, getQuotationByIdWithExpiration, getQuotationById,
  createQuotation, updateQuotation, changeStatus, sendQuotation, reviseQuotation,
  duplicateQuotation, setArchived, deleteQuotation, getQuotationDashboard,
  readServiceCatalogue, listQuotationsByLead, listQuotationsByClient, prepareProjectHandoff,
} from './_lib/quotationStore.js'
import { authDisabled, isAuthenticated } from './_lib/auth.js'

function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.status(status).json(data)
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
  const path = url.pathname.replace(/^\/api\/quotations/, '').replace(/\/+$/, '') || '/'

  // Quotation data is private — same session gate as the rest of the admin area.
  if (!authDisabled() && !isAuthenticated(req)) {
    return json(res, 401, { error: 'Unauthorized' })
  }

  const seg = path.split('/').filter(Boolean)
  // seg[0] = resource | 'by-lead' | 'by-client', seg[1] = id, seg[2] = action
  const resource = seg[0] || ''
  const id = seg[1] || ''
  const action = seg[2] || ''
  const q = Object.fromEntries(url.searchParams.entries())

  try {
    // ---------------------------------------------------------- dashboard
    if (resource === 'dashboard' && method === 'GET') {
      return json(res, 200, await getQuotationDashboard())
    }

    // ----------------------------------------------------------- services
    // CMS-managed service catalogue for quotation line items (id + title).
    if (resource === 'services' && method === 'GET') {
      return json(res, 200, { services: await readServiceCatalogue() })
    }

    // -------------------------------------------------------- CRM lookups
    if (resource === 'by-lead' && id && method === 'GET' && !action) {
      return json(res, 200, { quotations: await listQuotationsByLead(id) })
    }
    if (resource === 'by-client' && id && method === 'GET' && !action) {
      return json(res, 200, { quotations: await listQuotationsByClient(id) })
    }

    // --------------------------------------------------------- quotations
    if (resource === 'quotations' || resource === '') {
      if (method === 'GET' && !id) {
        return json(res, 200, await readQuotationsWithExpiration(q))
      }
      if (method === 'POST' && !id) {
        const quotation = await createQuotation(parseBody(req))
        return json(res, 201, { ok: true, quotation })
      }
      if (id && !action) {
        if (method === 'GET') {
          const detail = await getQuotationByIdWithExpiration(id)
          if (!detail) return json(res, 404, { error: 'Quotation not found' })
          return json(res, 200, detail)
        }
        if (method === 'PATCH') {
          const result = await updateQuotation(id, parseBody(req))
          if (!result.applied) return json(res, 404, { error: 'Quotation not found' })
          return json(res, 200, { ok: true, quotation: result.quotation })
        }
        if (method === 'DELETE') {
          // Guarded hard delete: not surfaced in the UI, requires the exact
          // quotation number as ?confirm= (archiving is the normal path).
          if (q.confirm !== q.number) {
            return json(res, 400, { error: 'Hard delete requires ?number=<quotation number>&confirm=<same number>' })
          }
          const result = await deleteQuotation(id)
          if (!result.deleted) return json(res, 404, { error: 'Quotation not found' })
          return json(res, 200, { ok: true, ...result })
        }
      }
      if (id && action && method === 'POST') {
        const body = parseBody(req)
        if (action === 'status') {
          const result = await changeStatus(id, body.status, { reason: body.reason, notes: body.notes })
          if (!result.applied) return json(res, 404, { error: 'Quotation not found' })
          return json(res, 200, { ok: true, quotation: result.quotation })
        }
        if (action === 'send') {
          const result = await sendQuotation(id, body, { isResend: Boolean(body.isResend) })
          if (!result.applied) return json(res, 404, { error: 'Quotation not found' })
          return json(res, 200, { ok: true, emailConfigured: result.emailConfigured, quotation: result.quotation })
        }
        if (action === 'revise') {
          const result = await reviseQuotation(id)
          if (!result.applied) return json(res, 404, { error: 'Quotation not found' })
          return json(res, 201, { ok: true, quotation: result.quotation })
        }
        if (action === 'duplicate') {
          const result = await duplicateQuotation(id)
          if (!result.applied) return json(res, 404, { error: 'Quotation not found' })
          return json(res, 201, { ok: true, quotation: result.quotation, sourceNumber: result.sourceNumber })
        }
        if (action === 'archive') {
          const result = await setArchived(id, Boolean(body.archived))
          if (!result.applied) return json(res, 404, { error: 'Quotation not found' })
          return json(res, 200, { ok: true, quotation: result.quotation })
        }
        if (action === 'project-handoff') {
          const result = await prepareProjectHandoff(id)
          if (!result.applied) return json(res, 404, { error: 'Quotation not found' })
          return json(res, 200, { ok: true, handoff: result.handoff })
        }
      }
      if (id && action === 'history' && method === 'GET') {
        const detail = await getQuotationById(id)
        if (!detail) return json(res, 404, { error: 'Quotation not found' })
        return json(res, 200, { history: detail.history })
      }
      if (id && action === 'versions' && method === 'GET') {
        const detail = await getQuotationById(id)
        if (!detail) return json(res, 404, { error: 'Quotation not found' })
        return json(res, 200, { versions: detail.versions })
      }
    }

    return json(res, 404, { error: 'Not found' })
  } catch (err) {
    console.error('[api/quotations]', method, path, err)
    const status = err?.status || 500
    return json(res, status, { error: err?.message || 'Quotation request failed' })
  }
}
