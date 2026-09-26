// Projects API endpoint (ES Module) — private admin-area router, same shape
// as api/quotations.js and api/crm.js: everything behind the shared admin
// session (see _lib/auth.js); nothing is exposed publicly; mutation
// responses are derived from the pre-write read, never a read-after-write.
//
//   GET    /api/projects/dashboard                 overview cards + lists + alerts
//   GET    /api/projects                           ?query&status&serviceId&clientId&leadId&quotationId&priority&projectType&managerStaffId&staffId&from&to&archived&sort&page&pageSize
//   POST   /api/projects                           create project (manual or from a handoff payload)
//   GET    /api/projects/by-client/:clientId       projects for a CRM client
//   GET    /api/projects/by-lead/:leadId           projects for a CRM lead
//   GET    /api/projects/by-quotation/:quotationId projects for a quotation
//   GET    /api/projects/:id                       project (with computed) + timeline activities
//   PATCH  /api/projects/:id                       general edit (identity/links immutable)
//   POST   /api/projects/:id/status                change status {status, notes?}
//   POST   /api/projects/:id/progress              update progress {progressPct, note?}
//   POST   /api/projects/:id/complete              completion {completionSummary?, finalNotes?, clientFacingSummary?}
//   POST   /api/projects/:id/archive               archive / restore {archived: bool}
//   POST   /api/projects/:id/tasks                 add task
//   PATCH  /api/projects/:id/tasks/:taskId         edit task
//   DELETE /api/projects/:id/tasks/:taskId         remove task
//   POST   /api/projects/:id/milestones            add milestone
//   PATCH  /api/projects/:id/milestones/:mid       edit milestone
//   DELETE /api/projects/:id/milestones/:mid       remove milestone
//   POST   /api/projects/:id/deliverables          add deliverable (metadata — DMS attaches files later)
//   PATCH  /api/projects/:id/deliverables/:did     edit deliverable
//   DELETE /api/projects/:id/deliverables/:did     remove deliverable
//   POST   /api/projects/:id/team                  add team member {staffId?|name, role?, makeManager?}
//   DELETE /api/projects/:id/team/:memberId        remove team member
//   POST   /api/projects/:id/manager               set project manager {memberId}
//   POST   /api/projects/:id/activities            timeline update {type?, description, progressPct?}
//   POST   /api/projects/:id/publish               mark published-to-portfolio (metadata; the SiteContent save itself is the admin content flow)
//   POST   /api/projects/:id/unpublish             clear publication metadata
//   GET    /api/projects/:id/audit                 embedded audit history
//   GET    /api/projects/:id/activities            timeline entries for one project
//   GET    /api/projects/staff                     staff/team directory
//   POST   /api/projects/staff                     create staff member
//   PATCH  /api/projects/staff/:id                 edit staff member
//   DELETE /api/projects/staff/:id                 remove staff member (assignments keep their snapshot)
//   DELETE /api/projects/:id                       hard delete — NOT in the UI; requires ?confirm=<number>
//                                                  (archiving is the normal path)
import {
  readProjects, getProjectById, createProject, updateProject,
  changeProjectStatus, updateProjectProgress, completeProject,
  setProjectArchived, deleteProject,
  addTask, updateTask, removeTask,
  addMilestone, updateMilestone, removeMilestone,
  addDeliverable, updateDeliverable, removeDeliverable,
  addTeamMember, removeTeamMember, setProjectManager,
  addProjectActivity,
  publishProject, unpublishProject,
  getProjectDashboard,
  readStaff, createStaff, updateStaff, deleteStaff,
  listProjectsByClient, listProjectsByLead, listProjectsByQuotation,
} from './_lib/projectStore.js'
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
  const path = url.pathname.replace(/^\/api\/projects/, '').replace(/\/+$/, '') || '/'

  // Project, team and financial data are private — same session gate as the
  // rest of the admin area.
  if (!authDisabled() && !isAuthenticated(req)) {
    return json(res, 401, { error: 'Unauthorized' })
  }

  const seg = path.split('/').filter(Boolean)
  // Path shapes after the prefix strip:
  //   /dashboard | /staff[/:id] | /by-client/:id | /by-lead/:id | /by-quotation/:id
  //   / (list)   | /:id[/:action[/:subId]]          ← resource IS the project id
  const KEYWORD_RESOURCES = ['dashboard', 'staff', 'by-client', 'by-lead', 'by-quotation', 'projects']
  const raw = seg[0] || ''
  let resource = raw
  let id = seg[1] || ''
  let action = seg[2] || ''
  if (raw && !KEYWORD_RESOURCES.includes(raw)) {
    // /api/projects/<id>/… — normalise so the project branch matches.
    id = raw
    action = seg[1] || ''
    resource = 'projects'
  }
  const q = Object.fromEntries(url.searchParams.entries())

  try {
    // ---------------------------------------------------------- dashboard
    if (resource === 'dashboard' && method === 'GET' && !id) {
      return json(res, 200, await getProjectDashboard())
    }

    // -------------------------------------------------------------- staff
    if (resource === 'staff') {
      if (method === 'GET' && !id) return json(res, 200, { staff: await readStaff() })
      if (method === 'POST' && !id) return json(res, 201, { ok: true, staff: await createStaff(parseBody(req)) })
      if (id && method === 'PATCH') {
        const result = await updateStaff(id, parseBody(req))
        if (!result.applied) return json(res, 404, { error: 'Staff member not found' })
        return json(res, 200, { ok: true, staff: result.staff })
      }
      if (id && method === 'DELETE') {
        const result = await deleteStaff(id)
        if (!result.deleted) return json(res, 404, { error: 'Staff member not found' })
        return json(res, 200, { ok: true, ...result })
      }
    }

    // -------------------------------------------------------- CRM lookups
    if (resource === 'by-client' && id && method === 'GET' && !action) {
      return json(res, 200, { projects: await listProjectsByClient(id) })
    }
    if (resource === 'by-lead' && id && method === 'GET' && !action) {
      return json(res, 200, { projects: await listProjectsByLead(id) })
    }
    if (resource === 'by-quotation' && id && method === 'GET' && !action) {
      return json(res, 200, { projects: await listProjectsByQuotation(id) })
    }

    // ------------------------------------------------------------ projects
    if (resource === 'projects' || resource === '') {
      if (method === 'GET' && !id) {
        return json(res, 200, await readProjects(q))
      }
      if (method === 'POST' && !id) {
        const project = await createProject(parseBody(req))
        return json(res, 201, { ok: true, project })
      }
      if (id && !action) {
        if (method === 'GET') {
          const detail = await getProjectById(id)
          if (!detail) return json(res, 404, { error: 'Project not found' })
          return json(res, 200, detail)
        }
        if (method === 'PATCH') {
          const result = await updateProject(id, parseBody(req))
          if (!result.applied) return json(res, 404, { error: 'Project not found' })
          return json(res, 200, { ok: true, project: result.project })
        }
        if (method === 'DELETE') {
          // Guarded hard delete: not surfaced in the UI, requires the exact
          // project number as ?confirm= (archiving is the normal path).
          if (q.confirm !== q.number) {
            return json(res, 400, { error: 'Hard delete requires ?number=<project number>&confirm=<same number>' })
          }
          const result = await deleteProject(id)
          if (!result.deleted) return json(res, 404, { error: 'Project not found' })
          return json(res, 200, { ok: true, ...result })
        }
      }
      if (id && action && method === 'POST') {
        const body = parseBody(req)
        if (action === 'status') {
          const result = await changeProjectStatus(id, body.status, { actor: 'Admin', notes: body.notes })
          if (!result.applied) return json(res, 404, { error: 'Project not found' })
          return json(res, 200, { ok: true, project: result.project })
        }
        if (action === 'progress') {
          const result = await updateProjectProgress(id, body.progressPct, { actor: 'Admin', note: body.note })
          if (!result.applied) return json(res, 404, { error: 'Project not found' })
          return json(res, 200, { ok: true, project: result.project })
        }
        if (action === 'complete') {
          const result = await completeProject(id, body)
          if (!result.applied) return json(res, 404, { error: 'Project not found' })
          return json(res, 200, { ok: true, project: result.project, outstanding: result.outstanding })
        }
        if (action === 'archive') {
          const result = await setProjectArchived(id, Boolean(body.archived))
          if (!result.applied) return json(res, 404, { error: 'Project not found' })
          return json(res, 200, { ok: true, project: result.project })
        }
        if (action === 'tasks') {
          const result = await addTask(id, body)
          if (!result.applied) return json(res, 404, { error: 'Project not found' })
          return json(res, 201, { ok: true, project: result.project, task: result.task })
        }
        if (action === 'milestones') {
          const result = await addMilestone(id, body)
          if (!result.applied) return json(res, 404, { error: 'Project not found' })
          return json(res, 201, { ok: true, project: result.project, milestone: result.milestone })
        }
        if (action === 'deliverables') {
          const result = await addDeliverable(id, body)
          if (!result.applied) return json(res, 404, { error: 'Project not found' })
          return json(res, 201, { ok: true, project: result.project, deliverable: result.deliverable })
        }
        if (action === 'team') {
          const result = await addTeamMember(id, body)
          if (!result.applied) return json(res, 404, { error: 'Project not found' })
          return json(res, 201, { ok: true, project: result.project, member: result.member })
        }
        if (action === 'manager') {
          const result = await setProjectManager(id, body.memberId)
          if (!result.applied) return json(res, 404, { error: 'Project not found' })
          return json(res, 200, { ok: true, project: result.project })
        }
        if (action === 'activities') {
          const result = await addProjectActivity(id, body)
          if (!result.applied) return json(res, 404, { error: 'Project not found' })
          return json(res, 201, { ok: true, activity: result.activity, project: result.project })
        }
        if (action === 'publish') {
          const result = await publishProject(id, body.publication || body)
          if (!result.applied) return json(res, 404, { error: 'Project not found' })
          return json(res, 200, { ok: true, project: result.project, publication: result.publication })
        }
        if (action === 'unpublish') {
          const result = await unpublishProject(id)
          if (!result.applied) return json(res, 404, { error: 'Project not found' })
          return json(res, 200, { ok: true, project: result.project })
        }
      }
      // Nested resources: /:id/tasks/:taskId … — action is the collection,
      // seg[2] is the child id (in both raw and normalised shapes).
      if (id && action && seg[2] && (method === 'PATCH' || method === 'DELETE')) {
        const subId = seg[2]
        const body = parseBody(req)
        const notFound = { error: 'Project not found' }
        if (action === 'tasks') {
          if (method === 'PATCH') {
            const result = await updateTask(id, subId, body)
            if (!result.applied) return json(res, 404, notFound)
            return json(res, 200, { ok: true, project: result.project, task: result.task })
          }
          const result = await removeTask(id, subId)
          if (!result.applied) return json(res, 404, notFound)
          return json(res, 200, { ok: true, project: result.project })
        }
        if (action === 'milestones') {
          if (method === 'PATCH') {
            const result = await updateMilestone(id, subId, body)
            if (!result.applied) return json(res, 404, notFound)
            return json(res, 200, { ok: true, project: result.project, milestone: result.milestone })
          }
          const result = await removeMilestone(id, subId)
          if (!result.applied) return json(res, 404, notFound)
          return json(res, 200, { ok: true, project: result.project })
        }
        if (action === 'deliverables') {
          if (method === 'PATCH') {
            const result = await updateDeliverable(id, subId, body)
            if (!result.applied) return json(res, 404, notFound)
            return json(res, 200, { ok: true, project: result.project, deliverable: result.deliverable })
          }
          const result = await removeDeliverable(id, subId)
          if (!result.applied) return json(res, 404, notFound)
          return json(res, 200, { ok: true, project: result.project })
        }
        if (action === 'team' && method === 'DELETE') {
          const result = await removeTeamMember(id, subId)
          if (!result.applied) return json(res, 404, notFound)
          return json(res, 200, { ok: true, project: result.project })
        }
      }
      if (id && action === 'audit' && method === 'GET') {
        const detail = await getProjectById(id)
        if (!detail) return json(res, 404, { error: 'Project not found' })
        return json(res, 200, { history: detail.project.history })
      }
      if (id && action === 'activities' && method === 'GET') {
        const detail = await getProjectById(id)
        if (!detail) return json(res, 404, { error: 'Project not found' })
        return json(res, 200, { activities: detail.activities })
      }
    }

    return json(res, 404, { error: 'Not found' })
  } catch (err) {
    console.error('[api/projects]', method, path, err)
    const status = err?.status || 500
    return json(res, status, { error: err?.message || 'Project request failed' })
  }
}
