// Documents → Projects browser: every project with its document footprint
// (files, storage), linking into the per-project documents workspace.
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { FolderKanban, ArrowRight } from "lucide-react"
import { fetchDocumentsProjectsLookup, fetchDocuments } from "@/lib/documentsApi"
import type { DocumentRecord } from "@/types/documents"
import { CrmEmptyState, CrmErrorState, CrmSpinner } from "@/components/admin/crm/CrmUI"
import { formatBytes } from "@/components/admin/documents/DocumentUI"

export default function DocumentsProjects() {
  const [projects, setProjects] = useState<{ id: string; number: string; title: string; client: string; archived: boolean }[] | null>(null)
  const [docs, setDocs] = useState<DocumentRecord[]>([])
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")

  const load = useCallback(async () => {
    setError("")
    try {
      const [lookup, allDocs] = await Promise.all([
        fetchDocumentsProjectsLookup(),
        fetchDocuments({ pageSize: 100, archived: "false" }).then(async (first) => {
          // Collect beyond the first page if needed (cap 300 for the counter).
          if (first.total <= first.pageSize) return first.documents
          const pages = Math.min(3, Math.ceil(first.total / first.pageSize))
          const rest = await Promise.all(
            Array.from({ length: pages - 1 }, (_, i) => fetchDocuments({ pageSize: 100, archived: "false", page: i + 2 }).then((r) => r.documents)),
          )
          return [...first.documents, ...rest.flat()]
        }),
      ])
      setProjects(lookup.projects)
      setDocs(allDocs)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load projects")
    }
  }, [])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    if (!projects) return []
    return projects.map((p) => {
      const mine = docs.filter((d) => d.projectRef?.id === p.id)
      return {
        ...p,
        files: mine.length,
        sizeBytes: mine.reduce((sum, d) => sum + (d.sizeBytes || 0), 0),
      }
    }).filter((p) => !query || `${p.number} ${p.title} ${p.client}`.toLowerCase().includes(query.toLowerCase()))
  }, [projects, docs, query])

  if (error && !projects) return <CrmErrorState message={error} onRetry={load} />
  if (!projects) return <CrmSpinner />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Project documents</h1>
        <p className="text-sm text-muted-foreground">Every project's file area — survey data, maps, CAD, reports and deliverables.</p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter projects…"
        className="w-full max-w-sm rounded-md border px-3 py-2 text-sm"
      />

      {rows.length === 0 ? (
        <CrmEmptyState
          icon={<FolderKanban className="h-8 w-8" />}
          title="No projects yet"
          description="Documents belong to projects — create one under Project Management, then upload its files here."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <li key={p.id}>
              <Link
                to={`/admin/documents/project/${p.id}`}
                className="flex h-full flex-col gap-2 rounded-lg border bg-white p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{p.number}{p.archived ? " · archived" : ""}</p>
                    <p className="truncate font-medium text-brand-dark">{p.title}</p>
                    {p.client && <p className="truncate text-xs text-muted-foreground">{p.client}</p>}
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-auto flex items-center gap-4 text-sm">
                  <span className="font-semibold text-brand-dark">{p.files}</span>
                  <span className="text-xs text-muted-foreground">file{p.files === 1 ? "" : "s"}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatBytes(p.sizeBytes)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
