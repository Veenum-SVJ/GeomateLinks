// Quotations list: status tabs, search, filters (date, client, service,
// amount, expiration), sorts and pagination. Status can arrive via the URL
// (/admin/quotations/list/:status from overview cards) or the ?status param.
import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { Plus, Search, SlidersHorizontal } from "lucide-react"
import { fetchQuotations, fetchQuotationServices } from "@/lib/quotationsApi"
import { fetchClients } from "@/lib/crmApi"
import { DEFAULT_CURRENCY, filterAmountToMinor } from "@/lib/money"
import { CrmSpinner, CrmErrorState, CrmEmptyState } from "@/components/admin/crm/CrmUI"
import { QuotationList, QuotationPagination } from "@/components/admin/quotations/QuotationUI"
import { QUOTATION_STATUSES } from "@/types/quotations"
import type { QuotationListResult, CrmServiceRef } from "@/types/quotations"
import type { Client } from "@/types/crm"
import { cn } from "@/lib/utils"

const TABS = ["All", ...QUOTATION_STATUSES, "Archived"] as const
type Tab = (typeof TABS)[number]

const PAGE_SIZE = 25

export default function QuotationsList() {
  const navigate = useNavigate()
  const { status: statusParam } = useParams<{ status?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const tab: Tab = (() => {
    if (statusParam === "Archived") return "Archived"
    if (statusParam && (QUOTATION_STATUSES as readonly string[]).includes(statusParam)) return statusParam as Tab
    const q = searchParams.get("status")
    if (q && (QUOTATION_STATUSES as readonly string[]).includes(q)) return q as Tab
    return "All"
  })()
  const isArchived = tab === "Archived"

  const [queryInput, setQueryInput] = useState(searchParams.get("query") || "")
  const [data, setData] = useState<QuotationListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [services, setServices] = useState<CrmServiceRef[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [showFilters, setShowFilters] = useState(false)

  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const sort = searchParams.get("sort") || "newest"
  const from = searchParams.get("from") || ""
  const to = searchParams.get("to") || ""
  const clientId = searchParams.get("clientId") || ""
  const serviceId = searchParams.get("serviceId") || ""
  const amountMin = searchParams.get("amountMin") || ""
  const amountMax = searchParams.get("amountMax") || ""
  const expiredBefore = searchParams.get("expiredBefore") || ""
  const expiredAfter = searchParams.get("expiredAfter") || ""
  const query = searchParams.get("query") || ""

  useEffect(() => {
    fetchQuotationServices().then((r) => setServices(r.services)).catch(() => {})
    fetchClients({ pageSize: 100 }).then((r) => setClients(r.clients)).catch(() => {})
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
        await fetchQuotations({
          query,
          status: tab === "All" || isArchived ? "" : tab,
          archived: isArchived ? "true" : "",
          sort,
          from,
          to,
          clientId,
          serviceId,
          amountMin: filterAmountToMinor(amountMin, DEFAULT_CURRENCY),
          amountMax: filterAmountToMinor(amountMax, DEFAULT_CURRENCY),
          expiredBefore,
          expiredAfter,
          page,
          pageSize: PAGE_SIZE,
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load quotations")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tab, isArchived, sort, from, to, clientId, serviceId, amountMin, amountMax, expiredBefore, expiredAfter, page])

  useEffect(() => {
    load()
  }, [load])

  const switchTab = (next: Tab) => {
    // Preserve active filters across tab switches (minus pagination/status).
    const search = new URLSearchParams(searchParams)
    search.delete("page")
    search.delete("status")
    const qs = search.toString()
    if (next === "All") navigate(`/admin/quotations/all${qs ? `?${qs}` : ""}`)
    else navigate(`/admin/quotations/list/${encodeURIComponent(next)}${qs ? `?${qs}` : ""}`)
  }

  const emptyForTab = (t: Tab) =>
    t === "Draft"
      ? "No drafts right now. Create a quotation to get started."
      : t === "Accepted"
        ? "No accepted quotations yet."
        : t === "Rejected"
          ? "No rejected quotations."
          : t === "Expired"
            ? "Nothing has expired. Quotations past their valid-until date land here automatically."
            : t === "Archived"
              ? "The archive is empty. Archived quotations are kept for record keeping."
              : "No quotations match the current search and filters."

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-dark">All Quotations</h1>
          <p className="text-sm text-muted-foreground">{data ? `${data.total} quotation${data.total === 1 ? "" : "s"}` : "Loading…"}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/quotations" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            Overview
          </Link>
          <Link
            to="/admin/quotations/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90"
          >
            <Plus className="h-4 w-4" /> Create Quotation
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
              placeholder="Search number, client, company, project, location…"
              className="w-full rounded-md border py-2 pl-8 pr-3 text-sm"
            />
          </div>
          <select value={sort} onChange={(e) => setParam("sort", e.target.value)} className="rounded-md border bg-white px-2.5 py-2 text-sm">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest value</option>
            <option value="lowest">Lowest value</option>
            <option value="expiration">Expiration date</option>
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
              Quotation date from
              <input type="date" value={from} onChange={(e) => setParam("from", e.target.value)} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Quotation date to
              <input type="date" value={to} onChange={(e) => setParam("to", e.target.value)} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Amount min (₦)
              <input
                value={amountMin}
                onChange={(e) => setParam("amountMin", e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="e.g. 500000"
                className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Amount max (₦)
              <input
                value={amountMax}
                onChange={(e) => setParam("amountMax", e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="e.g. 5000000"
                className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Expired before
              <input type="date" value={expiredBefore} onChange={(e) => setParam("expiredBefore", e.target.value)} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Expired after
              <input type="date" value={expiredAfter} onChange={(e) => setParam("expiredAfter", e.target.value)} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
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

      {data && data.quotations.length === 0 ? (
        <CrmEmptyState
          icon={<Search className="h-8 w-8" />}
          title={tab === "All" ? "No quotations found" : `No ${tab.toLowerCase()} quotations`}
          description={emptyForTab(tab)}
          actionLabel={tab === "All" ? "Create Quotation" : undefined}
          onAction={tab === "All" ? () => navigate("/admin/quotations/new") : undefined}
        />
      ) : (
        data && (
          <div className="rounded-lg border bg-white">
            <div className="p-4">
              <QuotationList quotations={data.quotations} showArchived />
            </div>
            <QuotationPagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setParam("page", String(p))} />
          </div>
        )
      )}
    </div>
  )
}
