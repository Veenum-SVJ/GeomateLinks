// Projects list: status tabs (All / each status / Archived), search, filters
// (client, service, type, priority, start-date range), sorts and pagination.
// Status can arrive via the URL (/admin/pms/list/:status from the overview
// cards) or the ?status param.
import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { Plus, Search, SlidersHorizontal } from "lucide-react"
import { fetchProjects, fetchStaff } from "@/lib/projectsApi"
import { fetchQuotationServices } from "@/lib/quotationsApi"
import { fetchClients } from "@/lib/crmApi"
import { CrmSpinner, CrmErrorState, CrmEmptyState } from "@/components/admin/crm/CrmUI"
import { ProjectRow, ProjectPagination } from "@/components/admin/projects/ProjectUI"

import { PROJECT_STATUSES, PROJECT_PRIORITIES, PROJECT_TYPES } from "@/types/projects"
import type { Project, ProjectListResult, StaffMember } from "@/types/projects"
import type { Client } from "@/types/crm"
import type { CrmServiceRef } from "@/types/quotations"
import { cn } from "@/lib/utils"

const TABS = ["All", ...PROJECT_STATUSES, "Archived"] as const
type Tab = (typeof TABS)[number]

const PAGE_SIZE = 25

export default function ProjectsList() {
  const navigate = useNavigate()
  const { status: statusParam } = useParams<{ status?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const tab: Tab = (() => {
    if (statusParam === "Archived") return "Archived"
    if (statusParam && (PROJECT_STATUSES as readonly string[]).includes(statusParam)) return statusParam as Tab
    const q = searchParams.get("status")
    if (q && (PROJECT_STATUSES as readonly string[]).includes(q)) return q as Tab
    return "All"
  })()
  const isArchived = tab === "Archived"

  const [queryInput, setQueryInput] = useState(searchParams.get("query") || "")
  const [data, setData] = useState<ProjectListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [services, setServices] = useState<CrmServiceRef[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [showFilters, setShowFilters] = useState(false)

  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const sort = searchParams.get("sort") || "newest"
  const from = searchParams.get("from") || ""
  const to = searchParams.get("to") || ""
  const clientId = searchParams.get("clientId") || ""
  const serviceId = searchParams.get("serviceId") || ""
  const projectType = searchParams.get("projectType") || ""
  const priority = searchParams.get("priority") || ""
  const managerStaffId = searchParams.get("managerStaffId") || ""
  const query = searchParams.get("query") || ""

  useEffect(() => {
    fetchQuotationServices().then((r) => setServices(r.services)).catch(() => {})
    fetchClients({ pageSize: 100 }).then((r) => setClients(r.clients)).catch(() => {})
    fetchStaff().then((r) => setStaff(r.staff)).catch(() => {})
  }, [])

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== "page") next.delete("page")
    setSearchParams(next, { replace: true })
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setData(
        await fetchProjects({
          query,
          status: tab === "All" || tab === "Archived" ? "" : tab,
          archived: isArchived ? "true" : "",
          sort,
          from,
          to,
          clientId,
          serviceId,
          projectType,
          priority,
          managerStaffId,
          page,
          pageSize: PAGE_SIZE,
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load projects")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tab, isArchived, sort, from, to, clientId, serviceId, projectType, priority, managerStaffId, page])

  useEffect(() => {
    load()
  }, [load])

  const switchTab = (next: Tab) => {
    const search = new URLSearchParams(searchParams)
    search.delete("page")
    search.delete("status")
    const qs = search.toString()
    if (next === "All") navigate(`/admin/pms/all${qs ? `?${qs}` : ""}`)
    else navigate(`/admin/pms/list/${encodeURIComponent(next)}${qs ? `?${qs}` : ""}`)
  }

  const emptyForTab = (t: Tab) =>
    t === "Archived"
      ? "The archive is empty. Archived projects stay searchable for record keeping."
      : t === "Cancelled"
        ? "No cancelled projects."          : t === "Completed"
            ? "No completed projects yet — they will appear here when work wraps up."
            : `No ${String(t).toLowerCase()} projects match the current search and filters.`

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-dark">All Projects</h1>
          <p className="text-sm text-muted-foreground">{data ? `${data.total} project${data.total === 1 ? "" : "s"}` : "Loading…"}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/pms" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            Overview
          </Link>
          <Link
            to="/admin/pms/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90"
          >
            <Plus className="h-4 w-4" /> Create Project
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => switchTab(t)}
            className={cn(
              "inline-flex whitespace-nowrap px-4 py-2.5 text-sm font-medium",
              tab === t ? "border-b-2 border-brand-brown text-brand-brown" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="rounded-lg border bg-white p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setParam("query", queryInput)
              }}
              onBlur={() => setParam("query", queryInput)}
              placeholder="Search number, title, client, location, service, manager, team, quotation…"
              className="w-full rounded-md border py-2 pl-8 pr-3 text-sm"
            />
          </div>
          <select value={sort} onChange={(e) => setParam("sort", e.target.value)} className="rounded-md border bg-white px-2.5 py-2 text-sm">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="deadline">Expected completion</option>
            <option value="progress">Progress</option>
            <option value="priority">Priority</option>
            <option value="title">Title (A–Z)</option>
          </select>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted",
              showFilters && "border-brand-brown/40 bg-brand-brown/5 text-brand-brown",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-medium text-muted-foreground">
              Client
              <select value={clientId} onChange={(e) => setParam("clientId", e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                <option value="">Any client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company || c.name} ({c.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Service
              <select value={serviceId} onChange={(e) => setParam("serviceId", e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                <option value="">Any service</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Project type
              <select value={projectType} onChange={(e) => setParam("projectType", e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                <option value="">Any type</option>
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Priority
              <select value={priority} onChange={(e) => setParam("priority", e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                <option value="">Any priority</option>
                {PROJECT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Project manager
              <select value={managerStaffId} onChange={(e) => setParam("managerStaffId", e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                <option value="">Any manager</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Start date from
              <input type="date" value={from} onChange={(e) => setParam("from", e.target.value)} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Start date to
              <input type="date" value={to} onChange={(e) => setParam("to", e.target.value)} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
            </label>
            <div className="sm:col-span-2 lg:col-span-4">
              <button
                onClick={() => {
                  const cleared = new URLSearchParams()
                  if (queryInput) cleared.set("query", queryInput)
                  setSearchParams(cleared, { replace: true })
                }}
                className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Clear filters
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <CrmErrorState message={error} onRetry={load} />}
      {loading && !data && <CrmSpinner />}

      {data && data.projects.length === 0 ? (
        <CrmEmptyState
          icon={<Search className="h-8 w-8" />}
          title={tab === "All" ? "No projects found" : `No ${String(tab).toLowerCase()} projects`}
          description={emptyForTab(tab)}
          actionLabel={tab === "All" ? "Create Project" : undefined}
          onAction={tab === "All" ? () => navigate("/admin/pms/new") : undefined}
        />
      ) : (
        data && (
          <div className="rounded-lg border bg-white">
            <div className="p-4">
              <ProjectRowList projects={data.projects} showArchived={isArchived} />
            </div>
            <ProjectPagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setParam("page", String(p))} />
          </div>
        )
      )}
    </div>
  )
}

function ProjectRowList({ projects, showArchived }: { projects: Project[]; showArchived?: boolean }) {
  return (
    <ul className="space-y-2">
      {projects.map((p) => (
        <ProjectRow key={p.id} project={p} showArchived={showArchived} />
      ))}
    </ul>
  )
}
