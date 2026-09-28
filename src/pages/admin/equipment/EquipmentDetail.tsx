// Equipment profile — identity, status/condition, quick actions (assign,
// reserve, return, maintenance, calibration, inspection, edit, archive,
// retire) and the complete record tabs: assignments, reservations,
// maintenance, calibrations, inspections, documents (linked through the DMS
// by the equipment:<assetNumber> tag), photos and history.
import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, Wrench, Archive, ArchiveRestore, Ban, Pencil, Gauge,
  ClipboardCheck, Undo2, FileText, History, Trash2,
} from "lucide-react"
import {
  fetchEquipmentDetail, archiveEquipmentItem, retireEquipmentItem,
  deleteEquipmentItem, cancelEquipmentReservation,
} from "@/lib/equipmentApi"
import { fetchDocuments } from "@/lib/documentsApi"
import { crmRelativeTime, crmDayOnly, CrmSpinner, CrmErrorState, CrmConfirmDialog } from "@/components/admin/crm/CrmUI"
import {
  EquipmentStatusBadge, EquipmentConditionBadge, DueChip, formatMoney, outlineButtonClass,
} from "@/components/admin/equipment/EquipmentUI"
import {
  AssignDialog, ReserveDialog, ReturnDialog, MaintenanceDialog, CalibrationDialog, InspectionDialog,
} from "@/components/admin/equipment/EquipmentDialogs"
import type { EquipmentDetailResult, Equipment } from "@/types/equipment"
import type { DocumentRecord } from "@/types/documents"
import { cn } from "@/lib/utils"

const TABS = ["Overview", "Assignments", "Maintenance", "Calibration", "Inspections", "Documents", "Photos", "History"] as const
type Tab = (typeof TABS)[number]

export default function EquipmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<EquipmentDetailResult | null>(null)
  const [docs, setDocs] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<Tab>("Overview")
  const [dialog, setDialog] = useState<null | "assign" | "reserve" | "return" | "maintenance" | "calibration" | "inspection">(null)
  const [confirm, setConfirm] = useState<null | { kind: "archive" | "restore" | "retire" | "delete" }>(null)
  const [actionError, setActionError] = useState("")

  const load = useCallback(async () => {
    if (!id) return
    setError("")
    try {
      const result = await fetchEquipmentDetail(id)
      setDetail(result)
      try {
        // DMS links by the equipment:<assetNumber> tag — one server-side query.
        const tagged = await fetchDocuments({ tag: `equipment:${result.equipment.assetNumber}`, pageSize: 100 })
        setDocs(tagged.documents || [])
      } catch {
        setDocs([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load equipment")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const runConfirm = async () => {
    if (!detail || !confirm) return
    setActionError("")
    try {
      if (confirm.kind === "archive") await archiveEquipmentItem(detail.equipment.id, true)
      if (confirm.kind === "restore") await archiveEquipmentItem(detail.equipment.id, false)
      if (confirm.kind === "retire") await retireEquipmentItem(detail.equipment.id)
      if (confirm.kind === "delete") {
        await deleteEquipmentItem(detail.equipment.id, detail.equipment.assetNumber)
        navigate("/admin/equipment/all")
        return
      }
      setConfirm(null)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed")
      setConfirm(null)
    }
  }

  if (loading) return <CrmSpinner />
  if (error || !detail) return <CrmErrorState message={error || "Equipment not found"} onRetry={load} />

  const item: Equipment = detail.equipment
  const docTag = `equipment:${item.assetNumber}`
  const isRetired = item.status === "Retired"

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand-dark">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-brand-brown">{item.assetNumber}</span>
              <EquipmentStatusBadge status={item.status} />
              <EquipmentConditionBadge condition={item.condition} />
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-brand-dark">{item.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[item.category.name, [item.manufacturer, item.model].filter(Boolean).join(" "), item.serialNumber ? `S/N ${item.serialNumber}` : ""].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {item.computed.assignable && (
              <>
                <button type="button" className={outlineButtonClass("bg-brand-brown text-white hover:bg-brand-brown/90")} onClick={() => setDialog("assign")}>Assign</button>
                <button type="button" className={outlineButtonClass()} onClick={() => setDialog("reserve")}>Reserve</button>
              </>
            )}
            {item.computed.activeAssignment && (
              <button type="button" className={outlineButtonClass()} onClick={() => setDialog("return")}><Undo2 className="h-4 w-4" /> Return</button>
            )}
            <button type="button" className={outlineButtonClass()} onClick={() => setDialog("maintenance")}><Wrench className="h-4 w-4" /> Maintenance</button>
            <button type="button" className={outlineButtonClass()} onClick={() => setDialog("calibration")}><Gauge className="h-4 w-4" /> Calibration</button>
            <button type="button" className={outlineButtonClass()} onClick={() => setDialog("inspection")}><ClipboardCheck className="h-4 w-4" /> Inspection</button>
            <Link to={`/admin/equipment/${item.id}/edit`} className={outlineButtonClass()}><Pencil className="h-4 w-4" /> Edit</Link>
            {!item.archived && !isRetired ? (
              <button type="button" className={outlineButtonClass()} onClick={() => setConfirm({ kind: "archive" })}><Archive className="h-4 w-4" /> Archive</button>
            ) : item.archived ? (
              <button type="button" className={outlineButtonClass()} onClick={() => setConfirm({ kind: "restore" })}><ArchiveRestore className="h-4 w-4" /> Restore</button>
            ) : null}
            {!isRetired && !item.archived && (
              <button type="button" className={outlineButtonClass("text-red-700 hover:bg-red-50")} onClick={() => setConfirm({ kind: "retire" })}><Ban className="h-4 w-4" /> Retire</button>
            )}
          </div>
        </div>
        {actionError && <CrmErrorState message={actionError} />}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-brand-brown text-white" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Current state</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-0.5"><EquipmentStatusBadge status={item.status} /></dd></div>
              <div><dt className="text-xs text-muted-foreground">Condition</dt><dd className="mt-0.5"><EquipmentConditionBadge condition={item.condition} /></dd></div>
              <div><dt className="text-xs text-muted-foreground">Location</dt><dd>{item.location || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Assigned staff</dt><dd>{item.assignedStaff.name || "—"}</dd></div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Current project</dt>
                <dd>
                  {item.assignedProject.id
                    ? <Link to={`/admin/pms/${item.assignedProject.id}`} className="text-brand-brown hover:underline">{item.assignedProject.number} — {item.assignedProject.title}</Link>
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Maintenance</dt>
                <dd><DueChip label="next" schedule={item.maintenanceSchedule} state={item.computed.maintenanceState} days={item.computed.maintenanceDays} /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Calibration</dt>
                <dd><DueChip label="next" schedule={item.calibrationSchedule} state={item.computed.calibrationState} days={item.computed.calibrationDays} /></dd>
              </div>
              <div><dt className="text-xs text-muted-foreground">Warranty</dt><dd>{item.warrantyExpiry ? crmDayOnly(item.warrantyExpiry) : "—"}{item.computed.warrantyExpired ? " (expired)" : ""}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Purchase</dt><dd>{item.purchase.date ? crmDayOnly(item.purchase.date) : "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Purchase price</dt><dd>{formatMoney(item.purchase.priceMinor, item.currency)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Current value</dt><dd>{formatMoney(item.currentValueMinor, item.currency)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Registered</dt><dd>{crmDayOnly(item.createdAt)}</dd></div>
            </dl>
            {item.description && <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">{item.description}</p>}
            {item.notes && <p className="mt-2 text-sm text-muted-foreground"><strong className="text-brand-dark">Notes:</strong> {item.notes}</p>}
          </section>

          <section className="space-y-4">
            <div className="rounded-lg border bg-white p-4">
              <h2 className="text-sm font-semibold text-brand-dark">Active assignment</h2>
              {item.computed.activeAssignment ? (
                <div className="mt-2 text-sm">
                  <p className="font-medium text-brand-dark">{item.computed.activeAssignment.project.title || item.computed.activeAssignment.staff.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Out since {crmDayOnly(item.computed.activeAssignment.startDate)}
                    {item.computed.activeAssignment.expectedReturnDate ? ` · expected back ${crmDayOnly(item.computed.activeAssignment.expectedReturnDate)}` : " · open-ended"}
                  </p>
                </div>
              ) : <p className="mt-2 text-sm text-muted-foreground">Not currently assigned.</p>}
            </div>
            <div className="rounded-lg border bg-white p-4">
              <h2 className="text-sm font-semibold text-brand-dark">Reservations</h2>
              {(item.computed.activeReservations || []).length === 0 && <p className="mt-2 text-sm text-muted-foreground">No active reservations.</p>}
              <div className="mt-2 space-y-2">
                {(item.computed.activeReservations || []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-brand-dark">{r.project.title || "Unlinked reservation"}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{r.usageStart || "?"} → {r.usageEnd || "open"}</p>
                    </div>
                    <button type="button" className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" aria-label="Cancel reservation"
                      onClick={async () => { try { await cancelEquipmentReservation(item.id, r.id); await load() } catch (err) { setActionError(err instanceof Error ? err.message : "Cancel failed") } }}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <h2 className="text-sm font-semibold text-brand-dark">Schedules</h2>
              <div className="mt-2 grid gap-2 text-sm text-muted-foreground">
                <p>Maintenance: {item.maintenanceSchedule.frequency === "None" ? "as needed" : item.maintenanceSchedule.frequency}{item.maintenanceSchedule.lastDate ? ` · last ${crmDayOnly(item.maintenanceSchedule.lastDate)}` : ""}</p>
                <p>Calibration: {item.calibrationSchedule.frequencyMonths > 0 ? `every ${item.calibrationSchedule.frequencyMonths} months` : "not scheduled"}{item.calibrationSchedule.lastDate ? ` · last ${crmDayOnly(item.calibrationSchedule.lastDate)}` : ""}</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Assignments */}
      {tab === "Assignments" && (
        <section className="rounded-lg border bg-white">
          <header className="border-b px-4 py-3"><h2 className="text-sm font-semibold text-brand-dark">Assignment history ({detail.assignments.length})</h2></header>
          <div className="divide-y">
            {detail.assignments.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">Never assigned yet.</p>}
            {detail.assignments.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brand-dark">{a.project.title || a.staff.name || "Unlinked"}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {crmDayOnly(a.startDate)} → {a.returnDate ? crmDayOnly(a.returnDate) : a.expectedReturnDate || "open"}
                    {a.staff.name ? ` · ${a.staff.name}` : ""}
                  </p>
                  {a.damageReport && <p className="mt-1 text-xs text-red-700">Damage: {a.damageReport}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {a.conditionOnReturn && <EquipmentConditionBadge condition={a.conditionOnReturn} />}
                  <EquipmentStatusBadge status={a.status} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Maintenance */}
      {tab === "Maintenance" && (
        <section className="rounded-lg border bg-white">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-brand-dark">Maintenance records ({detail.maintenance.length})</h2>
            <button type="button" className={outlineButtonClass()} onClick={() => setDialog("maintenance")}><Wrench className="h-4 w-4" /> Record</button>
          </header>
          <div className="divide-y">
            {detail.maintenance.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No maintenance recorded.</p>}
            {detail.maintenance.map((m) => (
              <div key={m.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-brand-dark">{m.type}: {m.description}</p>
                  <EquipmentStatusBadge status={m.status} />
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {crmDayOnly(m.date)}{m.serviceProvider ? ` · ${m.serviceProvider}` : ""}{m.costMinor ? ` · ${formatMoney(m.costMinor, item.currency)}` : ""}
                  {m.nextMaintenanceDate ? ` · next ${crmDayOnly(m.nextMaintenanceDate)}` : ""}
                </p>
                {m.partsReplaced.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Parts: {m.partsReplaced.join(", ")}</p>}
                {m.notes && <p className="mt-1 text-xs text-muted-foreground">{m.notes}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Calibration */}
      {tab === "Calibration" && (
        <section className="rounded-lg border bg-white">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-brand-dark">Calibration records ({detail.calibrations.length})</h2>
            <button type="button" className={outlineButtonClass()} onClick={() => setDialog("calibration")}><Gauge className="h-4 w-4" /> Record</button>
          </header>
          <div className="divide-y">
            {detail.calibrations.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No calibrations recorded.</p>}
            {detail.calibrations.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-brand-dark">{c.result} — {c.provider || "provider not recorded"}</p>
                  <span className={cn("font-mono text-[11px]", c.status === "Failed" ? "text-red-600" : "text-emerald-600")}>{c.status}</span>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {crmDayOnly(c.date)}{c.certificateNumber ? ` · cert ${c.certificateNumber}` : ""}{c.nextCalibrationDate ? ` · next ${crmDayOnly(c.nextCalibrationDate)}` : ""}
                </p>
                {c.notes && <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Inspections */}
      {tab === "Inspections" && (
        <section className="rounded-lg border bg-white">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-brand-dark">Inspections ({detail.inspections.length})</h2>
            <button type="button" className={outlineButtonClass()} onClick={() => setDialog("inspection")}><ClipboardCheck className="h-4 w-4" /> Record</button>
          </header>
          <div className="divide-y">
            {detail.inspections.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No inspections recorded.</p>}
            {detail.inspections.map((i) => (
              <div key={i.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-brand-dark">{i.type} — {i.inspector}</p>
                  <span className={cn("font-mono text-[11px]", i.result === "Passed" ? "text-emerald-600" : "text-red-600")}>{i.result}</span>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">{crmDayOnly(i.date)}{i.condition ? ` · condition ${i.condition}` : ""}{i.nextInspectionDate ? ` · next ${crmDayOnly(i.nextInspectionDate)}` : ""}</p>
                {i.findings && <p className="mt-1 text-xs text-muted-foreground">Findings: {i.findings}</p>}
                {i.recommendations && <p className="mt-1 text-xs text-muted-foreground">Recommendations: {i.recommendations}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Documents */}
      {tab === "Documents" && (
        <section className="rounded-lg border bg-white">
          <header className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-brand-dark">Documents ({docs.length})</h2>
            <p className="text-xs text-muted-foreground">
              Files live in the Document Management System, linked by the tag <code className="rounded bg-muted px-1 font-mono">{docTag}</code> — certificates, receipts, manuals, service reports.
            </p>
          </header>
          <div className="p-4">
            <Link
              to={`/admin/documents/all`}
              className={outlineButtonClass()}
              state={{ equipmentTag: docTag }}
            >
              <FileText className="h-4 w-4" /> Manage in Documents
            </Link>
            <div className="mt-3 divide-y rounded-md border">
              {docs.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  No documents yet — upload a certificate or manual through Documents and tag it <code className="font-mono">{docTag}</code>.
                </p>
              )}
              {docs.map((d) => (
                <Link key={d.id} to={`/admin/documents/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-dark">{d.originalFilename}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{d.documentNumber} · {d.status}</p>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{crmDayOnly(d.createdAt)}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Photos */}
      {tab === "Photos" && (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold text-brand-dark">Photos ({item.photos.length})</h2>
          {item.photos.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No photos — add some from the Edit page (front view, serial number, accessories, damage).</p>}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {item.photos.map((p, i) => (
              <figure key={`${p.url}-${i}`} className="overflow-hidden rounded-md border">
                <img src={p.url} alt={p.label || `${item.name} photo ${i + 1}`} className="h-32 w-full object-cover" loading="lazy" />
                {p.label && <figcaption className="px-2 py-1 text-[11px] text-muted-foreground">{p.label}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {tab === "History" && (
        <section className="rounded-lg border bg-white">
          <header className="border-b px-4 py-3"><h2 className="text-sm font-semibold text-brand-dark">Complete history ({detail.history.length})</h2></header>
          <ol className="divide-y">
            {detail.history.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No history yet.</p>}
            {detail.history.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-brand-dark">
                    <span className="font-mono text-xs font-semibold text-brand-brown">{h.action}</span> — {h.detail}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {crmDayOnly(h.at)} {crmRelativeTime(h.at)} · by {h.actor}
                    {h.project.title ? ` · ${h.project.title}` : ""}{h.staff.name ? ` · ${h.staff.name}` : ""}
                  </p>
                </div>
                <History className="h-4 w-4 shrink-0 text-muted-foreground" />
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Dialogs */}
      {dialog === "assign" && <AssignDialog equipment={item} open onClose={() => setDialog(null)} onDone={load} />}
      {dialog === "reserve" && <ReserveDialog equipment={item} open onClose={() => setDialog(null)} onDone={load} />}
      {dialog === "return" && <ReturnDialog equipment={item} open onClose={() => setDialog(null)} onDone={load} />}
      {dialog === "maintenance" && <MaintenanceDialog equipment={item} open onClose={() => setDialog(null)} onDone={load} />}
      {dialog === "calibration" && <CalibrationDialog equipment={item} open onClose={() => setDialog(null)} onDone={load} />}
      {dialog === "inspection" && <InspectionDialog equipment={item} open onClose={() => setDialog(null)} onDone={load} />}

      <CrmConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "delete" ? "Delete equipment record" : confirm?.kind === "retire" ? "Retire equipment" : confirm?.kind === "restore" ? "Restore from archive" : "Archive equipment"}
        description={
          confirm?.kind === "retire"
            ? `${item.name} leaves the active inventory but its history remains accessible.`
            : confirm?.kind === "delete"
              ? `This permanently removes ${item.assetNumber}. Archive or retire instead unless you are cleaning test data.`
              : confirm?.kind === "restore"
                ? `${item.name} returns to the active inventory.`
                : `${item.name} moves to the archive — history is preserved.`
        }
        confirmLabel={confirm?.kind === "delete" ? "Delete permanently" : "Confirm"}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
