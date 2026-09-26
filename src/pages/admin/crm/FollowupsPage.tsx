// Follow-ups management: grouped Overdue / Today / Tomorrow / Upcoming with
// status filters, quick complete/cancel, and links to the related lead or
// client. Overdue rows are visually obvious (red) per the PRD.
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { CalendarClock, CheckCircle2, XCircle, ChevronRight } from "lucide-react"
import { FOLLOWUP_STATUSES } from "@/types/crm"
import type { Followup } from "@/types/crm"
import { fetchFollowups, updateFollowup } from "@/lib/crmApi"
import { PriorityBadge, CrmSpinner, CrmErrorState, CrmEmptyState, followupWhenLabel, FollowupStatusBadge } from "@/components/admin/crm/CrmUI"

const today = () => new Date().toISOString().slice(0, 10)

function groupOf(f: Followup): "overdue" | "today" | "tomorrow" | "upcoming" | "done" {
  if (f.status !== "Pending") return "done"
  const t = today()
  if (f.date < t) return "overdue"
  if (f.date === t) return "today"
  if (f.date === new Date(Date.now() + 86400000).toISOString().slice(0, 10)) return "tomorrow"
  return "upcoming"
}

export default function FollowupsPage() {
  const [statusFilter, setStatusFilter] = useState("Pending")
  const [followups, setFollowups] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = statusFilter === "Pending" ? { status: "Pending" } : statusFilter ? { status: statusFilter } : {}
      setFollowups(await fetchFollowups(params).then((r) => r.followups))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load follow-ups")
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const patch = async (id: string, status: string) => {
    setBusyId(id)
    setError("")
    try {
      await updateFollowup(id, { status })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the follow-up")
    } finally {
      setBusyId("")
    }
  }

  const groups: { key: ReturnType<typeof groupOf>; label: string; accent?: string }[] = [
    { key: "overdue", label: "Overdue", accent: "text-red-600" },
    { key: "today", label: "Today" },
    { key: "tomorrow", label: "Tomorrow" },
    { key: "upcoming", label: "Upcoming" },
    { key: "done", label: "Completed / Cancelled" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">Scheduled call-backs and tasks across every lead and client.</p>
        </div>
        <select aria-label="Status filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2.5 text-sm sm:text-base">
          {["Pending", ...FOLLOWUP_STATUSES.filter((s) => s !== "Pending"), "All"].map((s) => (
            <option key={s} value={s === "All" ? "" : s}>{s}</option>
          ))}
        </select>
      </div>

      {error && <CrmErrorState message={error} onRetry={load} />}
      {loading && followups.length === 0 && <CrmSpinner />}

      {!loading && followups.length === 0 && (
        <CrmEmptyState
          icon={<CalendarClock className="h-8 w-8" />}
          title="No follow-ups here"
          description="Schedule them from any lead or client profile, or from the CRM dashboard."
        />
      )}

      {followups.length > 0 && (
        <div className="space-y-5">
          {groups.map(({ key, label, accent }) => {
            const list = followups.filter((f) => groupOf(f) === key)
            if (list.length === 0) return null
            return (
              <section key={key}>
                <p className={`mb-2 font-mono text-xs font-semibold uppercase tracking-wider ${accent || "text-muted-foreground"}`}>
                  {label} ({list.length})
                </p>
                <div className="space-y-2">
                  {list.map((f) => {
                    const overdue = key === "overdue"
                    const href = f.relatedType === "lead" ? `/admin/crm/leads/${f.relatedId}` : `/admin/crm/clients/${f.relatedId}`
                    return (
                      <div key={f.id} className={`flex flex-col gap-2 rounded-lg border bg-white px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between ${overdue ? "border-red-200 bg-red-50" : ""}`}>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-sm font-medium ${overdue ? "text-red-700" : "text-brand-dark"}`}>{f.title}</span>
                            <FollowupStatusBadge status={f.status} />
                            <PriorityBadge priority={f.priority} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {followupWhenLabel(f)}
                            {f.time ? ` · ${f.time}` : ""}
                            {f.description ? ` · ${f.description}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Link to={href} className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-brown hover:underline">
                            {f.relatedCode || f.relatedType} <ChevronRight className="h-3 w-3" />
                          </Link>
                          {f.status === "Pending" && (
                            <>
                              <button onClick={() => patch(f.id, "Completed")} disabled={busyId === f.id} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium text-brand-green hover:bg-brand-green/5 disabled:opacity-40">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                              </button>
                              <button onClick={() => patch(f.id, "Cancelled")} disabled={busyId === f.id} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40">
                                <XCircle className="h-3.5 w-3.5" /> Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
