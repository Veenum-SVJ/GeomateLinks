// Global activity feed across all leads and clients, filterable by activity
// type and lead/client ownership.
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { History } from "lucide-react"
import { ACTIVITY_TYPES } from "@/types/crm"
import type { CrmActivity } from "@/types/crm"
import { fetchCrmActivities } from "@/lib/crmApi"
import { CrmSpinner, CrmErrorState, CrmEmptyState, crmRelativeTime, crmDay } from "@/components/admin/crm/CrmUI"
import { ACTIVITY_TYPE_LABELS } from "@/components/admin/crm/TimelineComponents"

const selectClass = "h-10 rounded-md border border-input bg-background px-2.5 text-sm sm:text-base"

export default function ActivitiesPage() {
  const [type, setType] = useState("")
  const [ownerType, setOwnerType] = useState("")
  const [activities, setActivities] = useState<CrmActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const queryKey = JSON.stringify({ type, ownerType })
  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = JSON.parse(queryKey) as { type?: string; ownerType?: string }
      if (!params.type) delete params.type
      if (!params.ownerType) delete params.ownerType
      setActivities(await fetchCrmActivities({ ...params, limit: 100 }).then((r) => r.activities))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load activities")
    } finally {
      setLoading(false)
    }
  }, [queryKey])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activities</h1>
          <p className="text-sm text-muted-foreground">Every call, email, note and status change across the CRM.</p>
        </div>
        <div className="flex gap-2">
          <select aria-label="Activity type filter" value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
            <option value="">All types</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t] || t}</option>
            ))}
          </select>
          <select aria-label="Owner filter" value={ownerType} onChange={(e) => setOwnerType(e.target.value)} className={selectClass}>
            <option value="">Leads & clients</option>
            <option value="lead">Leads only</option>
            <option value="client">Clients only</option>
          </select>
        </div>
      </div>

      {error && <CrmErrorState message={error} onRetry={load} />}
      {loading && activities.length === 0 && <CrmSpinner />}

      {!loading && activities.length === 0 ? (
        <CrmEmptyState icon={<History className="h-8 w-8" />} title="No activities yet" description="Log calls, meetings and notes from any lead or client profile." />
      ) : (
        <div className="rounded-lg border bg-white p-4">
          {activities.map((a) => (
            <div key={a.id} className="border-b py-3 first:pt-0 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="min-w-0 text-sm">
                  <span className="font-medium text-brand-dark">{ACTIVITY_TYPE_LABELS[a.type] || a.type}</span>
                  {a.ownerCode && (
                    <Link to={a.ownerType === "lead" ? `/admin/crm/leads/${a.ownerId}` : `/admin/crm/clients/${a.ownerId}`} className="ml-2 text-xs font-medium text-brand-brown hover:underline">
                      {a.ownerCode}
                    </Link>
                  )}
                  {a.description && <span className="text-muted-foreground"> — {a.description}</span>}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground" title={new Date(a.at).toLocaleString()}>
                  {crmDay(a.at)} · {crmRelativeTime(a.at)}
                </span>
              </div>
            </div>
          ))}
          {activities.length >= 100 && <p className="pt-3 text-center text-xs text-muted-foreground">Showing the 100 most recent activities.</p>}
        </div>
      )}
    </div>
  )
}
