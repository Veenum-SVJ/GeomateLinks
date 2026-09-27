// ProjectDetail "Documents" tab + the deliverable→document attach dialog.
// The tab shows the project document summary (total files, storage,
// per-folder counts, recent files, final deliverables) with upload/create-
// folder shortcuts; the attach dialog links existing DMS documents to a
// project deliverable via the existing deliverable endpoint (documentIds).
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { createPortal } from "react-dom"
import {
  Files, HardDrive, FolderKanban, Truck, UploadCloud, Loader2, Link2, ArrowRight, X,
} from "lucide-react"
import { fetchProjectDocumentSummary, fetchDocumentFolders } from "@/lib/documentsApi"
import { updateProjectDeliverable } from "@/lib/projectsApi"
import type { DocumentProjectSummary, DocumentRecord } from "@/types/documents"
import { CrmEmptyState, CrmSpinner, crmRelativeTime } from "@/components/admin/crm/CrmUI"
import { DocumentStatusBadge, FileTypeChip, formatBytes } from "@/components/admin/documents/DocumentUI"
import { cn } from "@/lib/utils"

export function ProjectDocumentsTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<DocumentProjectSummary | null>(null)
  const [error, setError] = useState("")
  const [uploadHint, setUploadHint] = useState(false)

  const load = useCallback(async () => {
    setError("")
    try {
      setData(await fetchProjectDocumentSummary(projectId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load documents")
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    )
  }
  if (!data) return <CrmSpinner />

  const s = data.summary
  const uploadTarget = `/admin/documents/all?projectId=${projectId}`

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-3.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Files className="h-3.5 w-3.5" /> Total files</span>
          <span className="text-xl font-semibold text-brand-dark">{s.totalFiles}</span>
        </div>
        <div className="rounded-lg border bg-white p-3.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><HardDrive className="h-3.5 w-3.5" /> Storage</span>
          <span className="text-xl font-semibold text-brand-dark">{formatBytes(s.storageBytes)}</span>
        </div>
        <div className="rounded-lg border bg-white p-3.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><FolderKanban className="h-3.5 w-3.5" /> Folders in use</span>
          <span className="text-xl font-semibold text-brand-dark">{s.folders.length}</span>
        </div>
        <div className="rounded-lg border bg-white p-3.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Truck className="h-3.5 w-3.5" /> Deliverable-linked</span>
          <span className="text-xl font-semibold text-brand-dark">{s.deliverablesLinked}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setUploadHint(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90">
          <UploadCloud className="h-3.5 w-3.5" /> Upload files
        </button>
        <Link to={`/admin/documents/project/${projectId}`} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
          Open documents <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link to={`/admin/documents/all?projectId=${projectId}`} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
          Search & filter
        </Link>
      </div>
      {uploadHint && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>
            Uploads run from the project documents workspace — they carry the folder, category, status and version metadata.
          </span>
          <span className="flex shrink-0 gap-2">
            <Link to={uploadTarget} onClick={() => setUploadHint(false)} className="rounded-md bg-brand-brown px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-brown/90">
              Continue to upload
            </Link>
            <button onClick={() => setUploadHint(false)} className="rounded p-1 hover:bg-amber-100" aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
          </span>
        </div>
      )}

      {/* Folders in use */}
      {s.folders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {s.folders.map((f) => (
            <Link
              key={f.id}
              to={`/admin/documents/all?projectId=${projectId}&folderId=${f.id}`}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium hover:border-brand-brown hover:text-brand-brown"
            >
              {f.name}
              <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{f.files}</span>
              <span className="text-[10px] text-muted-foreground">{formatBytes(f.sizeBytes)}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Recent files */}
      {s.totalFiles === 0 ? (
        <CrmEmptyState
          icon={<UploadCloud className="h-8 w-8" />}
          title="No documents in this project yet"
          description="Survey data, field records, maps, CAD drawings, reports and final deliverables will live here."
        />
      ) : (
        <section className="overflow-hidden rounded-lg border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-brand-dark">Recent files</h2>
            <Link to={uploadTarget} className="text-xs font-medium text-brand-brown hover:underline">View all</Link>
          </div>
          <ul className="divide-y">
            {s.recentFiles.map((doc) => (
              <li key={doc.id}>
                <Link to={`/admin/documents/${doc.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                  <FileTypeChip ext={doc.ext} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-brand-dark">{doc.originalFilename}</p>
                    <p className="truncate text-xs text-muted-foreground">{doc.documentNumber} · {doc.folderName || "Unfiled"} · {formatBytes(doc.sizeBytes)} · {crmRelativeTime(doc.createdAt)}</p>
                  </div>
                  <DocumentStatusBadge status={String(doc.status)} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// -------------------------------------------------- deliverable attach dialog

export function AttachDocumentsDialog({
  open, projectId, deliverable, onClose, onSaved,
}: {
  open: boolean
  projectId: string
  deliverable: { id: string; name: string; documentIds?: string[] } | null
  onClose: () => void
  onSaved: () => void
}) {
  const [docs, setDocs] = useState<DocumentRecord[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !deliverable) return
    setSelected(new Set(deliverable.documentIds || []))
    setError("")
    fetchProjectDocumentSummary(projectId)
      .then((data) => setDocs(data.documents))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load documents"))
  }, [open, deliverable, projectId])

  if (!open || !deliverable) return null

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      await updateProjectDeliverable(projectId, deliverable.id, { documentIds: [...selected] })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach the documents")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Attach documents to deliverable" className="w-full max-w-lg rounded-lg border bg-white shadow-lg">
        <div className="border-b px-5 py-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark"><Link2 className="h-3.5 w-3.5" /> Attach documents</h2>
          <p className="text-xs text-muted-foreground">{deliverable.name} — these files represent the official output for this deliverable.</p>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-5 py-3">
          {error && <p className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          {docs === null ? (
            <CrmSpinner />
          ) : docs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No documents in this project yet — upload files from the Documents tab first.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {docs.map((doc) => (
                <li key={doc.id}>
                  <label className={cn("flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2", selected.has(doc.id) ? "border-brand-brown bg-brand-brown/5" : "hover:bg-muted/40")}>
                    <input type="checkbox" checked={selected.has(doc.id)} onChange={() => toggle(doc.id)} className="rounded" />
                    <FileTypeChip ext={doc.ext} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{doc.originalFilename}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{doc.documentNumber} · {doc.folderName || "Unfiled"} · v{doc.version}</span>
                    </span>
                    <DocumentStatusBadge status={String(doc.status)} />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
          <button type="button" onClick={submit} disabled={saving || docs === null} className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Attach {selected.size > 0 ? `${selected.size} document${selected.size === 1 ? "" : "s"}` : ""}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Compact display of a deliverable's attached documents (used in the
// Deliverables tab rows).
export function AttachedDocumentsList({ projectId, documentIds }: { projectId: string; documentIds?: string[] }) {
  const [docs, setDocs] = useState<DocumentRecord[] | null>(null)

  useEffect(() => {
    if (!documentIds || documentIds.length === 0) return
    let cancelled = false
    fetchDocumentFolders(projectId).catch(() => {})
    fetchProjectDocumentSummary(projectId)
      .then((data) => { if (!cancelled) setDocs(data.documents) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [projectId, documentIds])

  if (!documentIds || documentIds.length === 0) return null
  const attached = (docs || []).filter((d) => documentIds.includes(d.id))
  if (!docs || attached.length === 0) {
    return <p className="text-[11px] text-muted-foreground">{documentIds.length} document(s) attached</p>
  }
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {attached.map((doc) => (
        <li key={doc.id}>
          <Link
            to={`/admin/documents/${doc.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2 py-1 text-[11px] font-medium hover:border-brand-brown hover:text-brand-brown"
          >
            <FileTypeChip ext={doc.ext} />
            <span className="max-w-[200px] truncate">{doc.originalFilename}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
