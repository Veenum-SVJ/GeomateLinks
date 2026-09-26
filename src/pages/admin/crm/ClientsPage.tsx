// Clients list — search, type filter, pagination; desktop table with mobile
// cards. Rows open the client's history page.
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Search, ChevronLeft, ChevronRight, Building2 } from "lucide-react"
import { CLIENT_TYPES } from "@/types/crm"
import type { ClientListResult } from "@/types/crm"
import { fetchClients } from "@/lib/crmApi"
import { CrmSpinner, CrmErrorState, CrmEmptyState, crmRelativeTime } from "@/components/admin/crm/CrmUI"
import ClientFormDialog from "@/components/admin/crm/ClientFormDialog"

const selectClass = "h-10 rounded-md border border-input bg-background px-2.5 text-sm sm:text-base"

export default function ClientsPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [type, setType] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ClientListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [refresh, setRefresh] = useState(0)

  const queryKey = JSON.stringify({ query, type, page, refresh })
  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setData(await fetchClients(JSON.parse(queryKey)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load clients")
    } finally {
      setLoading(false)
    }
  }, [queryKey])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  const set = (patch: Partial<{ query: string; type: string }>) => {
    if ("query" in patch) setQuery(patch.query ?? "")
    if ("type" in patch) setType(patch.type ?? "")
    setPage(1)
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const hasFilters = useMemo(() => Boolean(query || type), [query, type])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">Converted and directly-added clients, with their full history.</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90">
          <Plus className="h-4 w-4" />
          Add Client
        </button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border bg-white p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Search name, company, email, phone, client ID…"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm sm:text-base"
          />
        </div>
        <select aria-label="Client type filter" value={type} onChange={(e) => set({ type: e.target.value })} className={selectClass}>
          <option value="">All types</option>
          {CLIENT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {error && <CrmErrorState message={error} onRetry={load} />}
      {loading && !data && <CrmSpinner />}

      {data && (
        <>
          <p className="text-sm text-muted-foreground">
            {data.total} client{data.total === 1 ? "" : "s"}
            {hasFilters ? " matching filters" : ""}
            {data.total > data.pageSize && ` · page ${data.page} of ${totalPages}`}
          </p>

          {data.clients.length === 0 ? (
            <CrmEmptyState
              icon={<Building2 className="h-8 w-8" />}
              title={hasFilters ? "No clients match these filters" : "No clients yet"}
              description={hasFilters ? "Try adjusting or clearing the filters above." : "Convert a lead or add a client manually to get started."}
              actionLabel={hasFilters ? undefined : "Add Client"}
              onAction={hasFilters ? undefined : () => setCreateOpen(true)}
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-lg border bg-white md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Client</th>
                      <th className="px-4 py-2.5 font-medium">Type</th>
                      <th className="px-4 py-2.5 font-medium">Contact</th>
                      <th className="px-4 py-2.5 font-medium">Industry</th>
                      <th className="px-4 py-2.5 font-medium">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clients.map((client) => (
                      <tr
                        key={client.id}
                        onClick={() => navigate(`/admin/crm/clients/${client.id}`)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") navigate(`/admin/crm/clients/${client.id}`)
                        }}
                        tabIndex={0}
                        className="cursor-pointer border-b last:border-0 hover:bg-muted/50 focus:outline-none focus-visible:bg-muted/50"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-brand-dark">{client.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {client.code}
                            {client.company ? ` · ${client.company}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{client.type}</td>
                        <td className="px-4 py-3 text-muted-foreground">{client.email || client.phone || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{client.industry || "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{crmRelativeTime(client.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2 md:hidden">
                {data.clients.map((client) => (
                  <button key={client.id} onClick={() => navigate(`/admin/crm/clients/${client.id}`)} className="block w-full rounded-lg border bg-white px-3.5 py-3 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-brand-dark">{client.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {client.code}
                          {client.company ? ` · ${client.company}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{client.type}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{client.email || client.phone || "No contact recorded"}</p>
                  </button>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm disabled:opacity-40">
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm disabled:opacity-40">
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      <ClientFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          setCreateOpen(false)
          setRefresh((r) => r + 1)
        }}
      />
    </div>
  )
}
