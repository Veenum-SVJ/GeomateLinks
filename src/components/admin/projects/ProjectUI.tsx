// Shared project admin UI primitives — badges, progress bar, list rows,
// pagination and the timeline. Follows the QMS/CRM design language (brand
// brown primary, green accent, rounded cards) so PMS reads as part of the
// same CMS. Unlike the older CRM/QMS tone maps (which pass bare color words
// that resolve to no CSS), these badges carry full Tailwind class strings.
import { Link } from "react-router-dom"
import {
  FolderKanban, Pencil, ArrowLeftRight, CheckCircle2, Archive,
  ArchiveRestore, Globe, EyeOff, UserPlus, UserMinus, ListPlus, ListChecks,
  Flag, Truck, Coins, History, CircleDashed, MapPin,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatMinorShort } from "@/lib/money"
import { crmRelativeTime, crmDayOnly } from "@/components/admin/crm/CrmUI"
import type { Currency, Project, ProjectHistoryEntry, ProjectActivityEntry, StaffMember } from "@/types/projects"

// ----------------------------------------------------------------- badges

type ToneClasses = string

export const PROJECT_STATUS_TONES: Record<string, ToneClasses> = {
  Planning: "border-blue-200 bg-blue-50 text-blue-700",
  Scheduled: "border-sky-200 bg-sky-50 text-sky-700",
  "Field Work": "border-amber-200 bg-amber-50 text-amber-700",
  Processing: "border-violet-200 bg-violet-50 text-violet-700",
  "Quality Control": "border-purple-200 bg-purple-50 text-purple-700",
  "Awaiting Delivery": "border-cyan-200 bg-cyan-50 text-cyan-700",
  Completed: "border-green-200 bg-green-50 text-green-700",
  "On Hold": "border-orange-200 bg-orange-50 text-orange-700",
  Cancelled: "border-red-200 bg-red-50 text-red-700",
  Archived: "border-border bg-muted text-muted-foreground",
}

export function ProjectStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", PROJECT_STATUS_TONES[status] || "border-border bg-muted text-muted-foreground")}>
      {status}
    </span>
  )
}

export function ProjectPriorityBadge({ priority }: { priority: string }) {
  if (!priority || priority === "Normal") return null
  const tones: Record<string, string> = {
    Low: "border-border bg-muted text-muted-foreground",
    High: "border-amber-200 bg-amber-50 text-amber-700",
    Urgent: "border-red-200 bg-red-50 text-red-700",
  }
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", tones[priority] || "border-border bg-muted text-muted-foreground")}>
      {priority}
    </span>
  )
}

export function TaskStatusBadge({ status }: { status: string }) {
  const tones: Record<string, string> = {
    "Not Started": "border-border bg-muted text-muted-foreground",
    "In Progress": "border-amber-200 bg-amber-50 text-amber-700",
    Completed: "border-green-200 bg-green-50 text-green-700",
    Blocked: "border-red-200 bg-red-50 text-red-700",
    Cancelled: "border-border bg-muted text-muted-foreground line-through",
  }
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-semibold", tones[status] || "border-border bg-muted text-muted-foreground")}>
      {status}
    </span>
  )
}

export function SimpleStatusBadge({ status }: { status: string }) {
  const tones: Record<string, string> = {
    Upcoming: "border-border bg-muted text-muted-foreground",
    "In Progress": "border-amber-200 bg-amber-50 text-amber-700",
    Completed: "border-green-200 bg-green-50 text-green-700",
    Overdue: "border-red-200 bg-red-50 text-red-700",
    Pending: "border-border bg-muted text-muted-foreground",
    Ready: "border-cyan-200 bg-cyan-50 text-cyan-700",
    Delivered: "border-green-200 bg-green-50 text-green-700",
    Active: "border-green-200 bg-green-50 text-green-700",
    Inactive: "border-border bg-muted text-muted-foreground",
  }
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-semibold", tones[status] || "border-border bg-muted text-muted-foreground")}>
      {status}
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

export function PublishedBadge() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-brand-green/25 bg-brand-green/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-green">
      <Globe className="h-3 w-3" /> On Portfolio
    </span>
  )
}

// ---------------------------------------------------------------- progress

export function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, Math.round(pct)))
  const color = clamped >= 100 ? "bg-brand-green" : clamped >= 75 ? "bg-green-500" : clamped >= 40 ? "bg-brand-brown" : "bg-amber-500"
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 min-w-[80px] flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-xs font-semibold text-brand-dark">{clamped}%</span>
    </div>
  )
}

// ---------------------------------------------------------------- list row

export function ProjectRow({ project, showArchived }: { project: Project; showArchived?: boolean }) {
  const label = project.client.company || project.client.name
  const sub = [project.location.city, project.location.state].filter(Boolean).join(", ") || project.service.title
  return (
    <li>
      <Link
        to={`/admin/pms/${project.id}`}
        className="flex flex-col gap-1.5 rounded-md border px-3 py-2.5 text-sm hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-xs font-semibold text-brand-brown">{project.number}</span>
          {showArchived && project.archived && <ArchivedBadge />}
          {project.publication?.published && <PublishedBadge />}
        </span>
        <span className="min-w-0 flex-1 sm:px-2">
          <span className="block truncate font-medium text-brand-dark">{project.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {label}
            {sub ? ` · ${sub}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 sm:w-32">
          <ProgressBar pct={project.progressPct} className="flex-1" />
        </span>
        <span className="hidden shrink-0 text-xs text-muted-foreground lg:block">
          {project.expectedCompletionDate ? crmDayOnly(project.expectedCompletionDate) : "—"}
        </span>
        <ProjectStatusBadge status={String(project.status)} />
      </Link>
    </li>
  )
}

export function ProjectMiniRow({ project }: { project: Project }) {
  return (
    <li>
      <Link to={`/admin/pms/${project.id}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
        <span className="min-w-0">
          <span className="block truncate font-medium text-brand-dark">
            {project.number} — {project.title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {project.client.company || project.client.name}
            {project.expectedCompletionDate ? ` · due ${crmDayOnly(project.expectedCompletionDate)}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="hidden w-24 sm:block">
            <ProgressBar pct={project.progressPct} />
          </span>
          <ProjectStatusBadge status={String(project.status)} />
        </span>
      </Link>
    </li>
  )
}

// ------------------------------------------------------------- pagination

export function ProjectPagination({
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

// ---------------------------------------------------------------- timeline

export const PROJECT_HISTORY_LABELS: Record<string, string> = {
  created: "Project Created",
  edited: "Project Edited",
  status_changed: "Status Changed",
  progress_updated: "Progress Updated",
  completed: "Project Completed",
  archived: "Project Archived",
  restored: "Project Restored",
  published: "Published to Portfolio",
  unpublished: "Removed from Portfolio",
  team_added: "Team Member Added",
  team_removed: "Team Member Removed",
  task_created: "Task Created",
  task_updated: "Task Updated",
  task_completed: "Task Completed",
  milestone_completed: "Milestone Completed",
  deliverable_updated: "Deliverable Updated",
}

export function ProjectHistoryList({ history }: { history: ProjectHistoryEntry[] }) {
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
            <ProjectActionIcon action={entry.action} />
          </span>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-medium text-brand-dark">{PROJECT_HISTORY_LABELS[entry.action] || entry.action}</span>
            <span className="text-xs text-muted-foreground">
              {crmDayOnly(entry.at)} · {crmRelativeTime(entry.at)}
            </span>
          </div>
          {entry.detail && <p className="mt-0.5 text-sm text-muted-foreground">{entry.detail}</p>}
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">by {entry.createdBy}</p>
        </li>
      ))}
    </ol>
  )
}

export function ProjectActionIcon({ action }: { action: string }) {
  const className = "h-3.5 w-3.5"
  switch (action) {
    case "created":
      return <FolderKanban className={className} />
    case "edited":
      return <Pencil className={className} />
    case "status_changed":
      return <ArrowLeftRight className={className} />
    case "progress_updated":
      return <ListChecks className={className} />
    case "completed":
      return <CheckCircle2 className={cn(className, "text-brand-green")} />
    case "archived":
      return <Archive className={className} />
    case "restored":
      return <ArchiveRestore className={className} />
    case "published":
      return <Globe className={className} />
    case "unpublished":
      return <EyeOff className={className} />
    case "team_added":
      return <UserPlus className={className} />
    case "team_removed":
      return <UserMinus className={className} />
    case "task_created":
      return <ListPlus className={className} />
    case "task_updated":
      return <Pencil className={className} />
    case "task_completed":
      return <ListChecks className={cn(className, "text-brand-green")} />
    case "milestone_completed":
      return <Flag className={cn(className, "text-brand-green")} />
    case "deliverable_updated":
      return <Truck className={className} />
    default:
      return <History className={className} />
  }
}

// Cross-project activity feed (dashboard) — entries carry the project number.
export function ProjectActivityList({ activities }: { activities: ProjectActivityEntry[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">No project activity yet.</p>
  }
  return (
    <ul className="space-y-2">
      {activities.map((a) => (
        <li key={a.id}>
          <Link to={`/admin/pms/${a.projectId}`} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
            <span className="min-w-0">
              <span className="block truncate font-medium text-brand-dark">
                <span className="font-mono text-xs text-brand-brown">{a.projectNumber}</span> · {a.description}
              </span>
              <span className="block text-xs text-muted-foreground">
                {crmDayOnly(a.at)} · {crmRelativeTime(a.at)} · by {a.createdBy}
              </span>
            </span>
            {a.progressPct !== null && a.progressPct !== undefined && (
              <span className="shrink-0 font-mono text-xs font-semibold text-brand-dark">{a.progressPct}%</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

// ------------------------------------------------------------- staff picker

export function StaffPickerList({
  staff,
  onPick,
}: {
  staff: StaffMember[]
  onPick: (member: StaffMember) => void
}) {
  if (staff.length === 0) {
    return (
      <p className="py-3 text-center text-sm text-muted-foreground">
        No staff in the directory yet — add team members in the Team Directory first.
      </p>
    )
  }
  return (
    <div className="max-h-64 space-y-1.5 overflow-y-auto">
      {staff.map((member) => (
        <button
          key={member.id}
          type="button"
          onClick={() => onPick(member)}
          className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-medium text-brand-dark">{member.name}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{member.role || "—"}</span>
          </span>
          {member.specialization && <span className="block truncate text-xs text-muted-foreground">{member.specialization}</span>}
        </button>
      ))}
    </div>
  )
}

// ------------------------------------------------------------- value label

export function formatQuotedValue(minor: number, currency: Currency): string {
  if (!minor) return "—"
  return formatMinorShort(minor, currency)
}

export function ProjectLocationLine({ project }: { project: Project }) {
  const parts = [project.location.address, project.location.area, project.location.city, project.location.state, project.location.country].filter(Boolean)
  return (
    <span className="inline-flex items-center gap-1.5">
      <MapPin className="h-3.5 w-3.5 text-brand-brown" />
      {parts.length > 0 ? parts.join(", ") : project.location.description || "—"}
    </span>
  )
}

export function QuotedValue({ project }: { project: Project }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Coins className="h-3.5 w-3.5 text-brand-brown" />
      {formatMinorShort(project.quotedValueMinor, project.currency)}
    </span>
  )
}
