// Shared Equipment Management System UI — status/condition badges, due-date
// chips, money formatting and a standard form-dialog shell, following the
// DocumentUI/QuotationUI conventions.
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { CheckCircle2, CircleDashed, AlertTriangle, XCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { crmDayOnly } from "@/components/admin/crm/CrmUI"
import type {
  Equipment,
  MaintenanceSchedule, CalibrationSchedule,
} from "@/types/equipment"

const STATUS_STYLES: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Assigned: "bg-blue-50 text-blue-700 border-blue-200",
  Reserved: "bg-violet-50 text-violet-700 border-violet-200",
  "Under Maintenance": "bg-amber-50 text-amber-700 border-amber-200",
  "Under Calibration": "bg-cyan-50 text-cyan-700 border-cyan-200",
  Damaged: "bg-red-50 text-red-700 border-red-200",
  Lost: "bg-red-50 text-red-700 border-red-200",
  Retired: "bg-stone-100 text-stone-600 border-stone-200",
  Archived: "bg-stone-100 text-stone-600 border-stone-200",
}

const CONDITION_STYLES: Record<string, string> = {
  Excellent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Good: "bg-green-50 text-green-700 border-green-200",
  Fair: "bg-amber-50 text-amber-700 border-amber-200",
  "Needs Repair": "bg-orange-50 text-orange-700 border-orange-200",
  Damaged: "bg-red-50 text-red-700 border-red-200",
  Unusable: "bg-red-100 text-red-800 border-red-300",
}

export function EquipmentStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", STATUS_STYLES[status] || "bg-muted text-muted-foreground border-border", className)}>
      {status}
    </span>
  )
}

export function EquipmentConditionBadge({ condition }: { condition: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", CONDITION_STYLES[condition] || "bg-muted text-muted-foreground border-border")}>
      {condition}
    </span>
  )
}

// Compact due chip: "Calibration in 42 days" / "Maintenance overdue 3d" / "—".
export function DueChip({
  label,
  schedule,
  state,
  days,
}: {
  label: string
  schedule: MaintenanceSchedule | CalibrationSchedule
  state: "none" | "ok" | "due-soon" | "overdue"
  days: number | null
}) {
  if (state === "none" || !schedule.nextDate) {
    return <span className="font-mono text-[11px] text-muted-foreground">—</span>
  }
  const tone =
    state === "overdue"
      ? "text-red-600"
      : state === "due-soon"
        ? "text-amber-600"
        : "text-muted-foreground"
  const when =
    days === null ? crmDayOnly(schedule.nextDate)
      : days < 0 ? `overdue ${Math.abs(days)}d`
        : days === 0 ? "today"
          : `in ${days}d`
  return (
    <span className={cn("font-mono text-[11px]", tone)} title={crmDayOnly(schedule.nextDate)}>
      {label} {when}
    </span>
  )
}

export function formatMoney(minor: number, currency: { symbol: string; minorUnits: number }) {
  if (!minor) return "—"
  const value = minor / 10 ** (currency.minorUnits || 2)
  return `${currency.symbol || ""}${value.toLocaleString()}`
}

// The standard EMS modal shell (portal + overlay), used by every dialog.
export function EquipmentDialogShell({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={cn(
          "max-h-[92vh] w-full overflow-y-auto rounded-t-xl border bg-white shadow-xl sm:rounded-xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b bg-white px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-brand-dark">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function EquipmentMiniRow({
  equipment,
  right,
  onClick,
}: {
  equipment: Equipment
  right?: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-brand-dark">{equipment.name}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{equipment.assetNumber} · {equipment.category.name}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
      </div>
    </button>
  )
}

export function ScheduleSummary({ equipment }: { equipment: Equipment }) {
  const m = equipment.maintenanceSchedule
  const c = equipment.calibrationSchedule
  return (
    <div className="grid gap-1 text-xs text-muted-foreground">
      <span>
        Maintenance: {m.frequency === "None" ? "as needed" : m.frequency}
        {m.nextDate ? ` · next ${crmDayOnly(m.nextDate)}` : ""}
      </span>
      <span>
        Calibration: {c.frequencyMonths > 0 ? `every ${c.frequencyMonths} months` : "not scheduled"}
        {c.nextDate ? ` · next ${crmDayOnly(c.nextDate)}` : ""}
      </span>
    </div>
  )
}

// Field primitives shared by every EMS form.
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-brand-dark">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  )
}

export const inputClass =
  "w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-brand-dark shadow-sm outline-none focus:border-brand-brown focus:ring-1 focus:ring-brand-brown/40"

export const selectClass = inputClass

export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex flex-wrap justify-end gap-2">{children}</div>
}

export function primaryButtonClass(extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50",
    extra,
  )
}

export function outlineButtonClass(extra?: string) {
  return cn("inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50", extra)
}

// Icon helpers exported for the quick-action rows.
export { CheckCircle2, CircleDashed, AlertTriangle, XCircle }
