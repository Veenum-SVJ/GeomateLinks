// Document Management System smoke tests. Run: node scripts/documentSmoke.mjs
//
// Covers the pure-logic gates (filename sanitisation, upload validation) and
// live Postgres CRUD for categories/folders, plus the security check that
// registering a document whose Blob object does not exist is rejected.
// Leaves no residue: everything it creates is deleted again.
import { loadEnv } from './lib/env.mjs'

loadEnv()

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

const store = await import('../api/_lib/documentStore.js')

// ---------------------------------------------------- filename sanitisation
section('filename sanitisation')
{
  check('keeps a clean name', store.sanitiseFilename('Topographic_Survey_Plan v3.pdf') === 'Topographic_Survey_Plan v3.pdf')
  check('strips path traversal (unix)', store.sanitiseFilename('../../etc/passwd') === 'passwd')
  check('strips path traversal (windows)', store.sanitiseFilename('C:\\Users\\evil\\plan.dwg') === 'plan.dwg')
  check('strips nested traversal', store.sanitiseFilename('a/../../secret.dwg') === 'secret.dwg')
  check('removes control/unsafe characters', store.sanitiseFilename('rep<script>o\u0000rt.pdf') === 'rep_script_ort.pdf')
  check('guards reserved device names', store.sanitiseFilename('con.pdf') === '_con.pdf')
  check('caps length at 120', store.sanitiseFilename(`${'x'.repeat(300)}.pdf`).length === 120)
  check('falls back to "file" for empty', store.sanitiseFilename('') === 'file')
}

// --------------------------------------------------------- upload validation
section('upload validation gates')
{
  let exeRejected = false
  try { store.validateUpload({ originalFilename: 'payload.exe', sizeBytes: 100 }) } catch { exeRejected = true }
  check('executables rejected', exeRejected)

  let typelessRejected = false
  try { store.validateUpload({ originalFilename: 'noext', sizeBytes: 100 }) } catch { typelessRejected = true }
  check('extension-less files rejected', typelessRejected)

  let oversizeRejected = false
  try { store.validateUpload({ originalFilename: 'big.zip', sizeBytes: 201 * 1024 * 1024 }) } catch { oversizeRejected = true }
  check('over-200MB rejected', oversizeRejected)

  let zeroRejected = false
  try { store.validateUpload({ originalFilename: 'a.pdf', sizeBytes: 0 }) } catch { zeroRejected = true }
  check('zero-byte rejected', zeroRejected)

  const ok = store.validateUpload({ originalFilename: 'GNSS_Field_Data.csv', sizeBytes: 1024 })
  check('csv accepted', ok.ext === 'csv' && ok.size === 1024)
  const dwg = store.validateUpload({ originalFilename: 'Plot_Layout.dwg', sizeBytes: 5 * 1024 * 1024 })
  check('dwg accepted', dwg.ext === 'dwg')
}

// ------------------------------------------------------- categories (live DB)
section('categories — live Postgres round-trip')
{
  const created = await store.createCategory({ name: `Smoke Cat ${Date.now().toString(36)}` })
  check('custom category created', created.id.startsWith('cat-') && !created.system)

  const list1 = await store.readCategories()
  check('category listed', list1.some((c) => c.id === created.id))

  let duplicateRejected = false
  try { await store.createCategory({ name: created.name }) } catch (err) { duplicateRejected = err?.status === 409 }
  check('duplicate name rejected (409)', duplicateRejected)

  const renamed = await store.updateCategory(created.id, { name: `${created.name} R` })
  check('custom rename applied', renamed.applied && renamed.category.name.endsWith('R'))

  const removed = await store.deleteCategory(created.id)
  check('custom category deleted', removed.deleted)
}

// ---------------------------------------------------------- folders (live DB)
section('folders — live Postgres round-trip')
{
  const projectId = 'smoke-project-x1'
  const defaults = await store.ensureProjectFolders(projectId)
  check('ten system defaults seeded', defaults.length === 10 && defaults.every((f) => f.system))

  const again = await store.ensureProjectFolders(projectId)
  check('seeding idempotent', again.length === 10)

  const custom = await store.createFolder({ projectId, name: 'Smoke Custom Folder' })
  check('custom folder created', Boolean(custom.id) && !custom.system)

  let duplicateRejected = false
  try { await store.createFolder({ projectId, name: 'smoke custom folder' }) } catch (err) { duplicateRejected = err?.status === 409 }
  check('duplicate folder name rejected', duplicateRejected)

  const moved = await store.updateFolder(custom.id, { name: 'Smoke Custom Folder 2' })
  check('folder renamed', moved.applied && moved.folder.name === 'Smoke Custom Folder 2')

  const cleaned = await store.deleteFolder(custom.id, { force: true })
  check('custom folder deleted', cleaned.deleted)
  // System defaults remain — they are per-project infrastructure.
  const remaining = await store.readFolders({ projectId })
  check('system defaults survive', remaining.length === 10)
}

// ----------------------------------------------- register gate (missing blob)
section('register rejects uploads whose Blob object is missing')
{
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.log('  skipped — no BLOB_READ_WRITE_TOKEN in this environment')
  } else {
    let rejected = false
    try {
      await store.registerDocument({
        originalFilename: 'ghost-plan.pdf',
        pathname: `documents/ghost-${Date.now()}.pdf`,
        sizeBytes: 12345,
        projectRef: { id: 'smoke-project-x1', number: 'GML-PRJ-2026-0000', title: 'Smoke' },
        uploadedBy: 'SmokeTest',
      })
    } catch (err) {
      rejected = err?.status === 400
    }
    check('nonexistent Blob pathname rejected (400)', rejected)
  }
}

// --------------------------------------------------- summary read (live DB)
section('project summary + dashboard read cleanly')
{
  const summary = await store.getProjectSummary('smoke-project-x1')
  check('project summary shape intact', Array.isArray(summary.folders) && summary.summary.totalFiles === 0)
  const dash = await store.getDashboard()
  check('dashboard shape intact', typeof dash.totals.files === 'number' && Array.isArray(dash.categories))
}

console.log(failures === 0 ? '\nAll DMS smoke tests passed.' : `\n${failures} test(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
