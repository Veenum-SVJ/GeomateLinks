// Equipment dashboard: status cards, recently added/assigned/returned,
// maintenance due, calibration due, equipment requiring attention.
import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Plus, Wrench, AlertTriangle, CalendarClock, Gauge } from "lucide-react"
import { fetchEquipmentDashboard } from "@/lib/equipmentApi"
import { CrmSpinner, CrmErrorState, CrmEmptyState, crmDayOnly } from "@/components/admin/crm/CrmUI"
import { EquipmentStatusBadge, EquipmentConditionBadge, DueChip, EquipmentMiniRow } from "@/components/admin/equipment/EquipmentUI"
import type { EquipmentDashboardResult } from "@/types/equipment"

export default function EquipmentOverview() {
  const navigate = useNavigate()
  const [data, setData] = useState<EquipmentDashboardResult | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setError("")
    try {
      setData(await fetchEquipmentDashboard())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load equipment")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const isEmpty = data && data.cards.total === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-dark">Equipment</h1>
          <p className="text-sm text-muted-foreground">The practice's instruments, drones and field kit — where it is, who has it, what it needs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/equipment/reports" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            <Gauge className="h-4 w-4" /> Reports
          </Link>
          <button
            onClick={() => navigate("/admin/equipment/new")}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90"
          >
            <Plus className="h-4 w-4" /> Register Equipment
          </button>
        </div>
      </div>

      {error && <CrmErrorState message={error} onRetry={load} />}
      {loading && !data && !error && <CrmSpinner />}

      {isEmpty && (
        <CrmEmptyState
          icon={<Wrench className="h-8 w-8" />}
          title="No equipment registered"
          description="Add your first equipment item — GNSS receivers, total stations, drones, controllers and every other asset the practice owns."
          actionLabel="Register Equipment"
          onAction={() => navigate("/admin/equipment/new")}
        />
      )}

      {data && !isEmpty && (
        <>
          {/* Status cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {(
              [
                ["Total", data.cards.total, "/admin/equipment/all", "text-brand-dark"],
                ["Available", data.cards.available, "/admin/equipment/all?status=Available", "text-emerald-600"],
                ["Assigned", data.cards.assigned, "/admin/equipment/all?status=Assigned", "text-blue-600"],
                ["Reserved", data.cards.reserved, "/admin/equipment/all?status=Reserved", "text-violet-600"],
                ["Maintenance", data.cards.underMaintenance, "/admin/equipment/all?status=Under%20Maintenance", "text-amber-600"],
                ["Cal. due", data.cards.calibrationDue, "/admin/equipment/all?calibration=due", "text-cyan-600"],
                ["Inspect due", data.cards.inspectionDue, "/admin/equipment/all?condition=Needs%20Repair", "text-orange-600"],
                ["Damaged", data.cards.damaged, "/admin/equipment/all?status=Damaged", "text-red-600"],
                ["Lost", data.cards.lost, "/admin/equipment/all?status=Lost", "text-red-700"],
                ["Retired", data.cards.retired, "/admin/equipment/archived", "text-stone-500"],
                ["Archived", data.cards.archived, "/admin/equipment/archived", "text-stone-500"],
              ] as const
            ).map(([label, value, href, tone]) => (
              <Link key={label} to={href} className="rounded-lg border bg-white px-4 py-3.5 transition-colors hover:bg-muted/40">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
                <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
              </Link>
            ))}
          </div>

          {/* Lists */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border bg-white">
              <header className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-dark"><Plus className="h-4 w-4" /> Recently Added</h2>
                <Link to="/admin/equipment/all" className="text-xs text-brand-brown hover:underline">All equipment</Link>
              </header>
              <div className="space-y-2 p-3">
                {data.recentlyAdded.length === 0 && <p className="px-1 py-2 text-sm text-muted-foreground">Nothing registered yet.</p>}
                {data.recentlyAdded.map((item) => (
                  <EquipmentMiniRow key={item.id} equipment={item} onClick={() => navigate(`/admin/equipment/${item.id}`)}
                    right={<EquipmentStatusBadge status={item.status} />} />
                ))}
              </div>
            </section>

            <section className="rounded-lg border bg-white">
              <header className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-dark"><CalendarClock className="h-4 w-4" /> Maintenance Due</h2>
                <Link to="/admin/equipment/maintenance" className="text-xs text-brand-brown hover:underline">Maintenance</Link>
              </header>
              <div className="space-y-2 p-3">
                {data.maintenanceDue.length === 0 && <p className="px-1 py-2 text-sm text-muted-foreground">Nothing due — schedules are healthy.</p>}
                {data.maintenanceDue.map((item) => (
                  <EquipmentMiniRow key={item.id} equipment={item} onClick={() => navigate(`/admin/equipment/${item.id}`)}
                    right={<DueChip label="due" schedule={item.maintenanceSchedule} state={item.computed.maintenanceState} days={item.computed.maintenanceDays} />} />
                ))}
              </div>
            </section>

            <section className="rounded-lg border bg-white">
              <header className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-dark"><Gauge className="h-4 w-4" /> Calibration Due</h2>
                <Link to="/admin/equipment/calibration" className="text-xs text-brand-brown hover:underline">Calibration</Link>
              </header>
              <div className="space-y-2 p-3">
                {data.calibrationDue.length === 0 && <p className="px-1 py-2 text-sm text-muted-foreground">All certificates current.</p>}
                {data.calibrationDue.map((item) => (
                  <EquipmentMiniRow key={item.id} equipment={item} onClick={() => navigate(`/admin/equipment/${item.id}`)}
                    right={<DueChip label="due" schedule={item.calibrationSchedule} state={item.computed.calibrationState} days={item.computed.calibrationDays} />} />
                ))}
              </div>
            </section>

            <section className="rounded-lg border bg-white">
              <header className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-dark"><AlertTriangle className="h-4 w-4" /> Requiring Attention</h2>
              </header>
              <div className="space-y-2 p-3">
                {data.attention.length === 0 && <p className="px-1 py-2 text-sm text-muted-foreground">Nothing needs attention.</p>}
                {data.attention.map((item) => (
                  <EquipmentMiniRow key={item.id} equipment={item} onClick={() => navigate(`/admin/equipment/${item.id}`)}
                    right={
                      <span className="flex items-center gap-2">
                        <EquipmentConditionBadge condition={item.condition} />
                        <EquipmentStatusBadge status={item.status} />
                      </span>
                    } />
                ))}
              </div>
            </section>

            <section className="rounded-lg border bg-white">
              <header className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-brand-dark">Recent Assignments</h2>
                <Link to="/admin/equipment/assignments" className="text-xs text-brand-brown hover:underline">All assignments</Link>
              </header>
              <div className="space-y-2 p-3">
                {data.recentAssignments.length === 0 && <p className="px-1 py-2 text-sm text-muted-foreground">No active assignments.</p>}
                {data.recentAssignments.map((a) => (
                  <button key={a.id} type="button" onClick={() => navigate(`/admin/equipment/${a.equipmentId}`)}
                    className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-brand-dark">{a.equipmentName}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">{a.assetNumber} · {a.project.title || a.staff.name || "unlinked"}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">out {crmDayOnly(a.startDate)}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border bg-white">
              <header className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-brand-dark">Recently Returned</h2>
              </header>
              <div className="space-y-2 p-3">
                {data.recentReturns.length === 0 && <p className="px-1 py-2 text-sm text-muted-foreground">No returns recorded yet.</p>}
                {data.recentReturns.map((a) => (
                  <button key={a.id} type="button" onClick={() => navigate(`/admin/equipment/${a.equipmentId}`)}
                    className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-brand-dark">{a.equipmentName}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">{a.assetNumber} · {a.conditionOnReturn || "condition not set"}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{crmDayOnly(a.returnDate)}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
