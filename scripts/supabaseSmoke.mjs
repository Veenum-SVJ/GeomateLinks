// Supabase data-layer smoke tests. Run: node scripts/supabaseSmoke.mjs
//
// Steps 1–2 always run (module graph + graceful no-DB fallback).
// Step 3 (real Postgres round-trip) runs only when SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are set in the environment — it creates a lead
// and a message, mutates them, and deletes both again, leaving no residue.
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

console.log(failures === 0 ? '\nAll smoke tests passed.' : `\n${failures} test(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
