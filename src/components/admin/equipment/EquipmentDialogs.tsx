// Equipment workflow dialogs — assign, reserve, return, maintenance,
// calibration and inspection. Every dialog reuses the shared shell and
// surfaces server errors verbatim (assignment conflicts, duplicate asset
// numbers, validation messages).
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import {
  assignEquipmentItem, returnEquipmentItem, reserveEquipmentItem,
  createMaintenanceRecord, updateMaintenanceRecord, createCalibrationRecord,
  createInspectionRecord,
} from "@/lib/equipmentApi"
import { fetchProjects, fetchStaff } from "@/lib/projectsApi"
import {
  EquipmentDialogShell, Field, inputClass, selectClass, DialogActions,
  primaryButtonClass, outlineButtonClass, formatMoney,
} from "@/components/admin/equipment/EquipmentUI"
import {
  EQUIPMENT_CONDITIONS, MAINTENANCE_TYPES, MAINTENANCE_STATUSES,
  CALIBRATION_RESULTS, INSPECTION_RESULTS, INSPECTION_TYPES,
} from "@/types/equipment"
import type {
  Equipment, EquipmentCondition, MaintenanceRecord,
} from "@/types/equipment"

const today = () => new Date().toISOString().slice(0, 10)

type ProjectOption = { id: string; number: string; title: string }
type StaffOption = { id: string; name: string; role: string }

function useProjectStaffOptions(open: boolean) {
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [staff, setStaff] = useState<StaffOption[]>([])
  useEffect(() => {
    if (!open) return
    fetchProjects({ pageSize: 100 })
      .then((r) => setProjects(r.projects.map((p) => ({ id: p.id, number: p.number, title: p.title }))))
      .catch(() => setProjects([]))
    fetchStaff()
      .then((r) => setStaff(r.staff.map((s) => ({ id: s.id, name: s.name, role: s.role }))))
      .catch(() => setStaff([]))
  }, [open])
  return { projects, staff }
}

function ErrorNote({ error }: { error: string }) {
  if (!error) return null
  return (
    <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
      {error}
    </div>
  )
}

// ---------------------------------------------------------------- assign

export function AssignDialog({
  equipment, open, onClose, onDone,
}: {
  equipment: Equipment
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { projects, staff } = useProjectStaffOptions(open)
  const [projectId, setProjectId] = useState("")
  const [staffId, setStaffId] = useState("")
  const [startDate, setStartDate] = useState(today())
  const [expectedReturnDate, setExpectedReturnDate] = useState("")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setProjectId(""); setStaffId(""); setStartDate(today()); setExpectedReturnDate(""); setNotes(""); setError("")
    }
  }, [open])

  const submit = async () => {
    if (!projectId && !staffId) { setError("Pick a project, a staff member, or both"); return }
    setBusy(true); setError("")
    try {
      const project = projects.find((p) => p.id === projectId)
      const person = staff.find((s) => s.id === staffId)
      await assignEquipmentItem(equipment.id, {
        projectId: project?.id, projectNumber: project?.number, projectTitle: project?.title,
        staffId: person?.id, staffName: person?.name,
        startDate, expectedReturnDate: expectedReturnDate || undefined, notes: notes || undefined,
      })
      onDone(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assignment failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <EquipmentDialogShell
      title="Assign Equipment"
      subtitle={`${equipment.name} · ${equipment.assetNumber}`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <Field label="Project (optional)">
          <select className={selectClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— none —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.number} — {p.title}</option>)}
          </select>
        </Field>
        <Field label="Assigned staff (optional)">
          <select className={selectClass} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">— none —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.role ? ` · ${s.role}` : ""}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assignment date">
            <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Expected return">
            <input type="date" className={inputClass} value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <p className="text-[11px] text-muted-foreground">
          The equipment status switches to Assigned automatically. Conflicting assignments or reservations are rejected.
        </p>
        <ErrorNote error={error} />
        <DialogActions>
          <button type="button" className={outlineButtonClass()} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={primaryButtonClass()} onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Assign
          </button>
        </DialogActions>
      </div>
    </EquipmentDialogShell>
  )
}

// ---------------------------------------------------------------- reserve

export function ReserveDialog({
  equipment, open, onClose, onDone,
}: {
  equipment: Equipment
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { projects } = useProjectStaffOptions(open)
  const [projectId, setProjectId] = useState("")
  const [reservedDate, setReservedDate] = useState(today())
  const [usageStart, setUsageStart] = useState("")
  const [usageEnd, setUsageEnd] = useState("")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) { setProjectId(""); setReservedDate(today()); setUsageStart(""); setUsageEnd(""); setNotes(""); setError("") }
  }, [open])

  const submit = async () => {
    if (!usageStart && !usageEnd) { setError("Give the expected usage window"); return }
    setBusy(true); setError("")
    try {
      const project = projects.find((p) => p.id === projectId)
      await reserveEquipmentItem(equipment.id, {
        projectId: project?.id, projectNumber: project?.number, projectTitle: project?.title,
        reservedDate, usageStart: usageStart || undefined, usageEnd: usageEnd || undefined, notes: notes || undefined,
      })
      onDone(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reservation failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <EquipmentDialogShell
      title="Reserve Equipment"
      subtitle={`${equipment.name} · ${equipment.assetNumber}`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <Field label="For project (optional)">
          <select className={selectClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— none —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.number} — {p.title}</option>)}
          </select>
        </Field>
        <Field label="Reservation date">
          <input type="date" className={inputClass} value={reservedDate} onChange={(e) => setReservedDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Usage from">
            <input type="date" className={inputClass} value={usageStart} onChange={(e) => setUsageStart(e.target.value)} />
          </Field>
          <Field label="Usage to">
            <input type="date" className={inputClass} value={usageEnd} onChange={(e) => setUsageEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <p className="text-[11px] text-muted-foreground">Reserved equipment shows as Reserved — not freely available — for the reserved window.</p>
        <ErrorNote error={error} />
        <DialogActions>
          <button type="button" className={outlineButtonClass()} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={primaryButtonClass()} onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Reserve
          </button>
        </DialogActions>
      </div>
    </EquipmentDialogShell>
  )
}

// ---------------------------------------------------------------- return

export function ReturnDialog({
  equipment, open, onClose, onDone,
}: {
  equipment: Equipment
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [returnDate, setReturnDate] = useState(today())
  const [conditionOnReturn, setConditionOnReturn] = useState<EquipmentCondition>("Good")
  const [damageReport, setDamageReport] = useState("")
  const [requiresMaintenance, setRequiresMaintenance] = useState(false)
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) { setReturnDate(today()); setConditionOnReturn("Good"); setDamageReport(""); setRequiresMaintenance(false); setNotes(""); setError("") }
  }, [open])

  const submit = async () => {
    setBusy(true); setError("")
    try {
      await returnEquipmentItem(equipment.id, {
        returnDate,
        conditionOnReturn,
        damageReport: damageReport || undefined,
        requiresMaintenance,
        notes: notes || undefined,
      })
      onDone(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Return failed")
    } finally {
      setBusy(false)
    }
  }

  const resultingStatus = requiresMaintenance ? "Under Maintenance" : ["Damaged", "Unusable"].includes(conditionOnReturn) ? "Damaged" : "Available"

  return (
    <EquipmentDialogShell
      title="Return Equipment"
      subtitle={`${equipment.name} · ${equipment.assetNumber}`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Return date">
            <input type="date" className={inputClass} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
          </Field>
          <Field label="Condition on return">
            <select className={selectClass} value={conditionOnReturn} onChange={(e) => setConditionOnReturn(e.target.value as EquipmentCondition)}>
              {EQUIPMENT_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Damage report (optional)">
          <textarea className={inputClass} rows={2} value={damageReport} onChange={(e) => setDamageReport(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-brand-dark">
          <input type="checkbox" checked={requiresMaintenance} onChange={(e) => setRequiresMaintenance(e.target.checked)} />
          Requires maintenance before next use
        </label>
        <p className="text-[11px] text-muted-foreground">
          Resulting status: <strong>{resultingStatus}</strong> — set automatically from the condition and maintenance flag.
        </p>
        <Field label="Notes (optional)">
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <ErrorNote error={error} />
        <DialogActions>
          <button type="button" className={outlineButtonClass()} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={primaryButtonClass()} onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Record return
          </button>
        </DialogActions>
      </div>
    </EquipmentDialogShell>
  )
}

// ------------------------------------------------------------- maintenance

export function MaintenanceDialog({
  equipment, open, existing, onClose, onDone,
}: {
  equipment: Equipment
  open: boolean
  existing?: MaintenanceRecord | null
  onClose: () => void
  onDone: () => void
}) {
  const [type, setType] = useState<MaintenanceRecord["type"]>("Preventive")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(today())
  const [serviceProvider, setServiceProvider] = useState("")
  const [technician, setTechnician] = useState("")
  const [cost, setCost] = useState("")
  const [parts, setParts] = useState("")
  const [nextDate, setNextDate] = useState("")
  const [status, setStatus] = useState<MaintenanceRecord["status"]>("Scheduled")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setError(""); setBusy(false)
    if (existing) {
      setType(existing.type); setDescription(existing.description); setDate(existing.date)
      setServiceProvider(existing.serviceProvider); setTechnician(existing.technician)
      setCost(existing.costMinor ? String(existing.costMinor / 100) : "")
      setParts(existing.partsReplaced.join(", ")); setNextDate(existing.nextMaintenanceDate)
      setStatus(existing.status); setNotes(existing.notes)
    } else {
      setType("Preventive"); setDescription(""); setDate(today()); setServiceProvider("")
      setTechnician(""); setCost(""); setParts(""); setNextDate(""); setStatus("Scheduled"); setNotes("")
    }
  }, [open, existing])

  const submit = async () => {
    if (!description.trim()) { setError("Describe the maintenance work"); return }
    setBusy(true); setError("")
    const payload = {
      type, description: description.trim(), date, serviceProvider, technician,
      costMinor: cost ? Math.round(Number(cost) * 100) : 0,
      partsReplaced: parts.split(",").map((p) => p.trim()).filter(Boolean),
      nextMaintenanceDate: nextDate || undefined, status, notes: notes || undefined,
    }
    try {
      if (existing) await updateMaintenanceRecord(equipment.id, existing.id, payload)
      else await createMaintenanceRecord(equipment.id, payload)
      onDone(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the maintenance record")
    } finally {
      setBusy(false)
    }
  }

  return (
    <EquipmentDialogShell
      title={existing ? "Edit Maintenance" : "Record Maintenance"}
      subtitle={`${equipment.name} · ${equipment.assetNumber}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Maintenance type">
            <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as MaintenanceRecord["type"])}>
              {MAINTENANCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as MaintenanceRecord["status"])}>
              {MAINTENANCE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Next maintenance (optional — recomputed from the schedule if left empty)">
            <input type="date" className={inputClass} value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </Field>
          <Field label="Service provider">
            <input className={inputClass} value={serviceProvider} onChange={(e) => setServiceProvider(e.target.value)} />
          </Field>
          <Field label="Technician">
            <input className={inputClass} value={technician} onChange={(e) => setTechnician(e.target.value)} />
          </Field>
          <Field label={`Cost (${equipment.currency.symbol || "₦"}, optional)`}>
            <input inputMode="decimal" className={inputClass} value={cost} onChange={(e) => setCost(e.target.value)} placeholder={formatMoney(850000, equipment.currency)} />
          </Field>
          <Field label="Parts replaced (comma-separated)">
            <input className={inputClass} value={parts} onChange={(e) => setParts(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <p className="text-[11px] text-muted-foreground">
          Marking a record Completed updates the equipment's maintenance schedule (last + next due).
        </p>
        <ErrorNote error={error} />
        <DialogActions>
          <button type="button" className={outlineButtonClass()} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={primaryButtonClass()} onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {existing ? "Save changes" : "Record maintenance"}
          </button>
        </DialogActions>
      </div>
    </EquipmentDialogShell>
  )
}

// ------------------------------------------------------------- calibration

export function CalibrationDialog({
  equipment, open, onClose, onDone,
}: {
  equipment: Equipment
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [date, setDate] = useState(today())
  const [provider, setProvider] = useState("")
  const [certificateNumber, setCertificateNumber] = useState("")
  const [result, setResult] = useState<"Passed" | "Adjusted" | "Failed">("Passed")
  const [nextDate, setNextDate] = useState("")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) { setDate(today()); setProvider(""); setCertificateNumber(""); setResult("Passed"); setNextDate(""); setNotes(""); setError("") }
  }, [open])

  const submit = async () => {
    setBusy(true); setError("")
    try {
      await createCalibrationRecord(equipment.id, {
        date, provider, certificateNumber, result,
        nextCalibrationDate: nextDate || undefined, notes: notes || undefined,
      })
      onDone(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the calibration record")
    } finally {
      setBusy(false)
    }
  }

  return (
    <EquipmentDialogShell
      title="Record Calibration"
      subtitle={`${equipment.name} · ${equipment.assetNumber}`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Calibration date">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Result">
            <select className={selectClass} value={result} onChange={(e) => setResult(e.target.value as "Passed" | "Adjusted" | "Failed")}>
              {CALIBRATION_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Provider">
            <input className={inputClass} value={provider} onChange={(e) => setProvider(e.target.value)} />
          </Field>
          <Field label="Certificate number">
            <input className={inputClass} value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} />
          </Field>
          <Field label="Next calibration (optional — schedule default applies)">
            <input type="date" className={inputClass} value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <p className="text-[11px] text-muted-foreground">
          Attach the certificate from the Documents tab afterwards — certificates link through the Document Management System.
        </p>
        <ErrorNote error={error} />
        <DialogActions>
          <button type="button" className={outlineButtonClass()} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={primaryButtonClass()} onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Record calibration
          </button>
        </DialogActions>
      </div>
    </EquipmentDialogShell>
  )
}

// -------------------------------------------------------------- inspection

export function InspectionDialog({
  equipment, open, onClose, onDone,
}: {
  equipment: Equipment
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [date, setDate] = useState(today())
  const [type, setType] = useState<"Pre-field" | "Post-field" | "Periodic" | "Damage Assessment" | "Other">("Pre-field")
  const [inspector, setInspector] = useState("")
  const [condition, setCondition] = useState("")
  const [findings, setFindings] = useState("")
  const [recommendations, setRecommendations] = useState("")
  const [result, setResult] = useState<"Passed" | "Failed">("Passed")
  const [nextDate, setNextDate] = useState("")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setDate(today()); setType("Pre-field"); setInspector(""); setCondition("")
      setFindings(""); setRecommendations(""); setResult("Passed"); setNextDate(""); setNotes(""); setError("")
    }
  }, [open])

  const submit = async () => {
    if (!inspector.trim()) { setError("Name the inspector"); return }
    setBusy(true); setError("")
    try {
      await createInspectionRecord(equipment.id, {
        date, type, inspector: inspector.trim(),
        condition: condition || undefined, findings: findings || undefined,
        recommendations: recommendations || undefined, result,
        nextInspectionDate: nextDate || undefined, notes: notes || undefined,
      })
      onDone(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the inspection")
    } finally {
      setBusy(false)
    }
  }

  return (
    <EquipmentDialogShell
      title="Record Inspection"
      subtitle={`${equipment.name} · ${equipment.assetNumber}`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Inspection date">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Type">
            <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {INSPECTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Inspector">
            <input className={inputClass} value={inspector} onChange={(e) => setInspector(e.target.value)} />
          </Field>
          <Field label="Condition observed (optional — updates the record)">
            <select className={selectClass} value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="">— unchanged —</option>
              {EQUIPMENT_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Result">
            <select className={selectClass} value={result} onChange={(e) => setResult(e.target.value as "Passed" | "Failed")}>
              {INSPECTION_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Next inspection (optional)">
            <input type="date" className={inputClass} value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Findings">
          <textarea className={inputClass} rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} />
        </Field>
        <Field label="Recommendations">
          <textarea className={inputClass} rows={2} value={recommendations} onChange={(e) => setRecommendations(e.target.value)} />
        </Field>
        <ErrorNote error={error} />
        <DialogActions>
          <button type="button" className={outlineButtonClass()} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={primaryButtonClass()} onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Record inspection
          </button>
        </DialogActions>
      </div>
    </EquipmentDialogShell>
  )
}
