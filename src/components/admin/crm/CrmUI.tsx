// Shared CRM admin UI primitives: status/priority badges, empty states,
// error banners, relative-time formatting and the small confirm dialog used
// across every CRM page. Styling follows the existing brand (brown primary,
// green accent) and the admin design language.
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Lead, Followup } from "@/types/crm"

// ------------------------------------------------------------- formatting

export function crmRelativeTime(iso: string): string {
  if (!iso) return ""
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ""
  const diff = Date.now() - t
  const abs = Math.abs(diff)
  const future = diff < 0
  const minutes = Math.round(abs / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return future ? `in ${minutes} min` : `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return future ? `in ${days} day${days === 1 ? "" : "s"}` : `${days} day${days === 1 ? "" : "s"} ago`
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

export function crmDay(iso: string): string {
  if (!iso) return ""
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ""
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

export function crmDayOnly(value: string): string {
  // Renders a YYYY-MM-DD without timezone shifting.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return crmDay(value)
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

// ----------------------------------------------------------------- badges

type Tone = "brown" | "green" | "amber" | "red" | "gray" | "blue"

const leadStatusTone: Record<string, Tone> = {
  New: "blue",
  Contacted: "gray",
  Qualified: "green",
  "Quotation Sent": "amber",
  Negotiation: "amber",
  Won: "green",
  Lost: "red",
  "On Hold": "gray",
}

const priorityTone: Record<string, Tone> = {
  Low: "gray",
  Normal: "gray",
  High: "amber",
  Urgent: "red",
}

const followupStatusTone: Record<string, Tone> = {
  Pending: "amber",
  Completed: "green",
  Cancelled: "gray",
}

export function LeadStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", leadStatusTone[status] || "gray")}>
      {status}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (!priority || priority === "Normal") return null
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", priorityTone[priority] || "gray")}>
      {priority}
    </span>
  )
}

export function FollowupStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", followupStatusTone[status] || "gray")}>
      {status}
    </span>
  )
}

export function SourceBadge({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      {source}
    </span>
  )
}

// ------------------------------------------------------------ empty state

export function CrmEmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <p className="font-medium text-brand-dark">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {actionLabel && onAction && (
        <Button size="sm" className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

// ------------------------------------------------------------ error state

export function CrmErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{message}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}

// -------------------------------------------------------- spinner + cards

export function CrmSpinner() {
  return (
    <div className="flex items-center justify-center py-12" aria-label="Loading">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-brown border-t-transparent" />
    </div>
  )
}

export function CrmCard({ title, count, children, action }: { title: string; count?: number; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-dark">
          {title}
          {typeof count === "number" && <span className="ml-1.5 text-muted-foreground">({count})</span>}
        </h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ------------------------------------------------------------ lead fields

export function LeadPrimaryField({ lead }: { lead: Lead }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-brand-dark">{lead.name}</p>
      <p className="truncate text-xs text-muted-foreground">
        {[lead.company, lead.location].filter(Boolean).join(" · ")}
      </p>
    </div>
  )
}

export function followupWhenLabel(f: Followup): string {
  if (f.status !== "Pending") return crmDayOnly(f.date)
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  if (f.date < today) return `Overdue · ${crmDayOnly(f.date)}`
  if (f.date === today) return "Today"
  if (f.date === tomorrow) return "Tomorrow"
  return crmDayOnly(f.date)
}

// ------------------------------------------------------- confirm dialog

export function CrmConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div role="alertdialog" aria-modal="true" aria-label={title} className="w-full max-w-sm rounded-lg border bg-white p-5 shadow-lg">
        <h2 className="text-sm font-semibold text-brand-dark">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button ref={confirmRef} variant="destructive" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
