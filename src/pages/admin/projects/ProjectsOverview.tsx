// Projects overview: status cards, requiring-attention alerts (overdue,
// deadline soon, stalled, overdue tasks/milestones), upcoming deadlines,
// recent projects, recent activity across projects, recently completed.
import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Plus, AlertTriangle, CalendarClock, CheckCircle2, Clock3, FolderKanban, Users,
} from "lucide-react"
import { fetchProjectDashboard } from "@/lib/projectsApi"
import { CrmSpinner, CrmErrorState, CrmEmptyState } from "@/components/admin/crm/CrmUI"
import { ProjectMiniRow, ProjectActivityList, ProjectStatusBadge, ProgressBar } from "@/components/admin/projects/ProjectUI"
import type { ProjectDashboardResult, Project } from "@/types/projects"

export default function ProjectsOverview() {
  const navigate = useNavigate()
  const [data, setData] = useState<ProjectDashboardResult | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setError("")
    try {
      setData(await fetchProjectDashboard())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load projects")
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const isEmpty = data && data.cards.total === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-dark">Project Management</h1>
          <p className="text-sm text-muted-foreground">Every engagement, from accepted quotation to delivery.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/pms/staff"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Users className="h-4 w-4" /> Team Directory
          </Link>
          <button
            onClick={() => navigate("/admin/pms/new")}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90"
          >
            <Plus className="h-4 w-4" /> Create Project
          </button>
        </div>
      </div>

      {error && <CrmErrorState message={error} onRetry={load} />}
      {!data && !error && <CrmSpinner />}

      {isEmpty && (
        <CrmEmptyState
          icon={<FolderKanban className="h-8 w-8" />}
          title="No projects yet"
          description="Create your first project from an accepted quotation — client, lead, service, location and quoted value come across automatically — or start one manually."
          actionLabel="Create Project"
          onAction={() => navigate("/admin/pms/new")}
        />
      )}

      {data && !isEmpty && (
        <>
          {/* Cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
            {(
              [
                ["Total", data.cards.total, "/admin/pms/all", "text-brand-dark"],
                ["Active", data.cards.active, "/admin/pms/all", "text-brand-brown"],
                ["Planning", data.cards.planning, "/admin/pms/list/Planning", "text-blue-600"],
                ["Field Work", data.cards.fieldWork, "/admin/pms/list/Field%20Work", "text-amber-600"],
                ["Processing", data.cards.processing, "/admin/pms/list/Processing", "text-violet-600"],
                ["Quality Control", data.cards.qualityControl, "/admin/pms/list/Quality%20Control", "text-purple-600"],
                ["Awaiting Del.", data.cards.awaitingDelivery, "/admin/pms/list/Awaiting%20Delivery", "text-cyan-600"],
                ["Completed", data.cards.completed, "/admin/pms/list/Completed", "text-brand-green"],
              ] as const
            ).map(([label, value, href, tone]) => (
              <Link key={label} to={href} className="rounded-lg border bg-white px-4 py-3.5 transition-colors hover:bg-muted/40">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
                <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
              </Link>
            ))}
          </div>

          {data.cards.overdue > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">
                <span className="font-semibold">{data.cards.overdue} project{data.cards.overdue === 1 ? "" : "s"} past expected completion.</span>{" "}
                <Link to="/admin/pms/all?sort=deadline" className="underline underline-offset-2">
                  Review deadlines →
                </Link>
              </p>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Requiring attention */}
            <section className="rounded-lg border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Projects Requiring Attention
                </h2>
              </div>
              <div className="p-4">
                {data.requiringAttention.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.requiringAttention.map((p) => (
                      <li key={`attention-${p.id}`}>
                        <AttentionRow project={p} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Upcoming deadlines */}
            <section className="rounded-lg border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
                  <CalendarClock className="h-3.5 w-3.5 text-brand-brown" /> Upcoming Deadlines
                </h2>
                <Link to="/admin/pms/all?sort=deadline" className="text-xs font-medium text-brand-brown hover:underline">
                  View all
                </Link>
              </div>
              <div className="p-4">
                {data.upcomingDeadlines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active projects with an expected completion date.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.upcomingDeadlines.map((p) => (
                      <li key={`deadline-${p.id}`}>
                        <ProjectMiniRow project={p} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Recent projects */}
            <section className="rounded-lg border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-brand-dark">Recent Projects</h2>
                <Link to="/admin/pms/all" className="text-xs font-medium text-brand-brown hover:underline">
                  View all
                </Link>
              </div>
              <div className="p-4">
                {data.recentProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.recentProjects.map((p) => (
                      <li key={`recent-${p.id}`}>
                        <ProjectMiniRow project={p} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Recent activity across projects */}
            <section className="rounded-lg border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
                  <Clock3 className="h-3.5 w-3.5 text-brand-brown" /> Recent Activity
                </h2>
              </div>
              <div className="p-4">
                <ProjectActivityList activities={data.recentActivity} />
              </div>
            </section>

            {/* Recently completed */}
            <section className="rounded-lg border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" /> Recently Completed
                </h2>
              </div>
              <div className="p-4">
                {data.recentlyCompleted.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No completed projects yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.recentlyCompleted.map((p) => (
                      <li key={`completed-${p.id}`}>
                        <ProjectMiniRow project={p} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

// Alert rows show the specific reason a project needs attention.
function AttentionRow({ project }: { project: Project }) {
  const reasons: string[] = []
  if (project.computed?.isOverdue) reasons.push("Past expected completion")
  if (project.computed?.isDueSoon) reasons.push("Deadline within 14 days")
  if (project.computed?.isStalled) reasons.push("No activity for 21+ days")
  if ((project.computed?.tasksOverdue ?? 0) > 0) reasons.push(`${project.computed?.tasksOverdue} overdue task${project.computed?.tasksOverdue === 1 ? "" : "s"}`)
  if ((project.computed?.milestonesOverdue ?? 0) > 0) reasons.push(`${project.computed?.milestonesOverdue} overdue milestone${project.computed?.milestonesOverdue === 1 ? "" : "s"}`)
  return (
    <Link to={`/admin/pms/${project.id}`} className="flex flex-col gap-1.5 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-sm hover:bg-amber-50 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="min-w-0">
        <span className="block truncate font-medium text-brand-dark">
          <span className="font-mono text-xs text-brand-brown">{project.number}</span> — {project.title}
        </span>
        <span className="block truncate text-xs text-amber-700">{reasons.join(" · ")}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="hidden w-24 sm:block">
          <ProgressBar pct={project.progressPct} />
        </span>
        <ProjectStatusBadge status={String(project.status)} />
      </span>
    </Link>
  )
}
