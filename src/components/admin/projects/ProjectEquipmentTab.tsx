// Project ↔ Equipment integration — the Equipment tab on the project detail
// page. Assignments and reservations REFERENCE the project (snapshots on the
// assignment record); the project never copies equipment data, so deleting
// or editing equipment never corrupts project history.
import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router-dom"
import { Loader2, Plus, Undo2, Wrench } from "lucide-react"
import {
  fetchAssignments, fetchReservations, fetchEquipmentLookup,
  assignEquipmentItem, returnEquipmentItem, cancelEquipmentReservation,
} from "@/lib/equipmentApi"
import { fetchStaff } from "@/lib/projectsApi"
import { EQUIPMENT_CONDITIONS } from "@/types/equipment"
import type { EquipmentAssignment, EquipmentReservation, LookupItem } from "@/types/equipment"
import type { Project } from "@/types/projects"
import { CrmSpinner, CrmErrorState, CrmEmptyState, crmDayOnly } from "@/components/admin/crm/CrmUI"
import { EquipmentStatusBadge, EquipmentConditionBadge, outlineButtonClass, primaryButtonClass } from "@/components/admin/equipment/EquipmentUI"
import { cn } from "@/lib/utils"

const today = () => new Date().toISOString().slice(0, 10)

export default function ProjectEquipmentTab({ project, onError }: { project: Project; onError: (m: string) => void }) {
  const [assignments, setAssignments] = useState<EquipmentAssignment[]>([])
  const [reservations, setReservations] = useState<EquipmentReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [assignOpen, setAssignOpen] = useState(false)
  const [returning, setReturning] = useState<EquipmentAssignment | null>(null)
  const [busyId, setBusyId] = useState("")

  const load = useCallback(async () => {
    setError("")
    try {
      const [a, r] = await Promise.all([
        fetchAssignments({ projectId: project.id }),
        fetchReservations({ projectId: project.id }),
      ])
      setAssignments(a.assignments)
      setReservations(r.reservations)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load equipment")
    } finally {
      setLoading(false)
    }
  }, [project.id])

  useEffect(() => { load() }, [load])

  const activeAssignments = assignments.filter((a) => a.status === "Assigned")
  const pastAssignments = assignments.filter((a) => a.status !== "Assigned")

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Equipment used on this project — managed in the Equipment module; records are shared, never duplicated.
        </p>
        <button type="button" onClick={() => setAssignOpen(true)} className={primaryButtonClass()}>
          <Plus className="h-4 w-4" /> Assign equipment
        </button>
      </div>

      {error && <CrmErrorState message={error} onRetry={load} />}
      {loading && <CrmSpinner />}

      {!loading && (
        <>
          <section className="rounded-lg border bg-white">
            <header className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold text-brand-dark">Currently out ({activeAssignments.length})</h2>
            </header>
            <div className="divide-y">
              {activeAssignments.length === 0 && (
                <div className="p-4">
                  <CrmEmptyState
                    icon={<Wrench className="h-7 w-7" />}
                    title="No equipment assigned to this project"
                    description="Assign receivers, total stations, drones and field kit — equipment status and history update automatically."
                    actionLabel="Assign equipment"
                    onAction={() => setAssignOpen(true)}
                  />
                </div>
              )}
              {activeAssignments.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <Link to={`/admin/equipment/${a.equipmentId}`} className="truncate text-sm font-medium text-brand-dark hover:underline">
                      {a.equipmentName} <span className="font-mono text-xs text-brand-brown">{a.assetNumber}</span>
                    </Link>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      out {crmDayOnly(a.startDate)}{a.expectedReturnDate ? ` · expected back ${crmDayOnly(a.expectedReturnDate)}` : " · open-ended"}{a.staff.name ? ` · ${a.staff.name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={outlineButtonClass()}
                      disabled={busyId === a.id}
                      onClick={async () => { setReturning(a) }}
                    >
                      <Undo2 className="h-4 w-4" /> Return
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {reservations.length > 0 && (
            <section className="rounded-lg border bg-white">
              <header className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-brand-dark">Reservations for this project ({reservations.filter((r) => r.status === "Reserved").length})</h2>
              </header>
              <div className="divide-y">
                {reservations.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <Link to={`/admin/equipment/${r.equipmentId}`} className="truncate text-sm font-medium text-brand-dark hover:underline">
                        {r.equipmentName} <span className="font-mono text-xs text-brand-brown">{r.assetNumber}</span>
                      </Link>
                      <p className="font-mono text-[11px] text-muted-foreground">{r.usageStart || "?"} → {r.usageEnd || "open"}</p>
                    </div>
                    {r.status === "Reserved" ? (
                      <button
                        type="button"
                        className={cn(outlineButtonClass(), "text-muted-foreground")}
                        disabled={busyId === r.id}
                        onClick={async () => {
                          setBusyId(r.id)
                          try {
                            await cancelEquipmentReservation(r.equipmentId, r.id)
                            await load()
                          } catch (err) {
                            onError(err instanceof Error ? err.message : "Cancel failed")
                          } finally {
                            setBusyId("")
                          }
                        }}
                      >
                        {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel reservation"}
                      </button>
                    ) : (
                      <EquipmentStatusBadge status={r.status === "Fulfilled" ? "Assigned" : "Archived"} />
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {pastAssignments.length > 0 && (
            <section className="rounded-lg border bg-white">
              <header className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-brand-dark">Returned ({pastAssignments.length})</h2>
              </header>
              <div className="divide-y">
                {pastAssignments.map((a) => (
                  <Link key={a.id} to={`/admin/equipment/${a.equipmentId}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-brand-dark">{a.equipmentName} <span className="font-mono text-xs text-brand-brown">{a.assetNumber}</span></p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {crmDayOnly(a.startDate)} → {crmDayOnly(a.returnDate)}{a.staff.name ? ` · ${a.staff.name}` : ""}
                      </p>
                    </div>
                    {a.conditionOnReturn && <EquipmentConditionBadge condition={a.conditionOnReturn} />}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {assignOpen && (
        <ProjectAssignDialog
          project={project}
          onClose={() => setAssignOpen(false)}
          onDone={async () => { setAssignOpen(false); await load() }}
        />
      )}
      {returning && (
        <ProjectReturnDialog
          assignment={returning}
          onClose={() => setReturning(null)}
          onDone={async () => { setReturning(null); await load() }}
        />
      )}
    </div>
  )
}

// ------------------------------------------------------------- assign dialog

function ProjectAssignDialog({
  project, onClose, onDone,
}: {
  project: Project
  onClose: () => void
  onDone: () => void
}) {
  const [options, setOptions] = useState<LookupItem[]>([])
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([])
  const [equipmentId, setEquipmentId] = useState("")
  const [staffId, setStaffId] = useState("")
  const [startDate, setStartDate] = useState(today())
  const [expectedReturnDate, setExpectedReturnDate] = useState("")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchEquipmentLookup({ availableOnly: true })
      .then((r) => setOptions(r.equipment))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load equipment"))
    fetchStaff().then((r) => setStaff(r.staff.map((s) => ({ id: s.id, name: s.name })))).catch(() => {})
  }, [])

  const submit = async () => {
    if (!equipmentId) { setError("Pick an equipment item"); return }
    setBusy(true); setError("")
    try {
      const person = staff.find((s) => s.id === staffId)
      await assignEquipmentItem(equipmentId, {
        projectId: project.id,
        projectNumber: project.number,
        projectTitle: project.title,
        staffId: person?.id,
        staffName: person?.name,
        startDate,
        expectedReturnDate: expectedReturnDate || undefined,
        notes: notes || undefined,
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assignment failed")
      setBusy(false)
    }
  }

  return (
    <DialogShell title="Assign equipment to this project" subtitle={`${project.number} — ${project.title}`} onClose={onClose}>
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-brand-dark">Equipment (available now)</span>
          <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm">
            <option value="">— pick equipment —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.assetNumber} · {o.name} ({o.status}, {o.condition}{o.location ? `, ${o.location}` : ""})
              </option>
            ))}
          </select>
        </label>
        {options.length === 0 && !error && (
          <p className="text-xs text-amber-700">Nothing is freely available right now — check the Equipment module for items under maintenance or calibration.</p>
        )}
        <label className="block space-y-1">
          <span className="text-xs font-medium text-brand-dark">Assigned staff (optional)</span>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm">
            <option value="">— none —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-brand-dark">From</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-brand-dark">Expected return</span>
            <input type="date" value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm" />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-brand-dark">Notes (optional)</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm" />
        </label>
        {error && <CrmErrorState message={error} />}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={outlineButtonClass()} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={primaryButtonClass()} onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Assign
          </button>
        </div>
      </div>
    </DialogShell>
  )
}

// ------------------------------------------------------------- return dialog

function ProjectReturnDialog({
  assignment, onClose, onDone,
}: {
  assignment: EquipmentAssignment
  onClose: () => void
  onDone: () => void
}) {
  const [returnDate, setReturnDate] = useState(today())
  const [conditionOnReturn, setConditionOnReturn] = useState<string>("Good")
  const [damageReport, setDamageReport] = useState("")
  const [requiresMaintenance, setRequiresMaintenance] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const submit = async () => {
    setBusy(true); setError("")
    try {
      await returnEquipmentItem(assignment.equipmentId, {
        assignmentId: assignment.id,
        returnDate,
        conditionOnReturn,
        damageReport: damageReport || undefined,
        requiresMaintenance,
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Return failed")
      setBusy(false)
    }
  }

  return (
    <DialogShell title="Return equipment" subtitle={`${assignment.equipmentName} · ${assignment.assetNumber}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-brand-dark">Return date</span>
            <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-brand-dark">Condition on return</span>
            <select value={conditionOnReturn} onChange={(e) => setConditionOnReturn(e.target.value)} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm">
              {EQUIPMENT_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-brand-dark">Damage report (optional)</span>
          <textarea rows={2} value={damageReport} onChange={(e) => setDamageReport(e.target.value)} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm text-brand-dark">
          <input type="checkbox" checked={requiresMaintenance} onChange={(e) => setRequiresMaintenance(e.target.checked)} />
          Requires maintenance before next use
        </label>
        {error && <CrmErrorState message={error} />}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={outlineButtonClass()} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={primaryButtonClass()} onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Record return
          </button>
        </div>
      </div>
    </DialogShell>
  )
}

// Local dialog shell (avoids pulling the EMS portal shell into this module's
// import graph — same markup, inline).
function DialogShell({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl border bg-white shadow-xl sm:max-w-lg sm:rounded-xl" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b bg-white px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-brand-dark">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Close">×</button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
