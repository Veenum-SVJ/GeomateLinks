// All Equipment — search, filters (category/status/condition/location/
// project/staff/maintenance/calibration/purchase year), sorting, pagination.
// Variants via props: all / archived (retired + archived pool).
import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Plus, Search, Wrench, X } from "lucide-react"
import {
  fetchEquipment, fetchEquipmentCategories,
} from "@/lib/equipmentApi"
import { EQUIPMENT_STATUSES, EQUIPMENT_CONDITIONS } from "@/types/equipment"
import type { Equipment, EquipmentCategory, EquipmentListResult } from "@/types/equipment"
import { CrmSpinner, CrmErrorState, CrmEmptyState } from "@/components/admin/crm/CrmUI"
import {
  EquipmentStatusBadge, EquipmentConditionBadge, DueChip, outlineButtonClass,
} from "@/components/admin/equipment/EquipmentUI"
import { cn } from "@/lib/utils"

export default function EquipmentList({ variant }: { variant: "all" | "archived" }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [result, setResult] = useState<EquipmentListResult | null>(null)
  const [categories, setCategories] = useState<EquipmentCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const page = Number(searchParams.get("page")) || 1
  const query = searchParams.get("query") || ""
  const status = searchParams.get("status") || ""
  const categoryId = searchParams.get("categoryId") || ""
  const condition = searchParams.get("condition") || ""
  const maintenance = searchParams.get("maintenance") || ""
  const calibration = searchParams.get("calibration") || ""

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== "page") next.delete("page")
    setSearchParams(next)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setResult(await fetchEquipment({
        query: query || undefined,
        status: status || undefined,
        categoryId: categoryId || undefined,
        condition: condition || undefined,
        maintenance: maintenance || undefined,
        calibration: calibration || undefined,
        archived: variant === "archived" ? "true" : undefined,
        page,
        pageSize: 25,
        sort: searchParams.get("sort") || "newest",
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load equipment")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, categoryId, condition, maintenance, calibration, page, variant, searchParams.get("sort")])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetchEquipmentCategories().then((r) => setCategories(r.categories)).catch(() => {})
  }, [])

  const locations = Array.from(new Set((result?.equipment || []).map((e) => e.location).filter(Boolean))).sort()

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-dark">
            {variant === "archived" ? "Archived & Retired Equipment" : "All Equipment"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {result ? `${result.total} item${result.total === 1 ? "" : "s"}` : "Loading…"}
            {variant === "archived" && " — history is preserved; archived items can be restored"}
          </p>
        </div>
        {variant === "all" && (
          <button onClick={() => navigate("/admin/equipment/new")} className={cn("bg-brand-brown text-white", outlineButtonClass())}>
            <Plus className="h-4 w-4" /> Register Equipment
          </button>
        )}
      </div>

      {/* Search + filters */}
      <div className="space-y-2 rounded-lg border bg-white p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setParam("query", e.target.value)}
            placeholder="Search name, asset number, serial, manufacturer, model, project, staff…"
            className="w-full rounded-md border border-input bg-white py-2 pl-9 pr-8 text-sm outline-none focus:border-brand-brown"
          />
          {query && (
            <button type="button" onClick={() => setParam("query", "")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="rounded-md border border-input bg-white px-2 py-1.5 text-xs" value={categoryId} onChange={(e) => setParam("categoryId", e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="rounded-md border border-input bg-white px-2 py-1.5 text-xs" value={status} onChange={(e) => setParam("status", e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {EQUIPMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="rounded-md border border-input bg-white px-2 py-1.5 text-xs" value={condition} onChange={(e) => setParam("condition", e.target.value)} aria-label="Condition">
            <option value="">All conditions</option>
            {EQUIPMENT_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="rounded-md border border-input bg-white px-2 py-1.5 text-xs" value={maintenance} onChange={(e) => setParam("maintenance", e.target.value)} aria-label="Maintenance status">
            <option value="">Maintenance: any</option>
            <option value="due">Maintenance due</option>
            <option value="overdue">Maintenance overdue</option>
          </select>
          <select className="rounded-md border border-input bg-white px-2 py-1.5 text-xs" value={calibration} onChange={(e) => setParam("calibration", e.target.value)} aria-label="Calibration status">
            <option value="">Calibration: any</option>
            <option value="due">Calibration due</option>
            <option value="expired">Calibration expired</option>
          </select>
          <select className="rounded-md border border-input bg-white px-2 py-1.5 text-xs" value={searchParams.get("sort") || "newest"} onChange={(e) => setParam("sort", e.target.value)} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="asset">Asset number</option>
            <option value="name">Name</option>
            <option value="condition">Condition</option>
          </select>
          {(query || status || categoryId || condition || maintenance || calibration) && (
            <button type="button" onClick={() => setSearchParams(new URLSearchParams())} className="rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted">
              Clear filters
            </button>
          )}
        </div>
        {locations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {locations.map((loc) => (
              <span key={loc} className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{loc}</span>
            ))}
          </div>
        )}
      </div>

      {error && <CrmErrorState message={error} onRetry={load} />}
      {loading && !result && <CrmSpinner />}

      {result && result.equipment.length === 0 && !loading && (
        <CrmEmptyState
          icon={<Wrench className="h-8 w-8" />}
          title={variant === "archived" ? "Nothing archived" : "No equipment matches"}
          description={variant === "archived"
            ? "Retired and archived equipment appears here — history is never deleted."
            : "Try clearing the filters, or register a new equipment item."}
          actionLabel={variant === "all" ? "Register Equipment" : undefined}
          onAction={variant === "all" ? () => navigate("/admin/equipment/new") : undefined}
        />
      )}

      {result && result.equipment.length > 0 && (
        <div className="space-y-2">
          {result.equipment.map((item: Equipment) => (
            <Link
              key={item.id}
              to={`/admin/equipment/${item.id}`}
              className="block rounded-lg border bg-white px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-brand-brown">{item.assetNumber}</span>
                    <span className="truncate text-sm font-medium text-brand-dark">{item.name}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[item.category.name, item.manufacturer, item.model, item.location || "no location", item.assignedProject.title || item.assignedStaff.name].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DueChip label="Maint" schedule={item.maintenanceSchedule} state={item.computed.maintenanceState} days={item.computed.maintenanceDays} />
                  <DueChip label="Cal" schedule={item.calibrationSchedule} state={item.computed.calibrationState} days={item.computed.calibrationDays} />
                  <EquipmentConditionBadge condition={item.condition} />
                  <EquipmentStatusBadge status={item.status} />
                </div>
              </div>
            </Link>
          ))}

          {/* Pagination */}
          {result.total > result.pageSize && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setParam("page", String(page - 1))}
                className={outlineButtonClass()}
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {result.page} of {Math.ceil(result.total / result.pageSize)}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(result.total / result.pageSize)}
                onClick={() => setParam("page", String(page + 1))}
                className={outlineButtonClass()}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
