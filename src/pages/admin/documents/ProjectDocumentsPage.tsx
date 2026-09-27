// Per-project documents page (ProjectDetail → Documents → "Open Documents"
// and the DMS Projects browser). Shows the project document summary — total
// files, storage, per-folder counts, recent files — plus the full filtered
// list, upload and folder creation for THIS project (no manual id entry).
import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, FolderPlus, HardDrive, Files, Truck, UploadCloud, ChevronDown } from "lucide-react"
import { fetchProjectDocumentSummary, createDocumentFolder } from "@/lib/documentsApi"
import { fetchProject } from "@/lib/projectsApi"
import type { DocumentProjectSummary } from "@/types/documents"
import type { DocumentFolder } from "@/types/documents"
import type { ProjectDetailResult } from "@/types/projects"
import { CrmErrorState, CrmSpinner, CrmEmptyState, crmRelativeTime } from "@/components/admin/crm/CrmUI"
import { DocumentStatusBadge, FileTypeChip, formatBytes } from "@/components/admin/documents/DocumentUI"
import { cn } from "@/lib/utils"

export default function ProjectDocumentsPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetailResult | null>(null)
  const [summary, setSummary] = useState<DocumentProjectSummary | null>(null)
  const [error, setError] = useState("")
  const [folderOpen, setFolderOpen] = useState(false)
  const [newFolder, setNewFolder] = useState("")
  const [actionError, setActionError] = useState("")

  const load = useCallback(async () => {
    if (!id) return
    setError("")
    try {
      const [projectDetail, docSummary] = await Promise.all([
        fetchProject(id).catch(() => null),
        fetchProjectDocumentSummary(id),
      ])
      setProject(projectDetail)
      setSummary(docSummary)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the project documents")
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (error && !summary) return <CrmErrorState message={error} onRetry={load} />
  if (!summary) return <CrmSpinner />

  const s = summary.summary

  const createFolderForProject = async () => {
    if (!id || !newFolder.trim()) return
    setActionError("")
    try {
      await createDocumentFolder({ projectId: id, name: newFolder.trim() })
      setNewFolder("")
      setFolderOpen(false)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not create the folder")
    }
  }

  return (
    <div className="space-y-4">
      <Link to={id ? `/admin/pms/${id}` : "/admin/pms/all"} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to project
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Project {project?.project.number || ""}</p>
          <h1 className="text-xl font-semibold tracking-tight text-brand-dark">{project?.project.title || "Project documents"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            {!folderOpen ? (
              <button onClick={() => setFolderOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
                <FolderPlus className="h-3.5 w-3.5" /> Create folder
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") createFolderForProject() }}
                  placeholder="Folder name…"
                  className="w-40 rounded-md border px-2.5 py-2 text-sm"
                />
                <button onClick={createFolderForProject} className="rounded-md bg-brand-brown px-3 py-2 text-xs font-semibold text-white hover:bg-brand-brown/90">Create</button>
                <button onClick={() => { setFolderOpen(false); setNewFolder("") }} className="rounded-md border px-2 py-2 text-xs">Cancel</button>
              </div>
            )}
          </div>
          <Link
            to={`/admin/documents/all?projectId=${id || ""}`}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Advanced search
          </Link>
        </div>
      </div>

      {actionError && <CrmErrorState message={actionError} onRetry={() => setActionError("")} />}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-3.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Files className="h-3.5 w-3.5" /> Total files</span>
          <span className="text-xl font-semibold text-brand-dark">{s.totalFiles}</span>
        </div>
        <div className="rounded-lg border bg-white p-3.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><HardDrive className="h-3.5 w-3.5" /> Storage used</span>
          <span className="text-xl font-semibold text-brand-dark">{formatBytes(s.storageBytes)}</span>
        </div>
        <div className="rounded-lg border bg-white p-3.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Truck className="h-3.5 w-3.5" /> Deliverable-linked</span>
          <span className="text-xl font-semibold text-brand-dark">{s.deliverablesLinked}</span>
        </div>
        <div className="rounded-lg border bg-white p-3.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ChevronDown className="h-3.5 w-3.5" /> Folders</span>
          <span className="text-xl font-semibold text-brand-dark">{summary.folders.length}</span>
        </div>
      </div>

      {/* Folders */}
      {s.folders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {s.folders.map((f) => (
            <Link
              key={f.id}
              to={`/admin/documents/all?projectId=${id || ""}&folderId=${f.id}`}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium hover:border-brand-brown hover:text-brand-brown"
            >
              {f.name}
              <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{f.files}</span>
              <span className="text-[10px] text-muted-foreground">{formatBytes(f.sizeBytes)}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Recent + full list */}
      {s.totalFiles === 0 ? (
        <CrmEmptyState
          icon={<UploadCloud className="h-8 w-8" />}
          title="No documents in this project yet"
          description="Upload your first project file — survey data, maps, CAD drawings, photos, reports or deliverables."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-lg border bg-white lg:col-span-2">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold text-brand-dark">All documents ({s.totalFiles})</h2>
            </div>
            <ul className="divide-y">
              {[...summary.documents].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((doc) => (
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

          <section className="rounded-lg border bg-white">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold text-brand-dark">Recent files</h2>
            </div>
            <ul className="divide-y">
              {s.recentFiles.map((doc) => (
                <li key={doc.id}>
                  <Link to={`/admin/documents/${doc.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                    <FileTypeChip ext={doc.ext} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{doc.originalFilename}</p>
                      <p className="text-[11px] text-muted-foreground">{crmRelativeTime(doc.createdAt)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}

// Folder chip shared with the project page (kept local to avoid a cycle).
export function FolderChip({ folder }: { folder: DocumentFolder }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium")}>
      {folder.name}
    </span>
  )
}
