// Module-wide EMS pages — Assignments, Maintenance, Calibration, Inspections,
// Categories and Reports. Each list page links back to the equipment profile;
// Categories manages the configurable list; Reports offers the lightweight
// operational reports with CSV export.
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Plus, Trash2, Download, ClipboardList, Gauge, ClipboardCheck, Settings, Loader2, Wrench,
} from "lucide-react"
import {
  fetchAssignments, fetchReservations, fetchMaintenanceRecords,
  fetchCalibrationRecords, fetchInspectionRecords, fetchEquipmentCategories,
  createEquipmentCategory, updateEquipmentCategory, deleteEquipmentCategory,
  fetchReport, reportCsvUrl,
} from "@/lib/equipmentApi"
import { crmDayOnly, CrmSpinner, CrmErrorState, CrmEmptyState, CrmConfirmDialog } from "@/components/admin/crm/CrmUI"
import {
  EquipmentStatusBadge, Field, inputClass, DialogActions,
  primaryButtonClass, outlineButtonClass, EquipmentDialogShell,
} from "@/components/admin/equipment/EquipmentUI"
import { cn } from "@/lib/utils"

function useList<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    setError("")
    try { setData(await fetcher()) } catch (err) { setError(err instanceof Error ? err.message : "Could not load") } finally { setLoading(false) }
  }, deps)
  useEffect(() => { load() }, [load])
  return { data, error, loading, reload: load }
}

function PageHeader({ title, description, icon }: { title: string; description: string; icon?: React.ReactNode }) {
  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-brand-dark">{icon}{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

// -------------------------------------------------------------- assignments

export function AssignmentsPage() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useList(() => Promise.all([
    fetchAssignments({ status: "Assigned" }),
    fetchReservations({ status: "Reserved" }),
  ]))

  if (loading && !data) return <CrmSpinner />
  return (
    <div className="space-y-4">
      <PageHeader title="Assignments" description="Who has what right now — and what is reserved for upcoming projects." icon={<ClipboardList className="h-5 w-5" />} />
      {error && <CrmErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          <section className="rounded-lg border bg-white">
            <header className="border-b px-4 py-3"><h2 className="text-sm font-semibold text-brand-dark">Currently assigned ({data[0].assignments.length})</h2></header>
            <div className="divide-y">
              {data[0].assignments.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">Nothing is out in the field.</p>}
              {data[0].assignments.map((a) => (
                <button key={a.id} type="button" onClick={() => navigate(`/admin/equipment/${a.equipmentId}`)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-dark">{a.equipmentName} <span className="font-mono text-xs text-brand-brown">{a.assetNumber}</span></p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {a.project.title || a.staff.name || "unlinked"} · out {crmDayOnly(a.startDate)}{a.expectedReturnDate ? ` · expected ${crmDayOnly(a.expectedReturnDate)}` : " · open-ended"}
                    </p>
                  </div>
                  {a.staff.name && <span className="text-xs text-muted-foreground">{a.staff.name}</span>}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-white">
            <header className="border-b px-4 py-3"><h2 className="text-sm font-semibold text-brand-dark">Active reservations ({data[1].reservations.length})</h2></header>
            <div className="divide-y">
              {data[1].reservations.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No upcoming reservations.</p>}
              {data[1].reservations.map((r) => (
                <button key={r.id} type="button" onClick={() => navigate(`/admin/equipment/${r.equipmentId}`)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-dark">{r.equipmentName} <span className="font-mono text-xs text-brand-brown">{r.assetNumber}</span></p>
                    <p className="font-mono text-[11px] text-muted-foreground">{r.project.title || "unlinked"} · {r.usageStart || "?"} → {r.usageEnd || "open"}</p>
                  </div>
                  <EquipmentStatusBadge status="Reserved" />
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

// -------------------------------------------------------------- maintenance

export function MaintenancePage() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useList(() => fetchMaintenanceRecords())

  return (
    <div className="space-y-4">
      <PageHeader title="Maintenance" description="Every service and repair record, newest first." icon={<Wrench className="h-5 w-5" />} />
      {error && <CrmErrorState message={error} onRetry={reload} />}
      {loading && !data && <CrmSpinner />}
      {data && (data.maintenance.length === 0
        ? <CrmEmptyState icon={<Wrench className="h-8 w-8" />} title="No maintenance records" description="Record service and repair work from any equipment profile." />
        : (
          <section className="rounded-lg border bg-white">
            <div className="divide-y">
              {data.maintenance.map((m) => (
                <button key={m.id} type="button" onClick={() => navigate(`/admin/equipment/${m.equipmentId}`)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-dark">{m.equipmentName} <span className="font-mono text-xs text-brand-brown">{m.assetNumber}</span></p>
                    <p className="truncate text-xs text-muted-foreground">{m.type}: {m.description}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {crmDayOnly(m.date)}{m.serviceProvider ? ` · ${m.serviceProvider}` : ""}{m.nextMaintenanceDate ? ` · next ${crmDayOnly(m.nextMaintenanceDate)}` : ""}
                    </p>
                  </div>
                  <EquipmentStatusBadge status={m.status} />
                </button>
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}

// -------------------------------------------------------------- calibration

export function CalibrationPage() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useList(() => fetchCalibrationRecords())

  return (
    <div className="space-y-4">
      <PageHeader title="Calibration" description="Certificates and results for every calibrated instrument." icon={<Gauge className="h-5 w-5" />} />
      {error && <CrmErrorState message={error} onRetry={reload} />}
      {loading && !data && <CrmSpinner />}
      {data && (data.calibrations.length === 0
        ? <CrmEmptyState icon={<Gauge className="h-8 w-8" />} title="No calibration records" description="Record calibrations from any equipment profile — certificates attach through Documents." />
        : (
          <section className="rounded-lg border bg-white">
            <div className="divide-y">
              {data.calibrations.map((c) => (
                <button key={c.id} type="button" onClick={() => navigate(`/admin/equipment/${c.equipmentId}`)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-dark">{c.equipmentName} <span className="font-mono text-xs text-brand-brown">{c.assetNumber}</span></p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {crmDayOnly(c.date)}{c.provider ? ` · ${c.provider}` : ""}{c.certificateNumber ? ` · cert ${c.certificateNumber}` : ""}{c.nextCalibrationDate ? ` · next ${crmDayOnly(c.nextCalibrationDate)}` : ""}
                    </p>
                  </div>
                  <span className={cn("font-mono text-[11px]", c.result === "Failed" ? "text-red-600" : "text-emerald-600")}>{c.result}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}

// -------------------------------------------------------------- inspections

export function InspectionsPage() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useList(() => fetchInspectionRecords())

  return (
    <div className="space-y-4">
      <PageHeader title="Inspections" description="Pre-field, post-field and periodic checks." icon={<ClipboardCheck className="h-5 w-5" />} />
      {error && <CrmErrorState message={error} onRetry={reload} />}
      {loading && !data && <CrmSpinner />}
      {data && (data.inspections.length === 0
        ? <CrmEmptyState icon={<ClipboardCheck className="h-8 w-8" />} title="No inspections recorded" description="Run a pre-field check from any equipment profile before it leaves the office." />
        : (
          <section className="rounded-lg border bg-white">
            <div className="divide-y">
              {data.inspections.map((i) => (
                <button key={i.id} type="button" onClick={() => navigate(`/admin/equipment/${i.equipmentId}`)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-dark">{i.equipmentName} <span className="font-mono text-xs text-brand-brown">{i.assetNumber}</span></p>
                    <p className="font-mono text-[11px] text-muted-foreground">{crmDayOnly(i.date)} · {i.type} · {i.inspector}</p>
                    {i.findings && <p className="truncate text-xs text-muted-foreground">{i.findings}</p>}
                  </div>
                  <span className={cn("font-mono text-[11px]", i.result === "Passed" ? "text-emerald-600" : "text-red-600")}>{i.result}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}

// -------------------------------------------------------------- categories

type CategoryDraft = { id?: string; name: string; code: string; description: string }

export function EquipmentCategoriesPage() {
  const { data, error, loading, reload } = useList(() => fetchEquipmentCategories())
  const [draft, setDraft] = useState<CategoryDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const save = async () => {
    if (!draft) return
    if (!draft.name.trim()) { setFormError("Name is required"); return }
    setBusy(true); setFormError("")
    try {
      if (draft.id) await updateEquipmentCategory(draft.id, { name: draft.name.trim(), description: draft.description })
      else await createEquipmentCategory({ name: draft.name.trim(), code: draft.code || undefined, description: draft.description || undefined })
      setDraft(null)
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the category")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Equipment Categories" description="Codes drive asset numbers (GML-<code>-NNN). System categories cannot be renamed or deleted." icon={<Settings className="h-5 w-5" />} />
      {error && <CrmErrorState message={error} onRetry={reload} />}
      {loading && !data && <CrmSpinner />}
      {data && (
        <>
          <div className="flex justify-end">
            <button type="button" className={primaryButtonClass()} onClick={() => { setFormError(""); setDraft({ name: "", code: "", description: "" }) }}>
              <Plus className="h-4 w-4" /> Add category
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brand-dark">{c.name} {c.system && <span className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">system</span>}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{c.code}{c.description ? ` · ${c.description}` : ""}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="rounded p-1.5 text-muted-foreground hover:bg-muted" aria-label="Edit category"
                    onClick={() => { setFormError(""); setDraft({ id: c.id, name: c.name, code: c.code, description: c.description }) }}>
                    <Settings className="h-4 w-4" />
                  </button>
                  {!c.system && (
                    <button type="button" className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" aria-label="Delete category"
                      onClick={() => setConfirmDelete(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {draft && (
        <EquipmentDialogShell
          title={draft.id ? "Edit Category" : "Add Category"}
          subtitle={draft.id ? "Codes cannot change — they drive existing asset numbers" : "The code prefixes new asset numbers"}
          onClose={() => setDraft(null)}
        >
          <div className="space-y-3">
            <Field label="Name">
              <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Survey Controllers" />
            </Field>
            {!draft.id && (
              <Field label="Code (2–8 letters)" hint="Used in asset numbers and the counter — e.g. SC → GML-SC-001">
                <input className={inputClass} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="SC" />
              </Field>
            )}
            <Field label="Description (optional)">
              <input className={inputClass} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            {formError && <CrmErrorState message={formError} />}
            <DialogActions>
              <button type="button" className={outlineButtonClass()} onClick={() => setDraft(null)} disabled={busy}>Cancel</button>
              <button type="button" className={primaryButtonClass()} onClick={save} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </button>
            </DialogActions>
          </div>
        </EquipmentDialogShell>
      )}

      <CrmConfirmDialog
        open={confirmDelete !== null}
        title="Delete category"
        description="Only custom categories without registered equipment can be deleted."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!confirmDelete) return
          try {
            await deleteEquipmentCategory(confirmDelete)
            setConfirmDelete(null)
            await reload()
          } catch (err) {
            setConfirmDelete(null)
            setFormError(err instanceof Error ? err.message : "Delete failed")
            window.alert(err instanceof Error ? err.message : "Delete failed")
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
      {formError && !draft && <CrmErrorState message={formError} />}
    </div>
  )
}

// -------------------------------------------------------------- reports

const REPORTS: { type: string; label: string; description: string }[] = [
  { type: "inventory", label: "Equipment Inventory", description: "Every active item with status, condition, location and assignments." },
  { type: "assigned", label: "Currently Assigned", description: "Equipment out on projects or with staff right now." },
  { type: "maintenance", label: "Under Maintenance", description: "Items currently in service or repair." },
  { type: "maintenance-due", label: "Maintenance Due", description: "Scheduled maintenance that is due or overdue." },
  { type: "calibration-due", label: "Calibration Due", description: "Certificates due or expired." },
  { type: "damaged", label: "Damaged Equipment", description: "Damaged status or failing condition." },
  { type: "by-category", label: "By Category", description: "Item counts per category." },
  { type: "by-location", label: "By Location", description: "Item counts per location." },
]

export function EquipmentReportsPage() {
  const [type, setType] = useState("inventory")
  const [report, setReport] = useState<{ title: string; headers: string[]; rows: string[][] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setLoading(true); setError("")
    fetchReport(type)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not build the report"))
      .finally(() => setLoading(false))
  }, [type])

  return (
    <div className="space-y-4">
      <PageHeader title="Equipment Reports" description="Lightweight operational reports — view inline or download as CSV." icon={<Gauge className="h-5 w-5" />} />
      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button key={r.type} type="button" onClick={() => setType(r.type)}
            className={cn("rounded-md border px-3 py-1.5 text-sm", type === r.type ? "border-brand-brown bg-brand-brown text-white" : "hover:bg-muted")}>
            {r.label}
          </button>
        ))}
      </div>
      {error && <CrmErrorState message={error} />}
      {loading && !report && <CrmSpinner />}
      {report && (
        <section className="overflow-hidden rounded-lg border bg-white">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-brand-dark">{report.title}</h2>
              <p className="text-xs text-muted-foreground">{report.rows.length} row{report.rows.length === 1 ? "" : "s"}</p>
            </div>
            <a href={reportCsvUrl(type)} className={outlineButtonClass()} download>
              <Download className="h-4 w-4" /> CSV
            </a>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {report.headers.map((h) => <th key={h} className="whitespace-nowrap px-4 py-2 font-medium text-brand-dark">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 && (
                  <tr><td colSpan={report.headers.length} className="px-4 py-6 text-center text-sm text-muted-foreground">No rows for this report.</td></tr>
                )}
                {report.rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {row.map((cell, j) => <td key={j} className="whitespace-nowrap px-4 py-2 text-muted-foreground">{cell || "—"}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
