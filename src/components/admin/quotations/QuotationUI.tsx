// Shared quotation admin UI primitives — badges, list rows, pagination,
// history timeline and version switcher. Reuses the CRM design language
// (CrmUI tones, brand tokens) so the module reads as part of the same CMS.
import { Link } from "react-router-dom"
import {
  FilePlus2, Pencil, Send, ArrowLeftRight, GitBranch, CheckCircle2, XCircle, Ban,
  Archive, ArchiveRestore, Copy, MailWarning, History, CircleDashed,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatMinorShort } from "@/lib/money"
import { crmRelativeTime, crmDayOnly } from "@/components/admin/crm/CrmUI"
import type { Currency, Quotation, QuotationHistoryEntry, QuotationVersionRef } from "@/types/quotations"

// ----------------------------------------------------------------- badges

type Tone = "brown" | "green" | "amber" | "red" | "gray" | "blue"

export const QUOTATION_STATUS_TONES: Record<string, Tone> = {
  Draft: "gray",
  Sent: "amber",
  "Under Review": "blue",
  Accepted: "green",
  Rejected: "red",
  Expired: "gray",
  Cancelled: "gray",
}

export function QuotationStatusBadge({ status }: { status: string }) {
  const tone = QUOTATION_STATUS_TONES[status] || "gray"
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", tone)}>
      {status}
    </span>
  )
}

export function VersionBadge({ version, isCurrent }: { version: number; isCurrent?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
        isCurrent === false ? "border-border bg-muted text-muted-foreground" : "border-brand-brown/25 bg-brand-brown/5 text-brand-brown",
      )}
      title={isCurrent === false ? "Prior version (read-only)" : "Current version"}
    >
      v{version}
      {isCurrent === false ? " · superseded" : ""}
    </span>
  )
}

export function ArchivedBadge() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      <Archive className="h-3 w-3" /> Archived
    </span>
  )
}

// ------------------------------------------------------------ list row

export function QuotationRow({ quotation, showArchived }: { quotation: Quotation; showArchived?: boolean }) {
  const currency = quotation.currency
  const label = quotation.client.company || quotation.client.name
  const sub = [quotation.projectTitle, quotation.location].filter(Boolean).join(" · ")
  return (
    <li>
      <Link
        to={`/admin/quotations/${quotation.id}`}
        className="flex flex-col gap-1.5 rounded-md border px-3 py-2.5 text-sm hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-xs font-semibold text-brand-brown">{quotation.number}</span>
          <VersionBadge version={quotation.version} isCurrent={!quotation.supersedesId} />
          {showArchived && quotation.archived && <ArchivedBadge />}
        </span>
        <span className="min-w-0 flex-1 sm:px-2">
          <span className="block truncate font-medium text-brand-dark">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">{sub || "—"}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-0.5">
          <span className="font-semibold text-brand-dark">{formatMinorShort(quotation.grandTotalMinor, currency)}</span>
          <span className="text-xs text-muted-foreground">{currency.code} · {crmDayOnly(quotation.quotationDate)}</span>
        </span>
        <QuotationStatusBadge status={String(quotation.status)} />
      </Link>
    </li>
  )
}

export function QuotationList({ quotations, showArchived }: { quotations: Quotation[]; showArchived?: boolean }) {
  return (
    <ul className="space-y-2">
      {quotations.map((q) => (
        <QuotationRow key={q.id} quotation={q} showArchived={showArchived} />
      ))}
    </ul>
  )
}

// ------------------------------------------------------------ pagination

export function QuotationPagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40">
          Previous
        </button>
        <span className="px-1 text-xs text-muted-foreground">
          Page {page} / {pages}
        </span>
        <button onClick={() => onPage(page + 1)} disabled={page >= pages} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40">
          Next
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------------------- history

export const QUOTATION_ACTION_LABELS: Record<string, string> = {
  created: "Quotation Created",
  edited: "Quotation Edited",
  sent: "Quotation Sent",
  resent: "Quotation Resent",
  status_changed: "Status Changed",
  revision_created: "Revision Created",
  accepted: "Quotation Accepted",
  rejected: "Quotation Rejected",
  cancelled: "Quotation Cancelled",
  archived: "Quotation Archived",
  unarchived: "Quotation Restored",
  duplicated: "Quotation Duplicated",
  email_failed: "Email Failed",
}

export function QuotationActionIcon({ action }: { action: string }) {
  const className = "h-3.5 w-3.5"
  switch (action) {
    case "created":
    case "duplicated":
      return action === "created" ? <FilePlus2 className={className} /> : <Copy className={className} />
    case "edited":
      return <Pencil className={className} />
    case "sent":
    case "resent":
      return <Send className={className} />
    case "status_changed":
      return <ArrowLeftRight className={className} />
    case "revision_created":
      return <GitBranch className={className} />
    case "accepted":
      return <CheckCircle2 className={cn(className, "text-brand-green")} />
    case "rejected":
      return <XCircle className={cn(className, "text-red-500")} />
    case "cancelled":
      return <Ban className={className} />
    case "archived":
      return <Archive className={className} />
    case "unarchived":
      return <ArchiveRestore className={className} />
    case "email_failed":
      return <MailWarning className={className} />
    default:
      return <History className={className} />
  }
}

export function QuotationHistoryList({ history }: { history: QuotationHistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleDashed className="h-4 w-4" /> No history entries yet.
      </p>
    )
  }
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {history.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border bg-white text-brand-brown">
            <QuotationActionIcon action={entry.action} />
          </span>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-medium text-brand-dark">{QUOTATION_ACTION_LABELS[entry.action] || entry.action}</span>
            <span className="text-xs text-muted-foreground">
              {crmDayOnly(entry.at)} · {crmRelativeTime(entry.at)}
            </span>
          </div>
          {entry.detail && <p className="mt-0.5 text-sm text-muted-foreground">{entry.detail}</p>}
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">
            by {entry.createdBy} · v{entry.quotationVersion}
          </p>
        </li>
      ))}
    </ol>
  )
}

// -------------------------------------------------------------- versions

export function QuotationVersionsList({
  versions,
  currentId,
  currency,
}: {
  versions: QuotationVersionRef[]
  currentId: string
  currency: Currency
}) {
  if (versions.length <= 1) return null
  return (
    <ul className="space-y-2">
      {versions.map((v) => (
        <li key={v.id}>
          <Link
            to={`/admin/quotations/${v.id}`}
            className={cn(
              "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/50",
              v.id === currentId ? "border-brand-brown/40 bg-brand-brown/5" : "",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <VersionBadge version={v.version} isCurrent={v.isCurrent} />
              <span className="truncate text-xs text-muted-foreground">{crmDayOnly(v.createdAt)}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-semibold text-brand-dark">{formatMinorShort(v.grandTotalMinor, currency)}</span>
              <QuotationStatusBadge status={v.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
