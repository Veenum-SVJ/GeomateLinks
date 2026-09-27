// Document Management System API endpoint (ES Module) — private admin-area
// router behind the shared admin session (see _lib/auth.js). Every operation
// enforces access server-side; nothing relies on hidden UI buttons.
// Raw Blob URLs never appear in API responses — file access goes through
// GET /api/documents/:id/file which 302s to a short-lived Blob URL only
// after the session check.
//
//   GET    /api/documents/dashboard
//   GET    /api/documents                ?query&projectId&folderId&categoryId&type&status&tag&uploadedBy&visibility&from&to&starred&archived&sort&page&pageSize
//   POST   /api/documents                register an uploaded file (validated)
//   GET    /api/documents/folders        ?projectId
//   POST   /api/documents/folders        ?ensureProject=1 seeds defaults / create folder
//   PATCH  /api/documents/folders/:id    rename / move / archive folder
//   DELETE /api/documents/folders/:id    delete folder (?force=1 for non-empty)
//   GET    /api/documents/categories
//   POST   /api/documents/categories
//   PATCH  /api/documents/categories/:id
//   DELETE /api/documents/categories/:id
//   GET    /api/documents/projects-lookup    lightweight project list for pickers
//   GET    /api/documents/project-summary    ?projectId= (ProjectDetail DMS tab payload)
//   GET    /api/documents/:id            document + versions + activity + previewable
//   PATCH  /api/documents/:id            metadata patch (rename/move/status/tags/…)
//   DELETE /api/documents/:id            permanent delete (confirm-gated in UI)
//   POST   /api/documents/:id/versions   register a new version upload
//   POST   /api/documents/:id/restore-version  { versionId }
//   POST   /api/documents/:id/archive    { archived: true|false }
//   GET    /api/documents/:id/activity
//   GET    /api/documents/:id/file?v=&download=1   auth-checked 302 to Blob
//   POST   /api/documents/bulk           { ids, action, payload }
import {
  getDashboard, readDocuments, getDocumentById, readDocumentDetail, readVersions,
  registerDocument, addVersion, restoreVersion, updateDocument, deleteDocument, touchAccessed,
  logDocumentActivity, readDocumentActivity,
  readFolders, ensureProjectFolders, createFolder, updateFolder, deleteFolder,
  readCategories, createCategory, updateCategory, deleteCategory,
  getProjectSummary, PREVIEWABLE_EXTENSIONS,
} from './_lib/documentStore.js'
import { readProjects } from './_lib/projectStore.js'
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
  const path = url.pathname.replace(/^\/api\/documents/, '').replace(/\/+$/, '') || '/'
  const q = Object.fromEntries(url.searchParams.entries())

  // DMS data is private — same session gate as every other admin module.
  if (!authDisabled() && !isAuthenticated(req)) {
    return json(res, 401, { error: 'Unauthorized' })
  }

  const seg = path.split('/').filter(Boolean)
  const id = seg[0] || ''
  const action = seg[1] || ''

  try {
    // ------------------------------------------------------------ dashboard
    if (id === 'dashboard' && method === 'GET') {
      return json(res, 200, await getDashboard())
    }

    // -------------------------------------------------- projects lookup
    // Concatenates active + archived pools (readProjects filters one or the
    // other) so pickers can attach documents to any project.
    if (id === 'projects-lookup' && method === 'GET') {
      const [active, archived] = await Promise.all([
        readProjects({ pageSize: 100 }),
        readProjects({ archived: 'true', pageSize: 100 }),
      ])
      const projects = [...active.projects, ...archived.projects].map((p) => ({
        id: p.id,
        number: p.number,
        title: p.title,
        client: p.client?.name || '',
        archived: p.archived,
      }))
      return json(res, 200, { projects })
    }

    // -------------------------------------------------- project summary hook
    if (id === 'project-summary' && method === 'GET') {
      if (!q.projectId) return json(res, 400, { error: 'Missing projectId' })
      return json(res, 200, await getProjectSummary(q.projectId))
    }

    // --------------------------------------------------------------- folders
    if (id === 'folders' && method === 'GET') {
      // Reading a project's folders lazily seeds the ten system defaults
      // (idempotent), so pickers and the upload dialog always have them.
      const folders = q.projectId ? await ensureProjectFolders(q.projectId) : await readFolders()
      return json(res, 200, { folders })
    }
    if (id === 'folders' && method === 'POST') {
      const body = parseBody(req)
      if (q.ensureProject === '1') {
        const folders = await ensureProjectFolders(body.projectId || q.projectId)
        return json(res, 200, { folders })
      }
      const folder = await createFolder(body)
      return json(res, 201, { ok: true, folder })
    }
    if (id === 'folders' && action && method === 'PATCH') {
      const result = await updateFolder(action, parseBody(req))
      if (!result.applied) return json(res, 404, { error: 'Folder not found' })
      return json(res, 200, { ok: true, folder: result.folder })
    }
    if (id === 'folders' && action && method === 'DELETE') {
      const result = await deleteFolder(action, { force: q.force === '1' })
      if (!result.deleted) return json(res, 404, { error: 'Folder not found' })
      return json(res, 200, { ok: true, ...result })
    }

    // ------------------------------------------------------------ categories
    if (id === 'categories' && method === 'GET') {
      return json(res, 200, { categories: await readCategories() })
    }
    if (id === 'categories' && method === 'POST') {
      const category = await createCategory(parseBody(req))
      return json(res, 201, { ok: true, category })
    }
    if (id === 'categories' && action && method === 'PATCH') {
      const result = await updateCategory(action, parseBody(req))
      if (!result.applied) return json(res, 404, { error: 'Category not found' })
      return json(res, 200, { ok: true, category: result.category })
    }
    if (id === 'categories' && action && method === 'DELETE') {
      const result = await deleteCategory(action)
      if (!result.deleted) return json(res, 404, { error: 'Category not found' })
      return json(res, 200, { ok: true, ...result })
    }

    // ------------------------------------------------------------- bulk ops
    if (id === 'bulk' && method === 'POST') {
      const body = parseBody(req)
      const ids = Array.isArray(body.ids) ? body.ids.slice(0, 100) : []
      if (ids.length === 0) return json(res, 400, { error: 'No documents selected' })
      const actor = String(body.actor || 'Admin').slice(0, 120)
      const results = []
      for (const docId of ids) {
        try {
          if (body.action === 'archive' || body.action === 'restore') {
            results.push({ id: docId, ok: true, ...(await updateDocument(docId, { archived: body.action === 'archive' }, { actor })) })
          } else if (body.action === 'star' || body.action === 'unstar') {
            results.push({ id: docId, ok: true, ...(await updateDocument(docId, { starred: body.action === 'star' }, { actor })) })
          } else if (body.action === 'move') {
            results.push({ id: docId, ok: true, ...(await updateDocument(docId, { folderId: body.folderId }, { actor })) })
          } else if (body.action === 'category') {
            results.push({ id: docId, ok: true, ...(await updateDocument(docId, { categoryId: body.categoryId }, { actor })) })
          } else if (body.action === 'status') {
            results.push({ id: docId, ok: true, ...(await updateDocument(docId, { status: body.status }, { actor })) })
          } else if (body.action === 'tags') {
            const doc = await getDocumentById(docId)
            if (!doc) {
              results.push({ id: docId, ok: false, error: 'not found' })
            } else {
              const base = body.mode === 'replace' ? [] : doc.tags || []
              const merged = [...new Set([...base, ...(Array.isArray(body.tags) ? body.tags : [])])].slice(0, 15)
              results.push({ id: docId, ok: true, ...(await updateDocument(docId, { tags: merged }, { actor })) })
            }
          } else {
            return json(res, 400, { error: 'Unknown bulk action' })
          }
        } catch (err) {
          results.push({ id: docId, ok: false, error: err?.message })
        }
      }
      const okCount = results.filter((r) => r.ok).length
      return json(res, 200, { ok: okCount === ids.length, applied: okCount, total: ids.length, results })
    }

    // ------------------------------------------------------------ file route
    // Auth-checked redirect to a short-lived Blob URL. `download=1` requests
    // a download (the UI anchor also carries the download attribute so the
    // browser keeps the original filename); ?v= serves a specific version.
    if (id && action === 'file' && method === 'GET') {
      const document = await getDocumentById(id)
      if (!document) return json(res, 404, { error: 'Document not found' })
      let pathname = document.pathname
      let filename = document.originalFilename
      if (q.v) {
        const versions = await readVersions(id)
        const version = versions.find((v) => String(v.version) === String(q.v))
        if (!version) return json(res, 404, { error: 'Version not found' })
        pathname = version.pathname
        filename = version.originalFilename || filename
      }
      const { head } = await import('@vercel/blob')
      const meta = await head(pathname)
      // Audit: downloads log explicitly; plain previews only refresh
      // last-accessed. Both are best-effort — never block the redirect.
      if (q.download === '1') {
        await logDocumentActivity({
          documentId: id,
          projectId: document.projectRef?.id || '',
          projectNumber: document.projectRef?.number || '',
          filename,
          action: 'downloaded',
          detail: q.v ? `Version ${q.v} downloaded` : 'File downloaded',
          actor: q.actor || 'Admin',
        }).catch(() => {})
      } else {
        touchAccessed(id).catch(() => {})
      }
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Location', meta.url)
      return res.status(302).end()
    }

    // ------------------------------------------------------------ list
    if (!id && method === 'GET') {
      const all = await readDocuments()
      const query = String(q.query || '').trim().toLowerCase()
      const toIso = q.to && String(q.to).length === 10 ? `${q.to}T23:59:59.999Z` : q.to
      const filtered = all.filter((d) => {
        if (q.archived === 'true' ? !d.archived : d.archived) return false
        if (q.projectId && d.projectRef?.id !== q.projectId) return false
        if (q.folderId && d.folderId !== q.folderId) return false
        if (q.categoryId && d.categoryId !== q.categoryId) return false
        if (q.type && d.ext !== String(q.type).toLowerCase()) return false
        if (q.status && d.status !== q.status) return false
        if (q.visibility && d.visibility !== q.visibility) return false
        if (q.uploadedBy && d.uploadedBy !== q.uploadedBy) return false
        if (q.tag && !(d.tags || []).includes(q.tag)) return false
        if (q.starred === 'true' && !d.starred) return false
        if (q.from && d.createdAt < q.from) return false
        if (toIso && d.createdAt > toIso) return false
        if (query) {
          const haystack = [d.originalFilename, d.documentNumber, d.projectRef?.number, d.projectRef?.title, d.folderName, d.categoryName, d.description, d.uploadedBy, ...(d.tags || [])]
            .join(' ')
            .toLowerCase()
          if (!haystack.includes(query)) return false
        }
        return true
      })
      const sort = q.sort || 'newest'
      const sorted = [...filtered].sort((a, b) => {
        switch (sort) {
          case 'oldest': return String(a.createdAt).localeCompare(String(b.createdAt))
          case 'name': return String(a.originalFilename).localeCompare(String(b.originalFilename))
          case 'size': return (b.sizeBytes || 0) - (a.sizeBytes || 0)
          case 'modified': return String(b.updatedAt).localeCompare(String(a.updatedAt))
          default: return String(b.createdAt).localeCompare(String(a.createdAt))
        }
      })
      const page = Math.max(1, Number(q.page) || 1)
      const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 25))
      return json(res, 200, {
        documents: sorted.slice((page - 1) * pageSize, page * pageSize),
        total: sorted.length,
        page,
        pageSize,
      })
    }

    // ------------------------------------------------------------- register
    if (!id && method === 'POST') {
      const body = parseBody(req)
      const document = await registerDocument(body, { actor: body.uploadedBy })
      return json(res, 201, { ok: true, document })
    }

    // ------------------------------------------------------- single document
    if (id && !action && method === 'GET') {
      const detail = await readDocumentDetail(id)
      if (!detail) return json(res, 404, { error: 'Document not found' })
      return json(res, 200, { ...detail, previewable: PREVIEWABLE_EXTENSIONS.includes(detail.document.ext) })
    }
    if (id && !action && method === 'PATCH') {
      const body = parseBody(req)
      const result = await updateDocument(id, body, { actor: body.actor })
      if (!result.applied) return json(res, 404, { error: 'Document not found' })
      return json(res, 200, { ok: true, document: result.document })
    }
    if (id && !action && method === 'DELETE') {
      const body = parseBody(req)
      const result = await deleteDocument(id, { actor: body.actor })
      if (!result.deleted) return json(res, 404, { error: 'Document not found' })
      return json(res, 200, { ok: true, ...result })
    }

    // ------------------------------------------------------------- versions
    if (id && action === 'versions' && method === 'POST') {
      const body = parseBody(req)
      const result = await addVersion(id, body, { actor: body.uploadedBy })
      if (!result.applied) return json(res, 404, { error: 'Document not found' })
      return json(res, 201, { ok: true, document: result.document, version: result.version })
    }
    if (id && action === 'restore-version' && method === 'POST') {
      const body = parseBody(req)
      const result = await restoreVersion(id, body.versionId, { actor: body.actor })
      if (!result.applied) return json(res, 404, { error: 'Document or version not found' })
      return json(res, 200, { ok: true, document: result.document, version: result.version })
    }

    // -------------------------------------------------------------- archive
    if (id && action === 'archive' && method === 'POST') {
      const body = parseBody(req)
      const result = await updateDocument(id, { archived: Boolean(body.archived) }, { actor: body.actor })
      if (!result.applied) return json(res, 404, { error: 'Document not found' })
      return json(res, 200, { ok: true, document: result.document })
    }

    // ---------------------------------------------------------- doc activity
    if (id && action === 'activity' && method === 'GET') {
      return json(res, 200, { activity: await readDocumentActivity({ documentId: id, limit: 100 }) })
    }

    return json(res, 404, { error: 'Not found' })
  } catch (err) {
    console.error('[api/documents]', method, path, err)
    const status = err?.status || 500
    return json(res, status, { error: err?.message || 'Document request failed', code: err?.code })
  }
}
