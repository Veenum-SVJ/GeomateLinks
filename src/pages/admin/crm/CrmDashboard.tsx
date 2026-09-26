// CRM overview dashboard — the action-first landing page for the CRM
// section. Summary cards on top, then the four PRD lists: Recent Leads,
// Recent Activities, Upcoming Follow-ups (overdue visually obvious) and
// Recently Converted.
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Users, UserPlus, Activity, Target, FileText, Building2, CalendarClock, Trophy, RefreshCw, ArrowRight, AlertTriangle } from "lucide-react"
import type { DashboardResult, Lead, Followup, CrmActivity } from "@/types/crm"
import { fetchCrmDashboard } from "@/lib/crmApi"
import { LeadStatusBadge, PriorityBadge, crmRelativeTime, crmDayOnly, CrmSpinner, CrmErrorState, followupWhenLabel } from "@/components/admin/crm/CrmUI"
import { ACTIVITY_TYPE_LABELS } from "@/components/admin/crm/TimelineComponents"

const cardConfig = [
  { key: "totalLeads", label: "Total Leads", icon: Users, to: "/admin/crm/leads", tone: "text-brand-brown" },
  { key: "newLeads", label: "New Leads", icon: UserPlus, to: "/admin/crm/leads?status=New", tone: "text-sky-700" },
  { key: "activeLeads", label: "Active Leads", icon: Activity, to: "/admin/crm/leads", tone: "text-brand-brown" },
  { key: "qualifiedLeads", label: "Qualified Leads", icon: Target, to: "/admin/crm/leads?status=Qualified", tone: "text-brand-green" },
  { key: "quotationsPending", label: "Quotations Pending", icon: FileText, to: "/admin/crm/leads?status=Quotation%20Sent", tone: "text-amber-700" },
  { key: "activeClients", label: "Active Clients", icon: Building2, to: "/admin/crm/clients", tone: "text-brand-green" },
  { key: "followupsDue", label: "Follow-ups Due", icon: CalendarClock, to: "/admin/crm/followups", tone: "text-amber-700" },
  { key: "projectsWon", label: "Projects Won", icon: Trophy, to: "/admin/crm/leads?status=Won", tone: "text-brand-green" },
] as const

function LeadRow({ lead }: { lead: Lead }) {
  return (
    <Link to={`/admin/crm/leads/${lead.id}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 hover:bg-muted/50">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-brand-dark">{lead.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[lead.service?.title, lead.location].filter(Boolean).join(" · ") || lead.code}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <LeadStatusBadge status={lead.status} />
        <span className="text-[11px] text-muted-foreground">{crmRelativeTime(lead.createdAt)}</span>
      </div>
    </Link>
  )
}

function FollowupRow({ f }: { f: Followup }) {
  const overdue = f.status === "Pending" && f.date < new Date().toISOString().slice(0, 10)
  const href = f.relatedType === "lead" ? `/admin/crm/leads/${f.relatedId}` : `/admin/crm/clients/${f.relatedId}`
  return (
    <Link to={href} className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 hover:bg-muted/50 ${overdue ? "border-red-200 bg-red-50" : ""}`}>
      <div className="min-w-0">
        <p className={`truncate text-sm font-medium ${overdue ? "text-red-700" : "text-brand-dark"}`}>{f.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {f.relatedCode || f.relatedType} · {followupWhenLabel(f)}
          {f.time ? ` · ${f.time}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <PriorityBadge priority={f.priority} />
        {overdue && <AlertTriangle className="h-4 w-4 text-red-500" aria-label="Overdue" />}
      </div>
    </Link>
  )
}

export default function CrmDashboard() {
  const [data, setData] = useState<DashboardResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setData(await fetchCrmDashboard())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the CRM dashboard")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM Overview</h1>
          <p className="text-sm text-muted-foreground">Leads, clients and follow-ups at a glance.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && <CrmErrorState message={error} onRetry={load} />}
      {loading && !data && <CrmSpinner />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cardConfig.map(({ key, label, icon: Icon, to, tone }) => (
              <Link key={key} to={to} className="rounded-lg border bg-white px-4 py-3.5 hover:border-brand-brown/30 hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
                  <Icon className={`h-4 w-4 ${tone}`} />
                </div>
                <p className={`mt-1 text-2xl font-semibold ${data.cards[key] > 0 ? "text-brand-dark" : "text-muted-foreground"}`}>{data.cards[key]}</p>
              </Link>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-brand-dark">Recent Leads</h2>
                <Link to="/admin/crm/leads" className="inline-flex items-center gap-1 text-xs font-medium text-brand-brown hover:underline">
                  All leads <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2 p-4">
                {data.recentLeads.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No leads yet. Website inquiries will appear here automatically.</p>
                ) : (
                  data.recentLeads.map((lead) => <LeadRow key={lead.id} lead={lead} />)
                )}
              </div>
            </section>

            <section className="rounded-lg border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-brand-dark">Recent Activities</h2>
                <Link to="/admin/crm/activities" className="inline-flex items-center gap-1 text-xs font-medium text-brand-brown hover:underline">
                  All activities <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2.5 p-4">
                {data.recentActivities.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
                ) : (
                  data.recentActivities.slice(0, 6).map((activity: CrmActivity) => (
                    <div key={activity.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <p className="min-w-0 truncate">
                        <span className="font-medium text-brand-dark">{ACTIVITY_TYPE_LABELS[activity.type] || activity.type}</span>
                        {activity.ownerCode && <span className="text-muted-foreground"> · {activity.ownerCode}</span>}
                        {activity.description && <span className="text-muted-foreground"> — {activity.description}</span>}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">{crmRelativeTime(activity.at)}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-brand-dark">Upcoming Follow-ups</h2>
                <Link to="/admin/crm/followups" className="inline-flex items-center gap-1 text-xs font-medium text-brand-brown hover:underline">
                  All follow-ups <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-4 p-4">
                {(
                  [
                    ["Overdue", data.upcomingFollowups.overdue],
                    ["Today", data.upcomingFollowups.today],
                    ["Tomorrow", data.upcomingFollowups.tomorrow],
                    ["Upcoming", data.upcomingFollowups.upcoming],
                  ] as const
                ).map(([label, list]) =>
                  list.length === 0 ? null : (
                    <div key={label}>
                      <p className={`mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${label === "Overdue" ? "text-red-600" : "text-muted-foreground"}`}>
                        {label} ({list.length})
                      </p>
                      <div className="space-y-2">
                        {list.map((f) => (
                          <FollowupRow key={f.id} f={f} />
                        ))}
                      </div>
                    </div>
                  ),
                )}
                {data.upcomingFollowups.overdue.length === 0 &&
                  data.upcomingFollowups.today.length === 0 &&
                  data.upcomingFollowups.tomorrow.length === 0 &&
                  data.upcomingFollowups.upcoming.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">Nothing scheduled. Follow-ups you create will appear here.</p>
                  )}
              </div>
            </section>

            <section className="rounded-lg border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-brand-dark">Recently Converted</h2>
                <Link to="/admin/crm/clients" className="inline-flex items-center gap-1 text-xs font-medium text-brand-brown hover:underline">
                  All clients <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2 p-4">
                {data.recentlyConverted.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No conversions yet. Convert a won lead from its profile.</p>
                ) : (
                  data.recentlyConverted.map((lead) => (
                    <Link key={lead.id} to={`/admin/crm/leads/${lead.id}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-brand-dark">{lead.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {lead.code}
                          {lead.company ? ` · ${lead.company}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{lead.convertedAt ? `Converted ${crmDayOnly(lead.convertedAt)}` : ""}</span>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
