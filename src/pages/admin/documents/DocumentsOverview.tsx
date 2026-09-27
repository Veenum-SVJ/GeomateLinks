// Document Management dashboard — totals, storage, uploaded today, awaiting
// review, recent / recently modified / recently downloaded lists, and
// files-by-type / files-by-project breakdowns.
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Files, HardDrive, UploadCloud, Eye, Archive, FolderKanban, ArrowRight } from "lucide-react"
import { fetchDocumentsDashboard } from "@/lib/documentsApi"
import type { DocumentsDashboardResult } from "@/types/documents"
import { CrmErrorState, CrmSpinner, crmRelativeTime } from "@/components/admin/crm/CrmUI"
import { DocumentStatusBadge, FileTypeChip, formatBytes } from "@/components/admin/documents/DocumentUI"

export default function DocumentsOverview() {
  const [data, setData] = useState<DocumentsDashboardResult | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setError("")
    try {
      setData(await fetchDocumentsDashboard())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the dashboard")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <CrmSpinner />
  if (error && !data) return <CrmErrorState message={error} onRetry={load} />
  if (!data) return null

  const t = data.totals

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">Project files, field data, maps and deliverables — private to the practice.</p>
        </div>
        <Link to="/admin/documents/all" className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90">
          All Files <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard icon={<Files className="h-4 w-4" />} label="Total files" value={String(t.files)} to="/admin/documents/all" />
        <StatCard icon={<HardDrive className="h-4 w-4" />} label="Storage used" value={formatBytes(t.storageBytes)} />
        <StatCard icon={<UploadCloud className="h-4 w-4" />} label="Uploaded today" value={String(t.uploadedToday)} />
        <StatCard icon={<Eye className="h-4 w-4" />} label="Awaiting review" value={String(t.awaitingReview)} to="/admin/documents/all?status=Under+Review" />
        <StatCard icon={<Archive className="h-4 w-4" />} label="Archived" value={String(t.archivedFiles)} to="/admin/documents/archived" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ListCard
            title="Recent documents"
            empty="No documents yet — upload the first project file."
            emptyAction={{ label: "Upload files", to: "/admin/documents/all" }}
            items={data.recent.map((d) => ({
              id: d.id,
              to: `/admin/documents/${d.id}`,
              chip: <FileTypeChip ext={d.ext} />,
              title: d.originalFilename,
              meta: `${d.documentNumber} · ${d.projectRef.number || "—"} · ${formatBytes(d.sizeBytes)} · ${crmRelativeTime(d.createdAt)}`,
              badge: <DocumentStatusBadge status={String(d.status)} />,
            }))}
          />
          <ListCard
            title="Recently modified"
            empty="Nothing modified yet."
            items={data.recentlyModified.map((d) => ({
              id: d.id,
              to: `/admin/documents/${d.id}`,
              chip: <FileTypeChip ext={d.ext} />,
              title: d.originalFilename,
              meta: `${d.folderName || "Unfiled"} · v${d.version} · updated ${crmRelativeTime(d.updatedAt)}`,
              badge: <DocumentStatusBadge status={String(d.status)} />,
            }))}
          />
          <ListCard
            title="Recently downloaded"
            empty="No downloads recorded yet."
            items={data.recentlyDownloaded.map((d) => ({
              id: d.id,
              to: `/admin/documents/${d.id}`,
              chip: <FileTypeChip ext={d.ext} />,
              title: d.originalFilename,
              meta: `${d.uploadedBy} · last accessed ${d.lastAccessedAt ? crmRelativeTime(d.lastAccessedAt) : "—"}`,
            }))}
          />
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Files by type</h2>
            {Object.keys(data.byType).length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No files yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {Object.entries(data.byType).sort((a, b) => b[1] - a[1]).map(([ext, count]) => (
                  <li key={ext} className="flex items-center justify-between text-sm">
                    <Link to={`/admin/documents/all?type=${ext}`} className="flex items-center gap-2 hover:text-brand-brown">
                      <FileTypeChip ext={ext} /> <span className="font-mono text-xs uppercase">{ext}</span>
                    </Link>
                    <span className="text-muted-foreground">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark"><FolderKanban className="h-3.5 w-3.5" /> Files by project</h2>
            {data.byProject.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No documents attached to projects yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {data.byProject.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-muted-foreground">{p.number}</p>
                      <p className="truncate text-xs">{p.title}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{p.files}</p>
                      <p className="text-[10px] text-muted-foreground">{formatBytes(p.sizeBytes)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Categories</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/admin/documents/all?categoryId=${c.id}`}
                  className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-brand-brown hover:text-brand-brown"
                >
                  {c.name}
                </Link>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Manage categories under Settings → Document categories.</p>
          </section>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: string; to?: string }) {
  const body = (
    <div className="flex flex-col gap-1 rounded-lg border bg-white p-3.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon} {label}</span>
      <span className="text-xl font-semibold tracking-tight text-brand-dark">{value}</span>
    </div>
  )
  return to ? <Link to={to} className="transition-shadow hover:shadow-sm">{body}</Link> : body
}

function ListCard({
  title, items, empty, emptyAction,
}: {
  title: string
  items: { id: string; to: string; chip: React.ReactNode; title: string; meta: string; badge?: React.ReactNode }[]
  empty: string
  emptyAction?: { label: string; to: string }
}) {
  return (
    <section className="rounded-lg border bg-white">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-dark">{title}</h2>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">{empty}</p>
          {emptyAction && (
            <Link to={emptyAction.to} className="mt-2 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
              {emptyAction.label}
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={item.to} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                {item.chip}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-brand-dark">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.meta}</p>
                </div>
                {item.badge}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
