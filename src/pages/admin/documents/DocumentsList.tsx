// Documents list — search, filters (project/folder/category/type/status/
// uploader/date), sorting, pagination and bulk actions (archive/restore/
// star/move/category/status/tags). Variants via props: all / recent /
// starred / archived / project-specific.
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  UploadCloud, FolderPlus, Search, ChevronLeft, ChevronRight, Archive, ArchiveRestore,
  Star, FolderInput, ArrowUpDown, X,
} from "lucide-react"
import {
  fetchDocuments, fetchDocumentsProjectsLookup, fetchDocumentFolders, fetchDocumentCategories,
  bulkDocuments, archiveDocument,
} from "@/lib/documentsApi"
import { DOCUMENT_STATUSES } from "@/types/documents"
import type { DocumentRecord, DocumentFolder, DocumentCategory } from "@/types/documents"
import DocumentUploadDialog from "@/components/admin/documents/DocumentUploadDialog"
import { CrmConfirmDialog, CrmEmptyState, CrmErrorState, CrmSpinner, crmDayOnly } from "@/components/admin/crm/CrmUI"
import { DocumentStatusBadge, FileTypeChip, StarMark, VisibilityBadge, formatBytes } from "@/components/admin/documents/DocumentUI"
import { cn } from "@/lib/utils"

export default function DocumentsList({ variant }: { variant: "all" | "recent" | "starred" | "archived" }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { id: routeProjectId } = useParams<{ id: string }>()

  const [data, setData] = useState<DocumentRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [actionError, setActionError] = useState("")
  const [projects, setProjects] = useState<{ id: string; number: string; title: string; client: string; archived: boolean }[]>([])
  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [uploadOpen, setUploadOpen] = useState(false)
  const [bulkDialog, setBulkDialog] = useState<null | { action: "archive" | "restore"; title: string; description: string }>(null)
  const [bulkPanel, setBulkPanel] = useState(false)

  // Filter state (URL-backed so views are shareable).
  const [query, setQuery] = useState(searchParams.get("query") || "")
  const [appliedQuery, setAppliedQuery] = useState(searchParams.get("query") || "")
  const projectId = searchParams.get("projectId") || ""
  const folderId = searchParams.get("folderId") || ""
  const categoryId = searchParams.get("categoryId") || ""
  const type = searchParams.get("type") || ""
  const status = searchParams.get("status") || ""
  const uploadedBy = searchParams.get("uploadedBy") || ""
  const from = searchParams.get("from") || ""
  const sort = searchParams.get("sort") || "newest"
  const pageSize = 25

  const effectiveProjectId = routeProjectId || projectId

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const result = await fetchDocuments({
        query: appliedQuery || undefined,
        projectId: effectiveProjectId || undefined,
        folderId: folderId || undefined,
        categoryId: categoryId || undefined,
        type: type || undefined,
        status: variant === "all" ? status || undefined : undefined,
        uploadedBy: uploadedBy || undefined,
        from: from || undefined,
        sort,
        page,
        pageSize,
        starred: variant === "starred" ? "true" : undefined,
        archived: variant === "archived" ? "true" : "false",
      })
      setData(result.documents)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load documents")
    } finally {
      setLoading(false)
    }
  }, [appliedQuery, effectiveProjectId, folderId, categoryId, type, status, uploadedBy, from, sort, page, variant])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetchDocumentsProjectsLookup().then((r) => setProjects(r.projects)).catch(() => {})
    fetchDocumentCategories().then((r) => setCategories(r.categories)).catch(() => {})
  }, [])

  useEffect(() => {
    if (effectiveProjectId) {
      fetchDocumentFolders(effectiveProjectId).then((r) => setFolders(r.folders)).catch(() => {})
    } else {
      setFolders([])
    }
  }, [effectiveProjectId])

  const setParam = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(patch).forEach(([k, v]) => {
      if (v) next.set(k, v)
      else next.delete(k)
    })
    setSearchParams(next)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const allSelected = data.length > 0 && data.every((d) => selected.has(d.id))
  const selectedIds = useMemo(() => [...selected], [selected])

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(data.map((d) => d.id)))
  }
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runBulk = async (action: "archive" | "restore") => {
    setBulkDialog(null)
    setActionError("")
    try {
      await bulkDocuments(selectedIds, action)
      setSelected(new Set())
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Bulk action failed")
    }
  }

  const bulkStar = async () => {
    setActionError("")
    try {
      await bulkDocuments(selectedIds, "star")
      setSelected(new Set())
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Bulk action failed")
    }
  }

  const bulkMove = async (targetFolderId: string) => {
    setBulkPanel(false)
    setActionError("")
    try {
      const folder = folders.find((f) => f.id === targetFolderId)
      await bulkDocuments(selectedIds, "move", { folderId: targetFolderId, folderName: folder?.name || "" })
      setSelected(new Set())
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Bulk move failed")
    }
  }

  const bulkCategory = async (targetCategoryId: string) => {
    setBulkPanel(false)
    setActionError("")
    try {
      const category = categories.find((c) => c.id === targetCategoryId)
      await bulkDocuments(selectedIds, "category", { categoryId: targetCategoryId, categoryName: category?.name || "" })
      setSelected(new Set())
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Bulk category change failed")
    }
  }

  const bulkStatus = async (targetStatus: string) => {
    setBulkPanel(false)
    setActionError("")
    try {
      await bulkDocuments(selectedIds, "status", { status: targetStatus })
      setSelected(new Set())
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Bulk status change failed")
    }
  }

  const bulkTags = async (raw: string) => {
    setBulkPanel(false)
    setActionError("")
    const tags = raw.split(",").map((t) => t.trim()).filter(Boolean)
    if (tags.length === 0) return
    try {
      await bulkDocuments(selectedIds, "tags", { tags })
      setSelected(new Set())
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Bulk tag update failed")
    }
  }

  const quickArchiveOne = async (doc: DocumentRecord) => {
    setActionError("")
    try {
      await archiveDocument(doc.id, !doc.archived)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Archive failed")
    }
  }

  const title = variant === "archived" ? "Archived documents" : variant === "starred" ? "Starred" : variant === "recent" ? "Recent documents" : "All files"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{total} document{total === 1 ? "" : "s"}{effectiveProjectId ? ` in ${projects.find((p) => p.id === effectiveProjectId)?.number || "this project"}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={async () => {
              if (!effectiveProjectId) { setActionError("Open a project first — folders belong to projects. Use All Files → filter by project."); return }
              navigate(`/admin/documents/project/${effectiveProjectId}`)
            }}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <FolderPlus className="h-3.5 w-3.5" /> Manage folders
          </button>
          <button
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90"
          >
            <UploadCloud className="h-3.5 w-3.5" /> Upload files
          </button>
        </div>
      </div>

      {error && <CrmErrorState message={error} onRetry={load} />}
      {actionError && <CrmErrorState message={actionError} onRetry={() => setActionError("")} />}

      {/* Filter bar */}
      <div className="space-y-2.5 rounded-lg border bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setAppliedQuery(query); setPage(1) } }}
              placeholder="Search filename, ID, project, tags, description, uploader…"
              className="w-full rounded-md border py-2 pl-8 pr-3 text-sm"
            />
          </div>
          <button onClick={() => { setAppliedQuery(query); setPage(1) }} className="rounded-md bg-brand-brown px-3 py-2 text-xs font-semibold text-white hover:bg-brand-brown/90">Search</button>
          <select value={effectiveProjectId} onChange={(e) => setParam({ projectId: e.target.value })} disabled={Boolean(routeProjectId)} className="rounded-md border bg-white px-2 py-2 text-xs">
            <option value="">All projects</option>
            {projects.map((p) => (<option key={p.id} value={p.id}>{p.number} — {p.title}</option>))}
          </select>
          <select value={sort} onChange={(e) => setParam({ sort: e.target.value })} className="rounded-md border bg-white px-2 py-2 text-xs">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Filename</option>
            <option value="size">File size</option>
            <option value="modified">Last modified</option>
          </select>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><ArrowUpDown className="h-3 w-3" /></span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select value={folderId} onChange={(e) => setParam({ folderId: e.target.value })} disabled={!effectiveProjectId} className="rounded-md border bg-white px-2 py-1.5">
            <option value="">All folders</option>
            {folders.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
          </select>
          <select value={categoryId} onChange={(e) => setParam({ categoryId: e.target.value })} className="rounded-md border bg-white px-2 py-1.5">
            <option value="">All categories</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <select value={type} onChange={(e) => setParam({ type: e.target.value })} className="rounded-md border bg-white px-2 py-1.5">
            <option value="">All types</option>
            {["pdf", "doc", "docx", "xls", "xlsx", "csv", "jpg", "jpeg", "png", "webp", "svg", "dwg", "dxf", "kml", "kmz", "zip", "rar"].map((t) => (
              <option key={t} value={t}>{t.toUpperCase()}</option>
            ))}
          </select>
          {variant === "all" && (
            <select value={status} onChange={(e) => setParam({ status: e.target.value })} className="rounded-md border bg-white px-2 py-1.5">
              <option value="">All statuses</option>
              {DOCUMENT_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          )}
          <input type="date" value={from} onChange={(e) => setParam({ from: e.target.value })} className="rounded-md border px-2 py-1.5" title="Uploaded from" />
          {(appliedQuery || projectId || folderId || categoryId || type || status || uploadedBy || from) && (
            <button
              onClick={() => { setSearchParams(new URLSearchParams()); setQuery(""); setAppliedQuery(""); setPage(1) }}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-brown/30 bg-brand-brown/5 px-3 py-2 text-sm">
          <span className="text-xs font-semibold">{selected.size} selected</span>
          <button onClick={() => setBulkDialog({ action: "archive", title: "Archive selected documents?", description: "Archived files stay in the system under Archived and can be restored at any time." })} className="rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted"><Archive className="mr-1 inline h-3 w-3" /> Archive</button>
          {variant === "archived" && (
            <button onClick={() => setBulkDialog({ action: "restore", title: "Restore selected documents?", description: "They return to the active lists." })} className="rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted"><ArchiveRestore className="mr-1 inline h-3 w-3" /> Restore</button>
          )}
          <button onClick={bulkStar} className="rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted"><Star className="mr-1 inline h-3 w-3" /> Star</button>
          <button onClick={() => setBulkPanel((v) => !v)} className="rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted"><FolderInput className="mr-1 inline h-3 w-3" /> Move / Category / Status / Tags</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear selection</button>
        </div>
      )}
      {bulkPanel && selected.size > 0 && (
        <div className="grid gap-2 rounded-lg border bg-white p-3 text-xs sm:grid-cols-4">
          <label className="space-y-1">
            <span className="text-muted-foreground">Move to folder</span>
            <select onChange={(e) => e.target.value && bulkMove(e.target.value)} defaultValue="" disabled={!effectiveProjectId} className="w-full rounded-md border bg-white px-2 py-1.5">
              <option value="">Choose…</option>
              {folders.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Set category</span>
            <select onChange={(e) => e.target.value && bulkCategory(e.target.value)} defaultValue="" className="w-full rounded-md border bg-white px-2 py-1.5">
              <option value="">Choose…</option>
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Set status</span>
            <select onChange={(e) => e.target.value && bulkStatus(e.target.value)} defaultValue="" className="w-full rounded-md border bg-white px-2 py-1.5">
              <option value="">Choose…</option>
              {DOCUMENT_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </label>
          <form
            className="space-y-1"
            onSubmit={(e) => {
              e.preventDefault()
              const input = (e.currentTarget.elements.namedItem("tags") as HTMLInputElement | null)
              if (input?.value) bulkTags(input.value)
            }}
          >
            <span className="text-muted-foreground">Add tags (comma sep.)</span>
            <div className="flex gap-1">
              <input name="tags" className="w-full rounded-md border px-2 py-1.5" placeholder="GNSS, Final" />
              <button type="submit" className="rounded-md border px-2 font-medium hover:bg-muted">Add</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <CrmSpinner />
      ) : data.length === 0 ? (
        <CrmEmptyState
          icon={<UploadCloud className="h-8 w-8" />}
          title={variant === "archived" ? "Nothing archived" : variant === "starred" ? "No starred documents" : "No documents here yet"}
          description={variant === "archived" ? "Archived files remain in the system and appear here." : "Upload your first project file — PDFs, maps, CAD, GIS data, photos and more."}
          actionLabel={variant === "archived" || variant === "starred" ? undefined : "Upload files"}
          onAction={variant === "archived" || variant === "starred" ? undefined : () => setUploadOpen(true)}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" aria-label="Select all" /></th>
                <th className="px-3 py-2.5">File</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Project</th>
                <th className="hidden px-3 py-2.5 lg:table-cell">Folder</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Status</th>
                <th className="hidden px-3 py-2.5 lg:table-cell">Size</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Uploaded</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((doc) => (
                <tr key={doc.id} className={cn("hover:bg-muted/30", selected.has(doc.id) && "bg-brand-brown/5")}>
                  <td className="px-3 py-2.5"><input type="checkbox" checked={selected.has(doc.id)} onChange={() => toggleOne(doc.id)} className="rounded" aria-label={`Select ${doc.originalFilename}`} /></td>
                  <td className="max-w-[280px] px-3 py-2.5">
                    <Link to={`/admin/documents/${doc.id}`} className="flex items-center gap-2.5">
                      <FileTypeChip ext={doc.ext} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-medium text-brand-dark">{doc.originalFilename}</span>
                          <StarMark starred={doc.starred} />
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{doc.documentNumber} · v{doc.version} · {doc.tags.slice(0, 3).join(", ")}{doc.tags.length > 3 ? "…" : ""}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden max-w-[160px] px-3 py-2.5 md:table-cell">
                    <Link to={`/admin/pms/${doc.projectRef.id}`} className="block truncate text-xs hover:text-brand-brown" title={doc.projectRef.title}>
                      <span className="font-mono text-[11px] text-muted-foreground">{doc.projectRef.number}</span>
                      <span className="block truncate">{doc.projectRef.title}</span>
                    </Link>
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs lg:table-cell">{doc.folderName || "—"}</td>
                  <td className="hidden px-3 py-2.5 sm:table-cell">
                    <div className="flex items-center gap-1.5">
                      <DocumentStatusBadge status={String(doc.status)} />
                      <VisibilityBadge visibility={String(doc.visibility)} />
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 text-xs lg:table-cell">{formatBytes(doc.sizeBytes)}</td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 text-xs md:table-cell">{crmDayOnly(doc.createdAt)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => quickArchiveOne(doc)} className="rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted" title={doc.archived ? "Restore" : "Archive"}>
                        {doc.archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages} · {total} documents</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-40">
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-40">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <DocumentUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => { setUploadOpen(false); load() }}
        projects={projects}
        defaultProjectId={effectiveProjectId || undefined}
        defaultFolderId={folderId || undefined}
      />

      <CrmConfirmDialog
        open={bulkDialog !== null}
        title={bulkDialog?.title || ""}
        description={bulkDialog?.description || ""}
        confirmLabel={bulkDialog?.action === "restore" ? "Restore" : "Archive"}
        onConfirm={() => bulkDialog && runBulk(bulkDialog.action)}
        onCancel={() => setBulkDialog(null)}
      />
    </div>
  )
}
