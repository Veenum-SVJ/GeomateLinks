// Supabase data-layer smoke tests. Run: node scripts/supabaseSmoke.mjs
//
// Steps 1–2 always run (module graph + graceful no-DB fallback).
// Step 3 (real Postgres round-trip) runs only when SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are set in the environment — it creates a lead
// and a message, mutates them, and deletes both again, leaving no residue.
// Step 4 (same env gate) walks the quotation and project stores end-to-end:
// lead → quotation (create → edit → send → revise → accept) → project (status
// flow → progress → tasks → milestones → dashboards) → full cleanup. Every
// section cleans up after itself; the whole run leaves no residue.
import { loadEnv } from './lib/env.mjs'

loadEnv()
const hasEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  && process.env.SUPABASE_SERVICE_ROLE_KEY !== 'PASTE_SERVICE_ROLE_KEY_HERE')

let failures = 0
function check(name, cond) {
  if (cond) {
    console.log(`  ok  ${name}`)
  } else {
    failures++
    console.error(`FAIL  ${name}`)
  }
}
function section(title) {
  console.log(`\n— ${title}`)
}

const { default: contentFallback } = await import('../api/_data/content.json', { with: { type: 'json' } })

// ---------------------------------------------------------- 1. module graph
section('module graph (Postgres-backed stores)')
{
  const store = await import('../api/_lib/store.js')
  const crm = await import('../api/_lib/crmStore.js')
  const quotations = await import('../api/_lib/quotationStore.js')
  const projects = await import('../api/_lib/projectStore.js')

  check('store exports intact', ['readContent', 'writeContent', 'readActivity', 'logActivity', 'readMessages', 'appendMessage', 'updateMessage', 'deleteMessageById', 'normaliseMessage', 'isValidMessage', 'listMedia', 'deleteMediaByUrl'].every((fn) => typeof store[fn] === 'function'))
  check('crmStore exports intact', ['readAll', 'putEntry', 'removeEntry', 'newId', 'allocateCode', 'readLeads', 'getLeadById', 'createLead', 'updateLead', 'deleteLead', 'convertLead', 'readClients', 'getClientById', 'createClient', 'updateClient', 'deleteClient', 'createActivity', 'readActivities', 'createFollowup', 'readFollowups', 'updateFollowup', 'deleteFollowup', 'leadFromMessage', 'getDashboard'].every((fn) => typeof crm[fn] === 'function'))
  check('quotationStore exports intact', typeof quotations.createQuotation === 'function' && typeof quotations.getQuotationDashboard === 'function')
  check('projectStore exports intact', typeof projects.createProject === 'function' && typeof projects.getProjectDashboard === 'function')

  const db = await import('../api/_lib/db.js')
  check('db hasDb() reflects env', typeof db.hasDb() === 'boolean')
}

// ------------------------------------------------------ 2. no-DB fallback
section('graceful no-DB fallback (no Supabase env)')
{
  if (hasEnv) {
    check('skipped — Supabase env is configured (step 3 covers the live path)', true)
  } else {
    const store = await import('../api/_lib/store.js')
    check('readContent falls back to bundled content', (await store.readContent(contentFallback)) === contentFallback)
    check('readMessages returns []', JSON.stringify(await store.readMessages()) === '[]')
    check('readActivity returns []', JSON.stringify(await store.readActivity()) === '[]')
    check('listMedia returns []', JSON.stringify(await store.listMedia()) === '[]')
  }
}

// -------------------------------------------------- 3. real Postgres round-trip
section('live Postgres round-trip (lead + message)')
if (!hasEnv) {
  console.log('  skipped — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable')
} else {
  const store = await import('../api/_lib/store.js')
  const crm = await import('../api/_lib/crmStore.js')

  const content = await store.readContent(contentFallback)
  check('readContent serves seeded document', content?.company?.name === 'Geomate Links Consulting Limited')

  const message = store.normaliseMessage({ name: 'Smoke Test', email: 'smoke@test.dev', phone: '000', subject: 'Supabase smoke', message: 'round-trip test' })
  await store.appendMessage(message)
  const inbox = await store.readMessages()
  check('message appended + readable', inbox.some((m) => m.id === message.id))

  const patched = await store.updateMessage(message.id, { read: true })
  check('message marked read', patched.applied && patched.entry.read === true)

  const lead = await crm.createLead(
    { name: 'Smoke Lead', email: 'smoke@test.dev', phone: '000', source: 'Website', status: 'New', description: 'smoke test lead' },
    { actor: 'SmokeTest' },
  )
  check('lead created with sequential code', /^GML-\d{4}-\d{4}$/.test(lead.code))
  check('lead readable by id', (await crm.getLeadById(lead.id))?.id === lead.id)

  const followup = await crm.createFollowup({ relatedType: 'lead', relatedId: lead.id, relatedCode: lead.code, date: new Date().toISOString().slice(0, 10), title: 'Smoke follow-up' })
  check('follow-up created + pending', followup.status === 'Pending')

  const nextDay = await crm.readFollowups({ status: 'Pending' })
  check('follow-up listed', nextDay.some((f) => f.id === followup.id))

  const converted = await crm.convertLead(lead.id, {}, { actor: 'SmokeTest' })
  check('lead converts to client', converted.applied && converted.client?.code?.startsWith('CLI-'))
  check('client stored', (await crm.getClientById(converted.client.id))?.id === converted.client.id)

  const dash = await crm.getDashboard()
  check('dashboard aggregates', typeof dash.cards.totalLeads === 'number')

  // Cleanup (no residue).
  await crm.deleteClient(converted.client.id)
  await crm.deleteLead(lead.id)
  await store.deleteMessageById(message.id)
  const inboxAfter = await store.readMessages()
  check('cleanup removed smoke records', !inboxAfter.some((m) => m.id === message.id))
}

// ------------------------------------------------ 4. quotation + project E2E
// The production chain: lead → quotation → accepted quotation → project.
// Runs against live Postgres when Supabase env is configured. Every mutation
// the stores make is mirrored by an explicit cleanup below, and the chain is
// wrapped in try/finally so a mid-run failure still deletes everything.
section('live quotation → project lifecycle (create → revise → dashboard)')
if (!hasEnv) {
  console.log('  skipped — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable')
} else {
  const store = await import('../api/_lib/store.js')
  const crm = await import('../api/_lib/crmStore.js')
  const quotations = await import('../api/_lib/quotationStore.js')
  const projects = await import('../api/_lib/projectStore.js')

  // Everything created below, captured for the finally-block cleanup.
  const created = { message: null, lead: null, client: null, quotationIds: [], projectId: null }

  try {
    // ---- seed: lead (with the message the CRM flow normally comes from)
    const message = store.normaliseMessage({ name: 'QMS Smoke', email: 'qms-smoke@test.dev', phone: '000', subject: 'QMS smoke seed', message: 'quotation/project round-trip' })
    await store.appendMessage(message)
    created.message = message.id

    const lead = await crm.createLead(
      { name: 'QMS Smoke Lead', email: 'qms-smoke@test.dev', phone: '000', source: 'Website', status: 'New', description: 'quotation/project lifecycle smoke' },
      { actor: 'SmokeTest' },
    )
    created.lead = lead.id
    check('lead seeded', Boolean(lead.id) && /^GML-\d{4}-\d{4}$/.test(lead.code))

    // ---- quotation: create from the lead (auto-creates the client)
    const draft = await quotations.createQuotation(
      {
        leadId: lead.id,
        projectTitle: 'Smoke Drone Mapping — Phase 1',
        location: 'Ibadan (smoke)',
        projectDescription: 'Quotation/project lifecycle smoke test — safe to delete.',
        scopeOfWork: 'Flight planning, GNSS ground control, orthomosaic production.',
        currency: { code: 'NGN' },
        items: [
          { description: 'Drone mapping (per hectare)', service: { id: 'drone-mapping', title: 'Drone Mapping' }, quantity: '40', unit: 'ha', unitPriceMinor: 1500000 },
          { description: 'Ground control points', service: { id: 'survey', title: 'Topographical Survey' }, quantity: '4', unit: 'pt', unitPriceMinor: 2500000, discount: { mode: 'percent', bp: 1000 } },
        ],
        quoteDiscount: { mode: 'percent', bp: 500 },
        additionalChargesMinor: 1000000,
        taxBp: 750,
        validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      },
      { actor: 'SmokeTest' },
    )
    created.quotationIds.push(draft.id)
    created.client = draft.client.id
    check('quotation created with sequential number', /^GML-QT-\d{4}-\d{4}$/.test(draft.number))
    check('quotation starts as Draft v1', draft.status === 'Draft' && draft.version === 1 && draft.rootId === draft.id)
    check('client auto-created from lead', Boolean(draft.client.id) && draft.client.code.startsWith('CLI-'))
    check('line totals are integer minor units', Number.isInteger(draft.grandTotalMinor) && draft.grandTotalMinor > 0)
    check('quotation linked back to lead', draft.lead.id === lead.id)

    // ---- quotation: edit the draft (free-edit window)
    const edited = await quotations.updateQuotation(draft.id, { notes: 'Smoke edit — draft window' }, { actor: 'SmokeTest' })
    check('draft edit applied', edited.applied && edited.quotation.notes === 'Smoke edit — draft window')

    // ---- quotation: send → guard → revise
    const sent = await quotations.sendQuotation(draft.id, { to: 'qms-smoke@test.dev', message: 'Please review.' }, { actor: 'SmokeTest' })
    check('send flips draft to Sent', sent.applied && sent.quotation.status === 'Sent' && Boolean(sent.quotation.sentAt))

    let editAfterSendBlocked = false
    try { await quotations.updateQuotation(draft.id, { notes: 'should fail' }) } catch (err) { editAfterSendBlocked = err?.status === 409 }
    check('editing a sent quotation rejected (409)', editAfterSendBlocked)

    const revision = await quotations.reviseQuotation(draft.id, { actor: 'SmokeTest' })
    created.quotationIds.push(revision.quotation.id)
    check('revision is a new draft in the same chain', revision.applied && revision.quotation.version === 2 && revision.quotation.rootId === draft.rootId && revision.quotation.supersedesId === draft.id && revision.quotation.number === draft.number)
    check('original keeps Sent state (append-only)', (await quotations.getQuotationById(draft.id)).quotation.status === 'Sent')
    check('revision is the chain current', (await quotations.readQuotations()).quotations.some((q) => q.id === revision.quotation.id && q.isCurrent))

    // ---- quotation: accept the revision (creates the handoff state)
    const accepted = await quotations.changeStatus(revision.quotation.id, 'Accepted', { actor: 'SmokeTest' })
    check('revision accepted', accepted.applied && accepted.quotation.status === 'Accepted' && Boolean(accepted.quotation.acceptedAt))
    check('accepting a terminal-state quotation rejected (409)', await (async () => { try { await quotations.changeStatus(revision.quotation.id, 'Rejected'); return false } catch (err) { return err?.status === 409 } })())

    const qDash = await quotations.getQuotationDashboard()
    check('quotation dashboard aggregates', typeof qDash.cards.total === 'number' && typeof qDash.cards.acceptedValueMinor === 'number')
    const chainDetail = await quotations.getQuotationById(revision.quotation.id)
    check('version list shows the chain', chainDetail.versions.length === 2 && chainDetail.versions.some((v) => v.version === 2 && v.isCurrent))
    check('history trails the lifecycle', chainDetail.history.some((h) => h.action === 'revision_created') && chainDetail.history.some((h) => h.action === 'accepted'))

    // ---- project: create from the accepted quotation
    const project = await projects.createProject(
      { quotationId: revision.quotation.id, leadId: lead.id, clientId: created.client, priority: 'High', startDate: new Date().toISOString().slice(0, 10) },
      { actor: 'SmokeTest' },
    )
    created.projectId = project.id
    check('project created with sequential number', /^GML-PRJ-\d{4}-\d{4}$/.test(project.number))
    check('project inherits quotation snapshots', project.quotation.id === revision.quotation.id && project.client.id === created.client && project.quotedValueMinor === revision.quotation.grandTotalMinor)
    check('project objectives seeded from quotation scope', project.objectives.includes('Flight planning'))
    check('project starts Planning @10%', project.status === 'Planning' && project.progressPct === 10)

    // ---- project: status flow + manual progress + tasks
    const scheduled = await projects.changeProjectStatus(project.id, 'Scheduled', { actor: 'SmokeTest' })
    check('status moves Planning → Scheduled', scheduled.applied && scheduled.project.status === 'Scheduled' && scheduled.project.progressPct === 20)

    const progress = await projects.updateProjectProgress(project.id, 47, { actor: 'SmokeTest' })
    check('manual progress override sticks', progress.applied && progress.project.progressPct === 47 && progress.project.progressOverridden === true)

    const field = await projects.changeProjectStatus(project.id, 'Field Work', { actor: 'SmokeTest' })
    check('override survives a status change', field.applied && field.project.status === 'Field Work' && field.project.progressPct === 47)

    const { task } = await projects.addTask(project.id, { name: 'Smoke GNSS flight', status: 'In Progress', phase: 'Field Work', priority: 'High' }, { actor: 'SmokeTest' })
    check('task created', Boolean(task.id))
    const done = await projects.updateTask(project.id, task.id, { status: 'Completed' }, { actor: 'SmokeTest' })
    check('task completed', done.task.status === 'Completed' && done.project.computed.tasksCompleted === 1)
    await projects.removeTask(project.id, task.id, { actor: 'SmokeTest' })

    const { milestone } = await projects.addMilestone(project.id, { name: 'Smoke milestone', dueDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10) }, { actor: 'SmokeTest' })
    check('overdue milestone flagged', (await projects.getProjectById(project.id)).project.computed.milestonesOverdue === 1)
    await projects.updateMilestone(project.id, milestone.id, { status: 'Completed' }, { actor: 'SmokeTest' })

    // ---- read paths: detail + timeline + dashboard
    const detail = await projects.getProjectById(project.id)
    check('detail + timeline intact', detail.project.id === project.id && detail.activities.some((a) => a.type === 'status_changed') && detail.activities.some((a) => a.type === 'task_completed'))
    check('embedded history trails mutations', detail.project.history.some((h) => h.action === 'status_changed') && detail.project.history.some((h) => h.action === 'progress_updated'))

    const pDash = await projects.getProjectDashboard()
    check('project dashboard aggregates', typeof pDash.cards.total === 'number' && typeof pDash.cards.active === 'number' && Array.isArray(pDash.recentActivity))

    // ---- cleanup (no residue) — runs even when a check above threw
  } finally {
    if (created.projectId) await projects.deleteProject(created.projectId).catch(() => {})
    for (const id of created.quotationIds) await quotations.deleteQuotation(id).catch(() => {})
    if (created.client) await crm.deleteClient(created.client).catch(() => {})
    if (created.lead) await crm.deleteLead(created.lead).catch(() => {})
    if (created.message) await store.deleteMessageById(created.message).catch(() => {})
  }

  // Residue verification: every table the chain touched must be clean.
  const [leadsLeft, clientsLeft, quotesLeft, projectsLeft, qHistoryLeft, pActivitiesLeft] = await Promise.all([
    crm.readLeads({ query: 'QMS Smoke Lead' }),
    crm.readClients({ query: 'qms-smoke@test.dev' }),
    quotations.readQuotations({ query: 'Smoke Drone Mapping', allVersions: 'true' }),
    projects.readProjects({ query: 'Smoke Drone Mapping' }),
    crm.readAll('crm/quotations-history/'),
    crm.readAll('crm/project-activities/'),
  ])
  check('cleanup left no lead', leadsLeft.total === 0)
  check('cleanup left no client', clientsLeft.total === 0)
  check('cleanup left no quotations (all versions)', quotesLeft.total === 0)
  check('cleanup left no project', projectsLeft.total === 0)
  check('cleanup left no quotation history', !qHistoryLeft.some((h) => created.quotationIds.includes(h.quotationId)))
  check('cleanup left no project activities', !pActivitiesLeft.some((a) => a.projectId === created.projectId))
}

console.log(failures === 0 ? '\nAll smoke tests passed.' : `\n${failures} test(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
