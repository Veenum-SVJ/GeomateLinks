// Document detail — preview (PDF/images/text where the browser can render
// them; metadata + download for CAD/GIS/archives), version history with
// restore, metadata editing, move/archive/star, download and the activity
// trail for this document.
import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { createPortal } from "react-dom"
import {
  ArrowLeft, Download, UploadCloud, Archive, ArchiveRestore, Star, Pencil,
  History, RotateCcw, Trash2, Loader2, FileWarning, Eye,
} from "lucide-react"
import {
  fetchDocument, updateDocument, deleteDocument, archiveDocument, documentFileUrl,
  restoreDocumentVersion, fetchDocumentCategories, fetchDocumentFolders,
  registerDocumentVersion, upload,
} from "@/lib/documentsApi"
import { previewKind, TYPE_LABELS, DOCUMENT_STATUSES, VISIBILITY_LEVELS } from "@/types/documents"
import type { DocumentDetailResult, DocumentRecord } from "@/types/documents"
import { CrmConfirmDialog, CrmErrorState, CrmSpinner, crmDayOnly, crmRelativeTime } from "@/components/admin/crm/CrmUI"
import { activityLabel, DocumentStatusBadge, FileTypeChip, formatBytes, StarMark, VersionChip, VisibilityBadge } from "@/components/admin/documents/DocumentUI"
import { cn } from "@/lib/utils"

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<DocumentDetailResult | null>(null)
  const [error, setError] = useState("")
  const [actionError, setActionError] = useState("")
  const [editOpen, setEditOpen] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)
  const [confirm, setConfirm] = useState<null | { title: string; description: string; confirmLabel: string; run: () => Promise<void> }>(null)
  const [previewFailed, setPreviewFailed] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setError("")
    try {
      setDetail(await fetchDocument(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the document")
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (error && !detail) return <CrmErrorState message={error} onRetry={load} />
  if (!detail) return <CrmSpinner />

  const doc = detail.document
  const kind = previewKind(doc.ext)

  return (
    <div className="space-y-4">
      <Link to="/admin/documents/all" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All files
      </Link>

      {actionError && <CrmErrorState message={actionError} onRetry={() => setActionError("")} />}

      {/* Header */}
      <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <FileTypeChip ext={doc.ext} />
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight text-brand-dark">
              {doc.originalFilename} <StarMark starred={doc.starred} />
            </h1>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{doc.documentNumber} · v{doc.version} · {TYPE_LABELS[doc.ext] || doc.ext.toUpperCase()} · {formatBytes(doc.sizeBytes)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <DocumentStatusBadge status={String(doc.status)} />
              <VisibilityBadge visibility={String(doc.visibility)} />
              {doc.archived && <span className="rounded-full border border-gray-300 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">Archived</span>}
              {doc.projectRef.id && (
                <Link to={`/admin/pms/${doc.projectRef.id}`} className="text-xs text-muted-foreground hover:text-brand-brown">
                  {doc.projectRef.number} — {doc.projectRef.title}
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <a
            href={documentFileUrl(doc.id, { download: true })}
            onClick={() => setActionError("")}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
          <button onClick={() => setVersionOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            <UploadCloud className="h-3.5 w-3.5" /> New version
          </button>
          <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            <Pencil className="h-3.5 w-3.5" /> Edit metadata
          </button>
          <button
            onClick={() =>
              setConfirm({
                title: doc.starred ? "Remove star?" : "Star this document?",
                description: "Stars are a personal quick-filter across the document system.",
                confirmLabel: doc.starred ? "Unstar" : "Star",
                run: async () => {
                  const { document } = await updateDocument(doc.id, { starred: !doc.starred })
                  setDetail((prev) => (prev ? { ...prev, document } : prev))
                },
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Star className={cn("h-3.5 w-3.5", doc.starred && "fill-amber-400 text-amber-400")} /> {doc.starred ? "Unstar" : "Star"}
          </button>
          <button
            onClick={() =>
              setConfirm({
                title: doc.archived ? "Restore from archive?" : "Archive this document?",
                description: doc.archived
                  ? "The document returns to the active lists."
                  : "Archived documents stay in the system under Archived and can be restored any time. Nothing is deleted.",
                confirmLabel: doc.archived ? "Restore" : "Archive",
                run: async () => {
                  const { document } = await archiveDocument(doc.id, !doc.archived)
                  setDetail((prev) => (prev ? { ...prev, document } : prev))
                },
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {doc.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />} {doc.archived ? "Restore" : "Archive"}
          </button>
          <button
            onClick={() =>
              setConfirm({
                title: "Permanently delete this document?",
                description: `This removes the file and all ${detail.versions.length} version(s) from storage. This cannot be undone — prefer Archive for anything you may need again.`,
                confirmLabel: "Delete forever",
                run: async () => {
                  await deleteDocument(doc.id)
                  navigate("/admin/documents/all")
                },
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Preview */}
        <section className="rounded-lg border bg-white lg:col-span-2">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark"><Eye className="h-3.5 w-3.5" /> Preview</h2>
            <a href={documentFileUrl(doc.id, { download: true })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-brown">
              <Download className="h-3 w-3" /> Download {TYPE_LABELS[doc.ext] || doc.ext.toUpperCase()}
            </a>
          </div>
          {kind === "none" || previewFailed ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <FileWarning className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-brand-dark">
                {previewFailed ? "Preview failed to load" : `.${doc.ext} files can't be previewed in the browser`}
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {doc.description || "The full file is available — use Download above. Metadata and version history remain available here."}
              </p>
            </div>
          ) : (
            <div className="p-4">
              {kind === "pdf" && (
                <iframe
                  key={doc.id + doc.version}
                  src={documentFileUrl(doc.id)}
                  title={`Preview of ${doc.originalFilename}`}
                  onError={() => setPreviewFailed(true)}
                  className="h-[560px] w-full rounded-md border bg-muted"
                />
              )}
              {kind === "image" && (
                <img
                  key={doc.id + doc.version}
                  src={documentFileUrl(doc.id)}
                  alt={doc.originalFilename}
                  onError={() => setPreviewFailed(true)}
                  className="max-h-[560px] w-full rounded-md border object-contain"
                />
              )}
              {kind === "text" && (
                <iframe
                  key={doc.id + doc.version}
                  src={documentFileUrl(doc.id)}
                  title={`Preview of ${doc.originalFilename}`}
                  onError={() => setPreviewFailed(true)}
                  className="h-[560px] w-full rounded-md border bg-white"
                />
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Preview serves the current version (v{doc.version}) through the authenticated file route.
              </p>
            </div>
          )}
        </section>

        {/* Metadata */}
        <div className="space-y-4">
          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Details</h2>
            <dl className="mt-2 space-y-1.5 text-sm">
              <Row label="Document ID" value={doc.documentNumber} mono />
              <Row label="Type" value={TYPE_LABELS[doc.ext] || doc.ext.toUpperCase()} />
              <Row label="Size" value={formatBytes(doc.sizeBytes)} />
              <Row label="Folder" value={doc.folderName || "Unfiled"} />
              <Row label="Category" value={doc.categoryName || "—"} />
              <Row label="Version" value={`v${doc.version}`} />
              <Row label="Uploaded by" value={doc.uploadedBy} />
              <Row label="Uploaded" value={crmDayOnly(doc.createdAt)} />
              <Row label="Updated" value={crmDayOnly(doc.updatedAt)} />
              <Row label="Last accessed" value={doc.lastAccessedAt ? crmRelativeTime(doc.lastAccessedAt) : "—"} />
            </dl>
            {doc.description && (
              <div className="mt-3 border-t pt-3">
                <h3 className="text-xs font-semibold text-muted-foreground">Description</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{doc.description}</p>
              </div>
            )}
            {doc.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
                {doc.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{tag}</span>
                ))}
              </div>
            )}
          </section>

          {/* Versions */}
          <section className="rounded-lg border bg-white">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold text-brand-dark">Versions ({detail.versions.length})</h2>
              <button onClick={() => setVersionOpen(true)} className="text-xs font-medium text-brand-brown hover:underline">Upload new version</button>
            </div>
            <ul className="divide-y">
              {detail.versions.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm">
                      <VersionChip version={v.version} />
                      {v.version === doc.version && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-green-700">Current</span>}
                      <span className="truncate text-xs text-muted-foreground">{formatBytes(v.sizeBytes)} · {crmDayOnly(v.uploadedAt)} · {v.uploadedBy}</span>
                    </p>
                    {v.notes && <p className="truncate text-xs text-muted-foreground">{v.notes}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <a href={documentFileUrl(doc.id, { version: v.version, download: true })} className="rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted" title="Download this version">
                      <Download className="h-3 w-3" />
                    </a>
                    {v.version !== doc.version && (
                      <button
                        onClick={() =>
                          setConfirm({
                            title: `Restore version ${v.version}?`,
                            description: `The file from version ${v.version} becomes a new current version (v${doc.version + 1}). No history is lost.`,
                            confirmLabel: "Restore",
                            run: async () => {
                              const { document } = await restoreDocumentVersion(doc.id, v.id)
                              setDetail((prev) => (prev ? { ...prev, document } : prev))
                              await load()
                            },
                          })
                        }
                        className="rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted"
                        title="Restore this version"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Activity */}
          <section className="rounded-lg border bg-white">
            <div className="border-b px-4 py-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark"><History className="h-3.5 w-3.5" /> Activity</h2>
            </div>
            {detail.activity.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ol className="relative space-y-3 px-4 py-4">
                {detail.activity.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <p className="font-medium text-brand-dark">{activityLabel(entry.action)}</p>
                    {entry.detail && <p className="text-xs text-muted-foreground">{entry.detail}</p>}
                    <p className="text-[11px] text-muted-foreground">{crmDayOnly(entry.at)} · {crmRelativeTime(entry.at)} · {entry.actor}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      <EditMetadataDialog
        open={editOpen}
        doc={doc}
        onClose={() => setEditOpen(false)}
        onSaved={(document) => { setEditOpen(false); setDetail((prev) => (prev ? { ...prev, document } : prev)) }}
        onError={setActionError}
      />
      <NewVersionDialog
        open={versionOpen}
        doc={doc}
        onClose={() => setVersionOpen(false)}
        onSaved={() => { setVersionOpen(false); load() }}
      />

      <CrmConfirmDialog
        open={confirm !== null}
        title={confirm?.title || ""}
        description={confirm?.description || ""}
        confirmLabel={confirm?.confirmLabel}
        onConfirm={() => {
          const run = confirm?.run
          setConfirm(null)
          run?.().catch((err) => setActionError(err instanceof Error ? err.message : "Action failed"))
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("truncate text-right", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  )
}

// ------------------------------------------------------------- edit dialog

function EditMetadataDialog({
  open, doc, onClose, onSaved, onError,
}: {
  open: boolean
  doc: DocumentRecord
  onClose: () => void
  onSaved: (doc: DocumentRecord) => void
  onError: (message: string) => void
}) {
  const [originalFilename, setOriginalFilename] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState("")
  const [visibility, setVisibility] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [folderId, setFolderId] = useState("")
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([])
  const [tags, setTags] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setOriginalFilename(doc.originalFilename)
    setDescription(doc.description)
    setStatus(String(doc.status))
    setVisibility(String(doc.visibility))
    setCategoryId(doc.categoryId)
    setFolderId(doc.folderId)
    setTags(doc.tags.join(", "))
    setError("")
    fetchDocumentCategories().then((r) => setCategories(r.categories)).catch(() => {})
    if (doc.projectRef.id) fetchDocumentFolders(doc.projectRef.id).then((r) => setFolders(r.folders)).catch(() => {})
  }, [open, doc])

  if (!open) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      const category = categories.find((c) => c.id === categoryId)
      const folder = folders.find((f) => f.id === folderId)
      const { document } = await updateDocument(doc.id, {
        originalFilename: originalFilename.trim() || doc.originalFilename,
        description,
        status,
        visibility,
        categoryId: categoryId || "",
        categoryName: category?.name || "",
        folderId: folderId || "",
        folderName: folder?.name || "",
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 15),
      })
      onSaved(document)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save the metadata"
      setError(message)
      onError(message)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Edit document metadata" className="w-full max-w-lg rounded-lg border bg-white shadow-lg">
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-semibold text-brand-dark">Edit metadata</h2>
        </div>
        <div className="space-y-2.5 px-5 py-4 text-sm">
          <label className="block text-xs font-medium text-muted-foreground">
            Filename
            <input value={originalFilename} onChange={(e) => setOriginalFilename(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-muted-foreground">
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                {DOCUMENT_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Visibility
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                {VISIBILITY_LEVELS.map((v) => (<option key={v} value={v}>{v}</option>))}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Folder
              <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                <option value="">Unfiled</option>
                {folders.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Category
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                <option value="">—</option>
                {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </label>
          </div>
          <label className="block text-xs font-medium text-muted-foreground">
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Tags (comma separated)
            <input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
          <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save changes
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------- version dialog

function NewVersionDialog({
  open, doc, onClose, onSaved,
}: {
  open: boolean
  doc: DocumentRecord
  onClose: () => void
  onSaved: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState("")
  const [progress, setProgress] = useState(0)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setFile(null)
    setNotes("")
    setProgress(0)
    setError("")
  }, [open])

  if (!open) return null

  const submit = async () => {
    if (!file) { setError("Choose a file first"); return }
    setRunning(true)
    setError("")
    try {
      const safeName = file.name.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim()
      const pathname = `documents/upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
      await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
        onUploadProgress: (p) => setProgress(Math.min(99, Math.round((p.loaded / Math.max(1, p.total)) * 100))),
      } as Parameters<typeof upload>[2])
      setProgress(100)
      await registerDocumentVersion(doc.id, {
        originalFilename: file.name,
        pathname,
        sizeBytes: file.size,
        versionNotes: notes,
        uploadedBy: "Admin",
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Version upload failed")
    } finally {
      setRunning(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !running) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Upload new version" className="w-full max-w-md rounded-lg border bg-white shadow-lg">
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-semibold text-brand-dark">Upload new version</h2>
          <p className="text-xs text-muted-foreground">{doc.originalFilename} — current v{doc.version}. Previous versions are preserved.</p>
        </div>
        <div className="space-y-2.5 px-5 py-4 text-sm">
          <input type="file" onChange={(e) => { setFile(e.target.files?.[0] || null); setError("") }} className="w-full rounded-md border px-2.5 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs" />
          <label className="block text-xs font-medium text-muted-foreground">
            Version notes (optional)
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" placeholder="e.g. Incorporated client comments" />
          </label>
          {running && (
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand-brown transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button type="button" onClick={onClose} disabled={running} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
          <button type="button" onClick={submit} disabled={running || !file} className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />} Upload version
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
