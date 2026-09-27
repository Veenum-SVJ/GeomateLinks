// Document upload dialog — multi-file drag-and-drop into Vercel Blob via the
// existing /api/admin/upload client handshake, then metadata registration
// through /api/documents. Per-file progress and per-file failures; one bad
// file never loses the rest of the batch.
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2, UploadCloud, X, FileWarning, CheckCircle2 } from "lucide-react"
import { upload } from "@vercel/blob/client"
import {
  createDocumentFolder, fetchDocumentCategories, fetchDocumentFolders,
  fetchDocumentsProjectsLookup, registerDocument,
} from "@/lib/documentsApi"
import { DOCUMENT_STATUSES, VISIBILITY_LEVELS, SUGGESTED_TAGS, TYPE_LABELS } from "@/types/documents"
import type { DocumentRecord, DocumentFolder, DocumentCategory } from "@/types/documents"
import { cn } from "@/lib/utils"
import { crmDayOnly } from "@/components/admin/crm/CrmUI"

type Job = {
  key: string
  file: File
  status: "pending" | "uploading" | "registering" | "done" | "error"
  progress: number
  error?: string
  pathname?: string
  document?: DocumentRecord
}

export default function DocumentUploadDialog({
  open,
  onClose,
  onUploaded,
  projects,
  defaultProjectId,
  defaultFolderId,
}: {
  open: boolean
  onClose: () => void
  onUploaded: (docs: DocumentRecord[]) => void
  /** Lightweight project list (id/number/title). Pass to avoid a refetch. */
  projects?: { id: string; number: string; title: string; client: string; archived: boolean }[]
  defaultProjectId?: string
  defaultFolderId?: string
}) {
  const [fileList, setFileList] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [projectId, setProjectId] = useState(defaultProjectId || "")
  const [projectOptions, setProjectOptions] = useState<{ id: string; number: string; title: string; client: string; archived: boolean }[]>(projects || [])
  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [folderId, setFolderId] = useState(defaultFolderId || "")
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [categoryId, setCategoryId] = useState("")
  const [status, setStatus] = useState<string>("Draft")
  const [visibility, setVisibility] = useState<string>("Internal")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState("")
  const [versionNotes, setVersionNotes] = useState("")
  const [newFolderName, setNewFolderName] = useState("")
  const [jobs, setJobs] = useState<Job[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const started = jobs.length > 0

  useEffect(() => {
    if (!open) return
    setFileList([])
    setJobs([])
    setError("")
    setDescription("")
    setTags([])
    setTagDraft("")
    setVersionNotes("")
    setNewFolderName("")
    setStatus("Draft")
    setVisibility("Internal")
    setProjectId(defaultProjectId || "")
    setFolderId(defaultFolderId || "")
    setCategoryId("")
    if (projects) setProjectOptions(projects)
    else fetchDocumentsProjectsLookup().then((r) => setProjectOptions(r.projects)).catch(() => {})
    fetchDocumentCategories().then((r) => setCategories(r.categories)).catch(() => {})
  }, [open, defaultProjectId, defaultFolderId, projects])

  useEffect(() => {
    if (!open || !projectId) { setFolders([]); return }
    fetchDocumentFolders(projectId).then((r) => setFolders(r.folders)).catch(() => {})
  }, [open, projectId])

  if (!open) return null

  const addFiles = (incoming: File[]) => {
    // Validate locally first so users get instant feedback on type/size.
    const allowed = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "jpg", "jpeg", "png", "webp", "svg", "dwg", "dxf", "kml", "kmz", "zip", "rar"]
    const problems: string[] = []
    const accepted: File[] = []
    for (const file of incoming) {
      const ext = /\.([A-Za-z0-9]+)$/.exec(file.name)?.[1]?.toLowerCase() || ""
      if (!allowed.includes(ext)) problems.push(`${file.name}: ".${ext || "?"}" is not an allowed type`)
      else if (file.size > 200 * 1024 * 1024) problems.push(`${file.name}: over the 200 MB limit`)
      else accepted.push(file)
    }
    if (problems.length) setError(problems.join(" · "))
    else setError("")
    setFileList((prev) => [...prev, ...accepted])
  }

  const pickFolder = async () => {
    if (newFolderName.trim() && projectId) {
      try {
        const { folder } = await createDocumentFolder({ projectId, name: newFolderName.trim() })
        setFolders((prev) => [...prev, folder])
        setFolderId(folder.id)
        setNewFolderName("")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create the folder")
      }
      return
    }
    inputRef.current?.click()
  }

  const patchJob = (key: string, patch: Partial<Job>) =>
    setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, ...patch } : j)))

  const startUpload = async () => {
    if (!projectId) { setError("Choose a project for these files"); return }
    if (fileList.length === 0) { setError("Add at least one file"); return }
    const project = projectOptions.find((p) => p.id === projectId)
    const folder = folders.find((f) => f.id === folderId)
    const category = categories.find((c) => c.id === categoryId)
    setRunning(true)
    setError("")
    const initial: Job[] = fileList.map((file, i) => ({ key: `${Date.now()}-${i}`, file, status: "pending", progress: 0 }))
    setJobs(initial)
    const done: DocumentRecord[] = []

    for (const job of initial) {
      try {
        patchJob(job.key, { status: "uploading" })
        const safeName = job.file.name.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim()
        const pathname = `documents/upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
        // Bytes go straight to Blob via the existing client handshake.
        await upload(pathname, job.file, {
          access: "public",
          handleUploadUrl: "/api/admin/upload",
          onUploadProgress: (p) => patchJob(job.key, { progress: Math.min(99, Math.round((p.loaded / Math.max(1, p.total)) * 100)) }),
        } as Parameters<typeof upload>[2])
        patchJob(job.key, { status: "registering", progress: 100, pathname })
        // Metadata registration — the server re-validates everything.
        const { document } = await registerDocument({
          originalFilename: job.file.name,
          pathname,
          sizeBytes: job.file.size,
          projectRef: { id: project?.id || "", number: project?.number || "", title: project?.title || "" },
          folderId: folder?.id || "",
          folderName: folder?.name || "",
          categoryId: category?.id || "",
          categoryName: category?.name || "",
          description,
          tags,
          status,
          visibility,
          versionNotes,
          uploadedBy: "Admin",
        })
        patchJob(job.key, { status: "done", document })
        done.push(document)
      } catch (err) {
        patchJob(job.key, { status: "error", error: err instanceof Error ? err.message : "Upload failed" })
      }
    }

    setRunning(false)
    setFileList([])
    if (done.length > 0) onUploaded(done)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !running) onClose() }}
    >
      <div role="dialog" aria-modal="true" aria-label="Upload documents" className="w-full max-w-2xl rounded-lg border bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-sm font-semibold text-brand-dark">Upload documents</h2>
          <button onClick={() => !running && onClose()} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5 px-5 py-4 text-sm">
          {/* Drop zone */}
          {!started && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)) }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
                dragOver ? "border-brand-brown bg-brand-brown/5" : "border-border hover:border-brand-brown/40 hover:bg-muted/40",
              )}
            >
              <UploadCloud className="h-7 w-7 text-muted-foreground" />
              <p className="font-medium text-brand-dark">Drag files here or click to browse</p>
              <p className="text-xs text-muted-foreground">
                PDF, DOC(X), XLS(X), CSV, JPG, PNG, WEBP, SVG, DWG, DXF, KML, KMZ, ZIP, RAR — up to 200 MB each
              </p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : []
              e.target.value = ""
              addFiles(files)
            }}
          />

          {/* File chips */}
          {!started && fileList.length > 0 && (
            <ul className="space-y-1.5">
              {fileList.map((file, i) => (
                <li key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {TYPE_LABELS[/\.([A-Za-z0-9]+)$/.exec(file.name)?.[1]?.toLowerCase() || ""] || "FILE"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs">{file.name}</span>
                  <span className="text-[10px] text-muted-foreground">{file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`}</span>
                  <button onClick={() => setFileList((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-600" aria-label={`Remove ${file.name}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Metadata */}
          {!started && (
            <>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="block text-xs font-medium text-muted-foreground">
                  Project *
                  <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setFolderId("") }} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm" disabled={Boolean(defaultProjectId)}>
                    <option value="">Select project…</option>
                    {projectOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.number} — {p.title}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-muted-foreground">
                  Folder
                  <div className="mt-1 flex gap-1.5">
                    <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="w-full rounded-md border bg-white px-2 py-2 text-sm">
                      <option value="">Unfiled</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    <input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="New folder…"
                      className="w-28 shrink-0 rounded-md border px-2 py-2 text-xs"
                    />
                    <button type="button" onClick={pickFolder} className="shrink-0 rounded-md border px-2 text-xs font-medium hover:bg-muted">＋</button>
                  </div>
                </label>
                <label className="block text-xs font-medium text-muted-foreground">
                  Category
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
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
              </div>
              <label className="block text-xs font-medium text-muted-foreground">
                Description
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" placeholder="What is this document? e.g. Final topographic map for the Bodija site" />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Version notes (optional)
                <input value={versionNotes} onChange={(e) => setVersionNotes(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" placeholder="e.g. First issue after field QC" />
              </label>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Tags</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {SUGGESTED_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))}
                      className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", tags.includes(tag) ? "border-brand-brown bg-brand-brown text-white" : "text-muted-foreground hover:bg-muted")}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                {tagDraft.trim() && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Press Enter after typing a custom tag (comma separated)</p>
                )}
                <input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      const parts = tagDraft.split(",").map((t) => t.trim()).filter(Boolean)
                      if (parts.length) setTags((prev) => [...new Set([...prev, ...parts])].slice(0, 15))
                      setTagDraft("")
                    }
                  }}
                  placeholder="Custom tags, comma separated…"
                  className="mt-1.5 w-full rounded-md border px-2.5 py-2 text-sm"
                />
              </div>
            </>
          )}

          {/* Progress */}
          {started && (
            <ul className="space-y-2">
              {jobs.map((job) => (
                <li key={job.key} className="rounded-md border px-3 py-2">
                  <div className="flex items-center gap-2">
                    {job.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-brand-green" />
                    ) : job.status === "error" ? (
                      <FileWarning className="h-4 w-4 text-red-600" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-brand-brown" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{job.file.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{job.status}</span>
                  </div>
                  {job.status !== "done" && job.status !== "error" && (
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand-brown transition-all" style={{ width: `${job.progress}%` }} />
                    </div>
                  )}
                  {job.error && <p className="mt-1 text-xs text-red-600">{job.error}</p>}
                  {job.document && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {job.document.documentNumber} · v{job.document.version} · {crmDayOnly(job.document.createdAt)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          {!started ? (
            <>
              <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
              <button
                type="button"
                onClick={startUpload}
                disabled={running || fileList.length === 0 || !projectId}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50"
              >
                <UploadCloud className="h-3.5 w-3.5" /> Upload {fileList.length > 0 ? `${fileList.length} file${fileList.length === 1 ? "" : "s"}` : ""}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={running}
              className="rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50"
            >
              {running ? "Uploading…" : "Done"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
