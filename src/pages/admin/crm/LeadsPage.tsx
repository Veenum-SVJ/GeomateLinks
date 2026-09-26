// Leads list — strong search/filter/sort with server-side pagination, so it
// stays fast at hundreds or thousands of records. Desktop table, mobile
// cards; rows open the lead's detail page.
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Plus, Search, ChevronLeft, ChevronRight, Users } from "lucide-react"
import { LEAD_STATUSES, LEAD_SOURCES, LEAD_PRIORITIES } from "@/types/crm"
import type { LeadListResult, CrmServiceRef } from "@/types/crm"
import { fetchLeads, fetchCrmServices } from "@/lib/crmApi"
import { LeadStatusBadge, PriorityBadge, SourceBadge, CrmSpinner, CrmErrorState, CrmEmptyState, crmRelativeTime, crmDayOnly } from "@/components/admin/crm/CrmUI"
import LeadFormDialog from "@/components/admin/crm/LeadFormDialog"

const selectClass = "h-10 rounded-md border border-input bg-background px-2.5 text-sm sm:text-base"

type Filters = {
  query: string
  status: string
  source: string
  priority: string
  service: string
  assigned: string
  from: string
  to: string
  sort: string
  archived: string
}

const emptyFilters: Filters = { query: "", status: "", source: "", priority: "", service: "", assigned: "", from: "", to: "", sort: "newest", archived: "" }

export default function LeadsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [filters, setFilters] = useState<Filters>(() => ({ ...emptyFilters, status: searchParams.get("status") || "" }))
  const [page, setPage] = useState(1)
  const [data, setData] = useState<LeadListResult | null>(null)
  const [services, setServices] = useState<CrmServiceRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [refresh, setRefresh] = useState(0)

  // Keep the status filter in step with dashboard quick-links (?status=New).
  useEffect(() => {
    const status = searchParams.get("status") || ""
    setFilters((prev) => (prev.status === status ? prev : { ...prev, status }))
    setPage(1)
  }, [searchParams])

  useEffect(() => {
    fetchCrmServices()
      .then((res) => setServices(res.services))
      .catch(() => setServices([]))
  }, [])

  const queryKey = JSON.stringify({ ...filters, page, refresh })
  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setData(await fetchLeads({ ...(JSON.parse(queryKey) as Filters), pageSize: 20 }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load leads")
    } finally {
      setLoading(false)
    }
  }, [queryKey])

  // Debounced reload whenever filters or the page change.
  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  const set = (patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const hasFilters = useMemo(
    () => Boolean(filters.query || filters.status || filters.source || filters.priority || filters.service || filters.assigned || filters.from || filters.to || filters.archived),
    [filters],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">Every enquiry and opportunity, from first contact to conversion.</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90">
          <Plus className="h-4 w-4" />
          Add Lead
        </button>
      </div>

      {/* Search + filters */}
      <div className="space-y-3 rounded-lg border bg-white p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Search name, company, email, phone, lead ID, location…"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm sm:text-base"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Status filter" value={filters.status} onChange={(e) => set({ status: e.target.value })} className={selectClass}>
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select aria-label="Source filter" value={filters.source} onChange={(e) => set({ source: e.target.value })} className={selectClass}>
            <option value="">All sources</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select aria-label="Priority filter" value={filters.priority} onChange={(e) => set({ priority: e.target.value })} className={selectClass}>
            <option value="">Any priority</option>
            {LEAD_PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select aria-label="Service filter" value={filters.service} onChange={(e) => set({ service: e.target.value })} className={selectClass}>
            <option value="">All services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <input aria-label="Assigned person filter" value={filters.assigned} onChange={(e) => set({ assigned: e.target.value })} placeholder="Assigned to…" className={`${selectClass} w-36`} />
          <input aria-label="Created from date" type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className={selectClass} />
          <input aria-label="Created to date" type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className={selectClass} />
          <select aria-label="View" value={filters.archived} onChange={(e) => set({ archived: e.target.value })} className={selectClass}>
            <option value="">Active leads</option>
            <option value="true">Archived leads</option>
          </select>
          <select aria-label="Sort" value={filters.sort} onChange={(e) => set({ sort: e.target.value })} className={`${selectClass} ml-auto`}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="contacted">Recently contacted</option>
            <option value="followup">Follow-up date</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      </div>

      {error && <CrmErrorState message={error} onRetry={load} />}
      {loading && !data && <CrmSpinner />}

      {data && (
        <>
          <p className="text-sm text-muted-foreground">
            {data.total} lead{data.total === 1 ? "" : "s"}
            {hasFilters ? " matching filters" : ""}
            {data.total > data.pageSize && ` · page ${data.page} of ${totalPages}`}
          </p>

          {data.leads.length === 0 ? (
            <CrmEmptyState
              icon={<Users className="h-8 w-8" />}
              title={hasFilters ? "No leads match these filters" : "No leads yet"}
              description={hasFilters ? "Try adjusting or clearing the filters above." : "Website inquiries will appear here automatically. You can also add leads manually."}
              actionLabel={hasFilters ? undefined : "Add Lead"}
              onAction={hasFilters ? undefined : () => setCreateOpen(true)}
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto rounded-lg border bg-white md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Lead</th>
                      <th className="px-4 py-2.5 font-medium">Service</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Priority</th>
                      <th className="px-4 py-2.5 font-medium">Next follow-up</th>
                      <th className="px-4 py-2.5 font-medium">Source</th>
                      <th className="px-4 py-2.5 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leads.map((lead) => (
                      <tr
                        key={lead.id}
                        onClick={() => navigate(`/admin/crm/leads/${lead.id}`)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") navigate(`/admin/crm/leads/${lead.id}`)
                        }}
                        tabIndex={0}
                        className="cursor-pointer border-b last:border-0 hover:bg-muted/50 focus:outline-none focus-visible:bg-muted/50"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-brand-dark">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {lead.code}
                            {lead.company ? ` · ${lead.company}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.service?.title || "—"}</td>
                        <td className="px-4 py-3"><LeadStatusBadge status={lead.status} /></td>
                        <td className="px-4 py-3"><PriorityBadge priority={lead.priority} /></td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.nextFollowUpAt ? crmDayOnly(lead.nextFollowUpAt) : "—"}</td>
                        <td className="px-4 py-3"><SourceBadge source={lead.source} /></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{crmRelativeTime(lead.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {data.leads.map((lead) => (
                  <Link key={lead.id} to={`/admin/crm/leads/${lead.id}`} className="block rounded-lg border bg-white px-3.5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-brand-dark">{lead.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {lead.code}
                          {lead.company ? ` · ${lead.company}` : ""}
                        </p>
                      </div>
                      <LeadStatusBadge status={lead.status} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {[lead.service?.title, lead.location].filter(Boolean).join(" · ") || "No service recorded"}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{lead.source}</span>
                      <span>{lead.nextFollowUpAt ? `Follow-up ${crmDayOnly(lead.nextFollowUpAt)}` : crmRelativeTime(lead.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
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

      <LeadFormDialog
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
