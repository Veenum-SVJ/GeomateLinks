// CRM API endpoint (ES Module) — private admin-area router.
// Everything here is behind the shared admin session (see _lib/auth.js);
// nothing is exposed publicly. Responses for mutations are derived from the
// pre-write read, never a read-after-write (Blob propagation lag).
//
//   GET    /api/crm/dashboard            CRM overview cards + lists
//   GET    /api/crm/services             CMS service list (id+title) for forms
//   GET    /api/crm/leads                ?query&status&source&priority&assigned&service&from&to&sort&page&pageSize&archived
//   POST   /api/crm/leads                create lead
//   GET    /api/crm/leads/:id            lead + activities + follow-ups
//   PATCH  /api/crm/leads/:id            update lead (status changes audited)
//   DELETE /api/crm/leads/:id            delete lead + its activities/follow-ups
//   POST   /api/crm/leads/:id/convert    convert to client (dedupe by email/phone)
//   GET    /api/crm/clients              ?query&type&page&pageSize
//   POST   /api/crm/clients              create client
//   GET    /api/crm/clients/:id          client + linked leads
//   PATCH  /api/crm/clients/:id          update client
//   DELETE /api/crm/clients/:id          delete client
//   GET    /api/crm/activities           ?ownerType&ownerId&type&limit
//   POST   /api/crm/activities           add activity / note
//   GET    /api/crm/followups            ?status&relatedType&relatedId
//   POST   /api/crm/followups            schedule follow-up (syncs lead.nextFollowUpAt)
//   PATCH  /api/crm/followups/:id        update follow-up (Completion clears lead.nextFollowUpAt)
//   DELETE /api/crm/followups/:id        delete follow-up
import {
  readLeads, getLeadById, createLead, updateLead, deleteLead, convertLead,
  readClients, getClientById, createClient, updateClient, deleteClient,
  createActivity, readActivities,
  createFollowup, readFollowups, getFollowupById, updateFollowup, deleteFollowup,
  getDashboard,
} from './_lib/crmStore.js'
import { readContent } from './_lib/store.js'
import { authDisabled, isAuthenticated } from './_lib/auth.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const fallbackModule = require('./_data/content.json')
const fallbackContent = fallbackModule.default || fallbackModule

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
  const path = url.pathname.replace(/^\/api\/crm/, '').replace(/\/+$/, '') || '/'

  // CRM data is private — same session gate as the rest of the admin area.
  if (!authDisabled() && !isAuthenticated(req)) {
    return json(res, 401, { error: 'Unauthorized' })
  }

  const seg = path.split('/').filter(Boolean)
  // seg[0] = resource, seg[1] = id, seg[2] = action
  const resource = seg[0] || ''
  const id = seg[1] || ''
  const action = seg[2] || ''
  const q = Object.fromEntries(url.searchParams.entries())

  try {
    // ---------------------------------------------------------- dashboard
    if (resource === 'dashboard' && method === 'GET') {
      return json(res, 200, await getDashboard())
    }

    // ----------------------------------------------------------- services
    // CMS-managed services for lead form dropdowns (id + title only). The
    // lead stores a snapshot, so later renames/removals never corrupt history.
    if (resource === 'services' && method === 'GET') {
      const content = await readContent(fallbackContent)
      const services = (Array.isArray(content?.services) ? content.services : []).map((s) => ({
        id: s.id,
        title: s.title,
      }))
      return json(res, 200, { services })
    }

    // --------------------------------------------------------------- leads
    if (resource === 'leads' && method === 'GET' && !id) {
      return json(res, 200, await readLeads(q))
    }
    if (resource === 'leads' && method === 'POST' && !id) {
      const lead = await createLead(parseBody(req))
      return json(res, 201, { ok: true, lead })
    }
    if (resource === 'leads' && id && !action) {
      if (method === 'GET') {
        const lead = await getLeadById(id)
        if (!lead) return json(res, 404, { error: 'Lead not found' })
        const [activities, followups] = await Promise.all([
          readActivities({ ownerId: id, limit: 200 }),
          readFollowups({ relatedType: 'lead', relatedId: id }),
        ])
        return json(res, 200, { lead, activities, followups })
      }
      if (method === 'PATCH') {
        const result = await updateLead(id, parseBody(req))
        if (!result.applied) return json(res, 404, { error: 'Lead not found' })
        return json(res, 200, { ok: true, lead: result.lead })
      }
      if (method === 'DELETE') {
        const result = await deleteLead(id)
        if (!result.deleted) return json(res, 404, { error: 'Lead not found' })
        return json(res, 200, { ok: true, ...result })
      }
    }
    if (resource === 'leads' && id && action === 'convert' && method === 'POST') {
      const result = await convertLead(id, parseBody(req))
      if (!result.applied) return json(res, 404, { error: 'Lead not found' })
      return json(res, 200, { ok: true, created: result.created, lead: result.lead, client: result.client })
    }

    // ------------------------------------------------------------- clients
    if (resource === 'clients' && method === 'GET' && !id) {
      return json(res, 200, await readClients(q))
    }
    if (resource === 'clients' && method === 'POST' && !id) {
      const client = await createClient(parseBody(req))
      return json(res, 201, { ok: true, client })
    }
    if (resource === 'clients' && id && !action) {
      if (method === 'GET') {
        const client = await getClientById(id)
        if (!client) return json(res, 404, { error: 'Client not found' })
        const leads = await readLeads({ clientId: id, pageSize: 100 })
        const [activities, followups] = await Promise.all([
          readActivities({ ownerType: 'client', ownerId: id, limit: 200 }),
          readFollowups({ relatedType: 'client', relatedId: id }),
        ])
        return json(res, 200, { client, leads: leads.leads, activities, followups })
      }
      if (method === 'PATCH') {
        const result = await updateClient(id, parseBody(req))
        if (!result.applied) return json(res, 404, { error: 'Client not found' })
        return json(res, 200, { ok: true, client: result.client })
      }
      if (method === 'DELETE') {
        const result = await deleteClient(id)
        if (!result.deleted) return json(res, 404, { error: 'Client not found' })
        return json(res, 200, { ok: true })
      }
    }

    // ---------------------------------------------------------- activities
    if (resource === 'activities' && method === 'GET' && !id) {
      return json(res, 200, { activities: await readActivities(q) })
    }
    if (resource === 'activities' && method === 'POST' && !id) {
      const body = parseBody(req)
      const activity = await createActivity(body, { actor: body.createdBy })
      return json(res, 201, { ok: true, activity })
    }

    // ----------------------------------------------------------- followups
    if (resource === 'followups' && method === 'GET' && !id) {
      return json(res, 200, { followups: await readFollowups(q) })
    }
    if (resource === 'followups' && method === 'POST' && !id) {
      const followup = await createFollowup(parseBody(req))
      // Keep the lead's next-follow-up badge in sync with the schedule.
      if (followup.relatedType === 'lead' && followup.status === 'Pending') {
        await updateLead(followup.relatedId, { nextFollowUpAt: `${followup.date}T${followup.time || '09:00'}:00` }).catch(() => {})
      }
      return json(res, 201, { ok: true, followup })
    }
    if (resource === 'followups' && id && !action) {
      if (method === 'PATCH') {
        const result = await updateFollowup(id, parseBody(req))
        if (!result.applied) return json(res, 404, { error: 'Follow-up not found' })
        const f = result.followup
        if (f.relatedType === 'lead') {
          if (f.status === 'Completed' || f.status === 'Cancelled') {
            // Completed follow-ups also mark the lead as recently contacted.
            await updateLead(f.relatedId, { nextFollowUpAt: '' }).catch(() => {})
          } else if (f.status === 'Pending') {
            await updateLead(f.relatedId, { nextFollowUpAt: `${f.date}T${f.time || '09:00'}:00` }).catch(() => {})
          }
        }
        return json(res, 200, { ok: true, followup: f })
      }
      if (method === 'DELETE') {
        const result = await deleteFollowup(id)
        if (!result.deleted) return json(res, 404, { error: 'Follow-up not found' })
        return json(res, 200, { ok: true })
      }
    }

    return json(res, 404, { error: 'Not found' })
  } catch (err) {
    console.error('[api/crm]', method, path, err)
    const status = err?.status || 500
    return json(res, status, { error: err?.message || 'CRM request failed' })
  }
}
