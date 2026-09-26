// Project detail: header (status, progress, quick actions) + tabbed body —
// Overview, Tasks, Milestones, Team, Timeline, Deliverables, Location,
// Quotation & Client links. Completion shows the outstanding lists before
// you confirm; publishing goes through the existing admin content flow so
// nothing becomes public automatically.
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { createPortal } from "react-dom"
import {
  ArrowLeft, Pencil, Archive, ArchiveRestore, CheckCircle2, Globe, EyeOff, Plus, Trash2,
  Users, Building2, ReceiptText, MapPin, ExternalLink, Loader2, AlertTriangle, Flag, ListTodo,
  Truck, History, MessageSquarePlus, Star, Info, Ban,
} from "lucide-react"
import {
  fetchProject, changeProjectStatus, updateProjectProgress, completeProject, setProjectArchived, updateProject,
  addProjectTask, updateProjectTask, removeProjectTask,
  addProjectMilestone, updateProjectMilestone, removeProjectMilestone,
  addProjectDeliverable, updateProjectDeliverable, removeProjectDeliverable,
  addProjectTeamMember, removeProjectTeamMember, setProjectManager,
  addProjectActivity, publishProject, unpublishProject,
  fetchStaff,
} from "@/lib/projectsApi"
import { fetchContent, saveContent, fetchMedia } from "@/lib/api"
import { formatMinor } from "@/lib/money"
import { crmDayOnly, crmRelativeTime, CrmSpinner, CrmErrorState, CrmEmptyState, CrmConfirmDialog } from "@/components/admin/crm/CrmUI"
import {
  ProjectStatusBadge, ProjectPriorityBadge, TaskStatusBadge, SimpleStatusBadge, ArchivedBadge,
  PublishedBadge, ProgressBar,
} from "@/components/admin/projects/ProjectUI"
import type { ProjectDetailResult } from "@/types/projects"
import type { Project, StaffMember, TaskStatus } from "@/types/projects"
import { PROJECT_STATUSES } from "@/types/projects"
import { cn } from "@/lib/utils"

const TABS = ["Overview", "Tasks", "Milestones", "Team", "Timeline", "Deliverables", "Location", "Links"] as const
type Tab = (typeof TABS)[number]

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ProjectDetailResult | null>(null)
  const [error, setError] = useState("")
  const [actionError, setActionError] = useState("")
  const [tab, setTab] = useState<Tab>("Overview")
  const [confirm, setConfirm] = useState<null | { title: string; description: string; confirmLabel: string; run: () => Promise<void> }>(null)

  const [statusOpen, setStatusOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setError("")
    try {
      setDetail(await fetchProject(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the project")
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (error && !detail) return <CrmErrorState message={error} onRetry={load} />
  if (!detail) return <CrmSpinner />

  const p = detail.project
  const c = p.computed
  const isArchived = p.archived
  const isCompleted = p.status === "Completed"

  return (
    <div className="space-y-4">
      <Link to="/admin/pms/all" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All projects
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Project {p.number}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-brand-dark">{p.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={String(p.status)} />
            <ProjectPriorityBadge priority={p.priority} />
            {isArchived && <ArchivedBadge />}
            {p.publication.published && <PublishedBadge />}
            {p.currentPhase && <span className="text-xs text-muted-foreground">Phase: {p.currentPhase}</span>}
            {p.expectedCompletionDate && (
              <span className={cn("text-xs", c?.isOverdue ? "font-semibold text-red-600" : "text-muted-foreground")}>
                due {crmDayOnly(p.expectedCompletionDate)}
              </span>
            )}
          </div>
          <div className="mt-3 max-w-md">
            <ProgressBar pct={p.progressPct} />
            {!p.progressOverridden && <p className="mt-1 text-[11px] text-muted-foreground">Progress follows the status default — override it any time.</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {!isCompleted && !isArchived && p.status !== "Cancelled" && (
            <button
              onClick={() => setCompleteOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-green px-3 py-2 text-sm font-semibold text-white hover:bg-brand-green/90"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark Completed
            </button>
          )}
          <button onClick={() => setStatusOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            Status
          </button>
          <button onClick={() => setProgressOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            Progress
          </button>
          <button onClick={() => navigate(`/admin/pms/${p.id}/edit`)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          {isCompleted && (
            p.publication.published ? (
              <button
                onClick={() => setConfirm({
                  title: "Remove from the public portfolio?",
                  description: "The project stays complete and searchable internally — only the public portfolio entry is removed.",
                  confirmLabel: "Unpublish",
                  run: async () => {
                    await unpublishFromSite(p)
                    await unpublishProject(p.id)
                    await load()
                  },
                })}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <EyeOff className="h-3.5 w-3.5" /> Unpublish
              </button>
            ) : (
              <button onClick={() => setPublishOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-brand-green/30 bg-brand-green/5 px-3 py-2 text-sm font-semibold text-brand-green hover:bg-brand-green/10">
                <Globe className="h-3.5 w-3.5" /> Publish to Website
              </button>
            )
          )}
          <button
            onClick={() =>
              setConfirm({
                title: isArchived ? "Restore project" : "Archive project",
                description: isArchived
                  ? "The project returns to the active lists."
                  : "Archived projects stay searchable for record keeping but leave the active lists. There is no delete in the interface.",
                confirmLabel: isArchived ? "Restore" : "Archive",
                run: async () => {
                  await setProjectArchived(p.id, !isArchived)
                  await load()
                },
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            {isArchived ? "Restore" : "Archive"}
          </button>
        </div>
      </div>

      {actionError && <CrmErrorState message={actionError} onRetry={() => setActionError("")} />}

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "inline-flex whitespace-nowrap px-4 py-2.5 text-sm font-medium",
              tab === t ? "border-b-2 border-brand-brown text-brand-brown" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
            {t === "Tasks" && (c?.tasksOpen ?? 0) > 0 && <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px]">{c?.tasksOpen}</span>}
            {(t === "Tasks" || t === "Milestones" || t === "Deliverables") && ((t === "Milestones" && (c?.milestonesOverdue ?? 0) > 0) || (t === "Deliverables" && (c?.deliverablesPending ?? 0) > 0)) && (
              <AlertTriangle className="ml-1 h-3 w-3 text-amber-500" />
            )}
          </button>
        ))}
      </div>

      {/* Tab body */}
      {tab === "Overview" && <OverviewTab project={p} />}
      {tab === "Tasks" && <TasksTab project={p} onChanged={load} onError={setActionError} />}
      {tab === "Milestones" && <MilestonesTab project={p} onChanged={load} onError={setActionError} />}
      {tab === "Team" && <TeamTab project={p} onChanged={load} onError={setActionError} />}
      {tab === "Timeline" && <TimelineTab detail={detail} onChanged={load} onError={setActionError} />}
      {tab === "Deliverables" && <DeliverablesTab project={p} onChanged={load} onError={setActionError} />}
      {tab === "Location" && <LocationTab project={p} onChanged={load} onError={setActionError} />}
      {tab === "Links" && <LinksTab project={p} />}

      {/* Dialogs */}
      <StatusDialog open={statusOpen} project={p} onClose={() => setStatusOpen(false)} onSaved={() => { setStatusOpen(false); load() }} />
      <ProgressDialog open={progressOpen} project={p} onClose={() => setProgressOpen(false)} onSaved={() => { setProgressOpen(false); load() }} />
      <CompleteDialog open={completeOpen} project={p} onClose={() => setCompleteOpen(false)} onSaved={() => { setCompleteOpen(false); load() }} />
      <PublishDialog open={publishOpen} project={p} onClose={() => setPublishOpen(false)} onSaved={() => { setPublishOpen(false); load() }} />
      <CrmConfirmDialog
        open={confirm !== null}
        title={confirm?.title || ""}
        description={confirm?.description || ""}
        confirmLabel={confirm?.confirmLabel}
        onConfirm={() => {
          const run = confirm?.run
          setConfirm(null)
          run?.().catch((err) => setActionError(err instanceof Error ? err.message : "Action failed"))
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

// ------------------------------------------------------------------ tabs

function OverviewTab({ project: p }: { project: Project }) {
  const c = p.computed
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold text-brand-dark">Description</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm">{p.description || "No description yet."}</p>
          {p.objectives && (
            <div className="mt-3 border-t pt-3">
              <h2 className="text-sm font-semibold text-brand-dark">Objectives</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm">{p.objectives}</p>
            </div>
          )}
          {p.completionSummary && (
            <div className="mt-3 border-t pt-3">
              <h2 className="text-sm font-semibold text-brand-dark">Completion summary</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm">{p.completionSummary}</p>
            </div>
          )}
        </section>

        {/* Phase rail */}
        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold text-brand-dark">Phases</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.phases.map((phase, index) => {
              const current = phase === p.currentPhase
              const currentIndex = p.phases.indexOf(p.currentPhase)
              const done = currentIndex >= 0 && index < currentIndex
              return (
                <span
                  key={phase}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
                    current ? "border-brand-brown bg-brand-brown text-white" : done ? "border-green-200 bg-green-50 text-green-700" : "border-border text-muted-foreground",
                  )}
                >
                  {done ? <CheckCircle2 className="h-3 w-3" /> : null}
                  {phase}
                </span>
              )
            })}
          </div>
        </section>

        {p.internalNotes && (
          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Internal notes</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm">{p.internalNotes}</p>
          </section>
        )}
        {p.clientFacingSummary && (
          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Client-facing summary</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm">{p.clientFacingSummary}</p>
          </section>
        )}
      </div>

      <div className="space-y-4">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold text-brand-dark">At a glance</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Service</dt><dd className="text-right">{p.service.title || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd className="text-right">{p.projectType || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Start</dt><dd>{p.startDate ? crmDayOnly(p.startDate) : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Expected completion</dt><dd>{p.expectedCompletionDate ? crmDayOnly(p.expectedCompletionDate) : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Actual completion</dt><dd>{p.actualCompletionDate ? crmDayOnly(p.actualCompletionDate) : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Project manager</dt><dd className="text-right">{c?.manager?.name || "Unassigned"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Team size</dt><dd>{p.team.length}</dd></div>
          </dl>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold text-brand-dark">Work tracking</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="flex items-center gap-1.5 text-muted-foreground"><ListTodo className="h-3.5 w-3.5" /> Tasks</dt><dd>{c?.tasksCompleted ?? 0}/{c?.tasksTotal ?? 0} done · {c?.tasksOverdue ?? 0} overdue</dd></div>
            <div className="flex justify-between"><dt className="flex items-center gap-1.5 text-muted-foreground"><Flag className="h-3.5 w-3.5" /> Milestones</dt><dd>{p.milestones.filter((m) => m.status === "Completed").length}/{p.milestones.length} done · {c?.milestonesOverdue ?? 0} overdue</dd></div>
            <div className="flex justify-between"><dt className="flex items-center gap-1.5 text-muted-foreground"><Truck className="h-3.5 w-3.5" /> Deliverables</dt><dd>{p.deliverables.filter((d) => d.status === "Delivered").length}/{p.deliverables.length} delivered</dd></div>
          </dl>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold text-brand-dark">Finance</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Quoted value</dt><dd className="font-semibold">{formatMinor(p.quotedValueMinor, p.currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Currency</dt><dd>{p.currency.code}</dd></div>
          </dl>
          {p.paymentTerms && <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">Payment terms: {p.paymentTerms}</p>}
          <p className="mt-2 text-[11px] text-muted-foreground">Accounting and payment tracking are handled with the quotation.</p>
        </section>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ tasks

function TasksTab({ project: p, onChanged, onError }: { project: Project; onChanged: () => void; onError: (m: string) => void }) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Project["tasks"][number] | null>(null)
  const today = new Date().toISOString().slice(0, 10)
  const phases = p.phases.length > 0 ? p.phases : ["General"]

  const grouped = useMemo(() => {
    const map = new Map<string, Project["tasks"]>()
    for (const task of p.tasks) {
      const key = task.phase || "General"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    }
    return phases.map((phase) => [phase, map.get(phase) || []] as const).filter(([, tasks]) => tasks.length > 0)
      .concat([...map.entries()].filter(([phase]) => !phases.includes(phase)))
  }, [p.tasks, phases])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {p.computed?.tasksCompleted ?? 0} completed · {p.computed?.tasksOpen ?? 0} open · {(p.computed?.tasksOverdue ?? 0) > 0 ? <span className="font-semibold text-red-600">{p.computed?.tasksOverdue} overdue</span> : "none overdue"}
        </p>
        <button
          onClick={() => { setEditing(null); setEditorOpen(true) }}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90"
        >
          <Plus className="h-3.5 w-3.5" /> Add Task
        </button>
      </div>

      {p.tasks.length === 0 ? (
        <CrmEmptyState
          icon={<ListTodo className="h-8 w-8" />}
          title="No tasks yet"
          description="Break the project into tasks with owners and due dates — or apply a template when creating the next project."
          actionLabel="Add Task"
          onAction={() => { setEditing(null); setEditorOpen(true) }}
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([phase, tasks]) => (
            <section key={phase} className="overflow-hidden rounded-lg border bg-white">
              <div className="border-b bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{phase}</div>
              <ul className="divide-y">
                {tasks.map((task) => {
                  const overdue = task.status !== "Completed" && task.status !== "Cancelled" && task.dueDate && task.dueDate < today
                  return (
                    <li key={task.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-brand-dark">
                          {task.name}
                          <TaskStatusBadge status={String(task.status)} />
                          {task.priority !== "Normal" && <ProjectPriorityBadge priority={task.priority} />}
                          {overdue && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600"><AlertTriangle className="h-3 w-3" /> overdue</span>}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {task.assigneeName || "Unassigned"}
                          {task.startDate ? ` · start ${crmDayOnly(task.startDate)}` : ""}
                          {task.dueDate ? ` · due ${crmDayOnly(task.dueDate)}` : ""}
                          {task.completedAt ? ` · done ${crmDayOnly(task.completedAt)}` : ""}
                        </p>
                        {task.notes && <p className="mt-1 text-xs text-muted-foreground">{task.notes}</p>}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        {task.status !== "Completed" && task.status !== "Cancelled" && (
                          <button
                            onClick={() => updateProjectTask(p.id, task.id, { status: "Completed" }).then(onChanged).catch((err) => onError(err instanceof Error ? err.message : "Could not update the task"))}
                            className="rounded-md border px-2 py-1.5 text-xs font-medium text-brand-green hover:bg-green-50"
                          >
                            <CheckCircle2 className="mr-1 inline h-3 w-3" /> Complete
                          </button>
                        )}
                        {task.status === "Completed" && (
                          <button
                            onClick={() => updateProjectTask(p.id, task.id, { status: "In Progress" }).then(onChanged).catch((err) => onError(err instanceof Error ? err.message : "Could not update the task"))}
                            className="rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted"
                          >
                            Reopen
                          </button>
                        )}
                        <button onClick={() => { setEditing(task); setEditorOpen(true) }} className="rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted">
                          Edit
                        </button>
                        <button
                          onClick={() => removeProjectTask(p.id, task.id).then(onChanged).catch((err) => onError(err instanceof Error ? err.message : "Could not remove the task"))}
                          className="rounded-md border px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <TaskEditorDialog open={editorOpen} project={p} task={editing} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); onChanged() }} />
    </div>
  )
}

function TaskEditorDialog({
  open, project, task, onClose, onSaved,
}: {
  open: boolean
  project: Project
  task: Project["tasks"][number] | null
  onClose: () => void
  onSaved: () => void
}) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [phase, setPhase] = useState("")
  const [status, setStatus] = useState<TaskStatus | string>("Not Started")
  const [priority, setPriority] = useState("Normal")
  const [assigneeStaffId, setAssigneeStaffId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    fetchStaff().then((r) => setStaff(r.staff)).catch(() => {})
    setName(task?.name || "")
    setDescription(task?.description || "")
    setPhase(task?.phase || project.currentPhase || project.phases[0] || "")
    setStatus(task?.status || "Not Started")
    setPriority(task?.priority || "Normal")
    setAssigneeStaffId(task?.assigneeStaffId || "")
    setStartDate(task?.startDate || "")
    setDueDate(task?.dueDate || "")
    setNotes(task?.notes || "")
    setError("")
  }, [open, task, project])

  if (!open) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      const payload = { name, description, phase, status, priority, assigneeStaffId, startDate, dueDate, notes }
      if (task) await updateProjectTask(project.id, task.id, payload)
      else await addProjectTask(project.id, payload)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the task")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <DialogOverlay onClose={onClose} label="Task editor">
      <h2 className="text-sm font-semibold text-brand-dark">{task ? "Edit task" : "Add task"}</h2>
      <div className="mt-3 space-y-2.5 text-sm">
        <label className="block text-xs font-medium text-muted-foreground">
          Task name *
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" autoFocus />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Phase
            <select value={phase} onChange={(e) => setPhase(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
              <option value="">—</option>
              {(project.phases.length > 0 ? project.phases : ["General"]).map((ph) => (
                <option key={ph} value={ph}>{ph}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
              {["Not Started", "In Progress", "Completed", "Blocked", "Cancelled"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
              {["Low", "Normal", "High", "Urgent"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Assigned person
            <select value={assigneeStaffId} onChange={(e) => setAssigneeStaffId(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Start date
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Due date
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
          </label>
        </div>
        <label className="block text-xs font-medium text-muted-foreground">
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
        </label>
      </div>
      {error && <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
        <button type="button" onClick={submit} disabled={saving || !name} className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save task
        </button>
      </div>
    </DialogOverlay>,
    document.body,
  )
}

// -------------------------------------------------------------- milestones

function MilestonesTab({ project: p, onChanged, onError }: { project: Project; onChanged: () => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Project["milestones"][number] | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Key events on the project timeline.</p>
        <button
          onClick={() => { setEditing(null); setOpen(true) }}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90"
        >
          <Plus className="h-3.5 w-3.5" /> Add Milestone
        </button>
      </div>

      {p.milestones.length === 0 ? (
        <CrmEmptyState
          icon={<Flag className="h-8 w-8" />}
          title="No milestones yet"
          description="Mark the important moments — field work completed, draft delivered, client approval received."
          actionLabel="Add Milestone"
          onAction={() => { setEditing(null); setOpen(true) }}
        />
      ) : (
        <ul className="space-y-2">
          {p.milestones.map((m) => {
            const overdue = m.status !== "Completed" && m.dueDate && m.dueDate < today
            return (
              <li key={m.id} className="flex flex-col gap-2 rounded-md border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-brand-dark">
                    {m.status === "Completed" && <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" />}
                    {m.name}
                    <SimpleStatusBadge status={overdue ? "Overdue" : String(m.status)} />
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {m.dueDate ? `due ${crmDayOnly(m.dueDate)}` : "no due date"}
                    {m.completedAt ? ` · completed ${crmDayOnly(m.completedAt)}` : ""}
                  </p>
                  {m.description && <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {m.status !== "Completed" && (
                    <button
                      onClick={() => updateProjectMilestone(p.id, m.id, { status: "Completed" }).then(onChanged).catch((err) => onError(err instanceof Error ? err.message : "Could not update the milestone"))}
                      className="rounded-md border px-2 py-1.5 text-xs font-medium text-brand-green hover:bg-green-50"
                    >
                      Complete
                    </button>
                  )}
                  <button onClick={() => { setEditing(m); setOpen(true) }} className="rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted">Edit</button>
                  <button
                    onClick={() => removeProjectMilestone(p.id, m.id).then(onChanged).catch((err) => onError(err instanceof Error ? err.message : "Could not remove the milestone"))}
                    className="rounded-md border px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <MilestoneEditorDialog open={open} project={p} milestone={editing} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChanged() }} />
    </div>
  )
}

function MilestoneEditorDialog({
  open, project, milestone, onClose, onSaved,
}: {
  open: boolean
  project: Project
  milestone: Project["milestones"][number] | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [status, setStatus] = useState("Upcoming")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setName(milestone?.name || "")
    setDescription(milestone?.description || "")
    setDueDate(milestone?.dueDate || "")
    setStatus(milestone?.status || "Upcoming")
    setError("")
  }, [open, milestone])

  if (!open) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      if (milestone) await updateProjectMilestone(project.id, milestone.id, { name, description, dueDate, status })
      else await addProjectMilestone(project.id, { name, description, dueDate })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the milestone")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <DialogOverlay onClose={onClose} label="Milestone editor">
      <h2 className="text-sm font-semibold text-brand-dark">{milestone ? "Edit milestone" : "Add milestone"}</h2>
      <div className="mt-3 space-y-2.5 text-sm">
        <label className="block text-xs font-medium text-muted-foreground">
          Milestone name *
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" autoFocus />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Due date
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
          </label>
          {milestone && (
            <label className="block text-xs font-medium text-muted-foreground">
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                {["Upcoming", "In Progress", "Completed"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
      {error && <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
        <button type="button" onClick={submit} disabled={saving || !name} className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save milestone
        </button>
      </div>
    </DialogOverlay>,
    document.body,
  )
}

// -------------------------------------------------------------------- team

function TeamTab({ project: p, onChanged, onError }: { project: Project; onChanged: () => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">People assigned to this project. The directory itself lives in the Team Directory.</p>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90"
        >
          <Plus className="h-3.5 w-3.5" /> Add Member
        </button>
      </div>

      {p.team.length === 0 ? (
        <CrmEmptyState
          icon={<Users className="h-8 w-8" />}
          title="No team members assigned"
          description="Add surveyors, GIS staff and technicians from the Team Directory."
          actionLabel="Add Member"
          onAction={() => setOpen(true)}
        />
      ) : (
        <ul className="space-y-2">
          {p.team.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 rounded-md border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-brand-dark">
                  {m.name}
                  {m.id === p.managerMemberId && <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700"><Star className="h-3 w-3" /> Project Manager</span>}
                </p>
                <p className="text-xs text-muted-foreground">{m.role || "Team member"} · added {crmDayOnly(m.addedAt)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                {m.id !== p.managerMemberId && (
                  <button
                    onClick={() => setProjectManager(p.id, m.id).then(onChanged).catch((err) => onError(err instanceof Error ? err.message : "Could not set the manager"))}
                    className="rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    <Star className="mr-1 inline h-3 w-3" /> Make manager
                  </button>
                )}
                <button
                  onClick={() => removeProjectTeamMember(p.id, m.id).then(onChanged).catch((err) => onError(err instanceof Error ? err.message : "Could not remove the member"))}
                  className="rounded-md border px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddMemberDialog open={open} project={p} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChanged() }} />
    </div>
  )
}

function AddMemberDialog({ open, project, onClose, onSaved }: { open: boolean; project: Project; onClose: () => void; onSaved: () => void }) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [mode, setMode] = useState<"directory" | "manual">("directory")
  const [staffId, setStaffId] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [makeManager, setMakeManager] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    fetchStaff().then((r) => setStaff(r.staff)).catch(() => {})
    setStaffId("")
    setName("")
    setRole("")
    setMakeManager(false)
    setError("")
  }, [open])

  if (!open) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      if (mode === "directory" && staffId) {
        const member = staff.find((s) => s.id === staffId)
        await addProjectTeamMember(project.id, { staffId, name: member?.name, role: member?.role, makeManager })
      } else {
        await addProjectTeamMember(project.id, { name, role, makeManager })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the team member")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <DialogOverlay onClose={onClose} label="Add team member">
      <h2 className="text-sm font-semibold text-brand-dark">Add team member</h2>
      <div className="mt-3 flex gap-2">
        {(["directory", "manual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn("rounded-md border px-3 py-1.5 text-xs font-medium", mode === m ? "border-brand-brown bg-brand-brown/10 text-brand-brown" : "text-muted-foreground hover:bg-muted")}
          >
            {m === "directory" ? "From directory" : "Enter manually"}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-2.5 text-sm">
        {mode === "directory" ? (
          <label className="block text-xs font-medium text-muted-foreground">
            Staff member
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
              <option value="">Select…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.role || "team"}</option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="block text-xs font-medium text-muted-foreground">
              Name *
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Role
              <input value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" placeholder="e.g. GIS Analyst" />
            </label>
          </>
        )}
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <input type="checkbox" checked={makeManager} onChange={(e) => setMakeManager(e.target.checked)} className="rounded" />
          Make project manager
        </label>
      </div>
      {error && <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
        <button type="button" onClick={submit} disabled={saving || (mode === "directory" ? !staffId : !name)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add member
        </button>
      </div>
    </DialogOverlay>,
    document.body,
  )
}

// ---------------------------------------------------------------- timeline

function TimelineTab({ detail, onChanged, onError }: { detail: ProjectDetailResult; onChanged: () => void; onError: (m: string) => void }) {
  const p = detail.project
  const [description, setDescription] = useState("")
  const [type, setType] = useState("note_added")
  const [progress, setProgress] = useState("")
  const [saving, setSaving] = useState(false)

  const merged = useMemo(() => {
    const items = [
      ...detail.activities.map((a) => ({ id: `a-${a.id}`, at: a.at, label: a.description, by: a.createdBy, kind: "activity" as const })),
      ...p.history.map((h) => ({ id: `h-${h.id}`, at: h.at, label: `${PROJECT_HISTORY_LOCAL[h.action] || h.action}${h.detail ? `: ${h.detail}` : ""}`, by: h.createdBy, kind: "audit" as const })),
    ]
    return items.sort((a, b) => String(b.at).localeCompare(String(a.at)))
  }, [detail.activities, p.history])

  const submit = async () => {
    setSaving(true)
    try {
      await addProjectActivity(p.id, { type, description, progressPct: progress === "" ? undefined : Number(progress) })
      setDescription("")
      setProgress("")
      onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not add the update")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold text-brand-dark">Timeline</h2>
          {merged.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No activity yet — updates, status changes and task events appear here.</p>
          ) : (
            <ol className="relative mt-3 space-y-4 border-l pl-5">
              {merged.map((item) => (
                <li key={item.id} className="relative">
                  <span className="absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border bg-white text-brand-brown">
                    {item.kind === "activity" ? <MessageSquarePlus className="h-3 w-3" /> : <History className="h-3 w-3" />}
                  </span>
                  <p className="text-sm text-brand-dark">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {crmDayOnly(item.at)} · {crmRelativeTime(item.at)} · {item.by}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="rounded-lg border bg-white p-4 lg:self-start">
        <h2 className="text-sm font-semibold text-brand-dark">Add update</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">What happened — separate from tasks, which describe what needs to happen.</p>
        <div className="mt-3 space-y-2.5 text-sm">
          <label className="block text-xs font-medium text-muted-foreground">
            Activity type
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
              <option value="note_added">Field note</option>
              <option value="progress_updated">Progress report</option>
              <option value="task_completed">Work done</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Description *
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" placeholder="e.g. GNSS data collection started on the eastern plot." />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Optional progress update (%)
            <input value={progress} onChange={(e) => setProgress(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="e.g. 45" className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !description}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquarePlus className="h-3.5 w-3.5" />} Post update
          </button>
        </div>
      </section>
    </div>
  )
}

const PROJECT_HISTORY_LOCAL: Record<string, string> = {
  created: "Project created",
  edited: "Project edited",
  status_changed: "Status changed",
  progress_updated: "Progress updated",
  completed: "Project completed",
  archived: "Project archived",
  restored: "Project restored",
  published: "Published to portfolio",
  unpublished: "Removed from portfolio",
  team_added: "Team member added",
  team_removed: "Team member removed",
  task_created: "Task created",
  task_updated: "Task updated",
  task_completed: "Task completed",
  milestone_completed: "Milestone completed",
  deliverable_updated: "Deliverable updated",
}

// -------------------------------------------------------------- deliverables

function DeliverablesTab({ project: p, onChanged, onError }: { project: Project; onChanged: () => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Project["deliverables"][number] | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Metadata only for now — the Document Management System will attach the actual files.</p>
        <button
          onClick={() => { setEditing(null); setOpen(true) }}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90"
        >
          <Plus className="h-3.5 w-3.5" /> Add Deliverable
        </button>
      </div>

      {p.deliverables.length === 0 ? (
        <CrmEmptyState
          icon={<Truck className="h-8 w-8" />}
          title="No deliverables recorded"
          description="List what the client receives — survey plan, maps, GIS data, reports — and track each to delivery."
          actionLabel="Add Deliverable"
          onAction={() => { setEditing(null); setOpen(true) }}
        />
      ) : (
        <ul className="space-y-2">
          {p.deliverables.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 rounded-md border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium text-brand-dark">
                  {d.status === "Delivered" && <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" />}
                  {d.name}
                  <SimpleStatusBadge status={String(d.status)} />
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {d.expectedDate ? `expected ${crmDayOnly(d.expectedDate)}` : "no expected date"}
                  {d.deliveredAt ? ` · delivered ${crmDayOnly(d.deliveredAt)}` : ""}
                </p>
                {d.description && <p className="mt-1 text-xs text-muted-foreground">{d.description}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                {d.status !== "Delivered" && (
                  <button
                    onClick={() => updateProjectDeliverable(p.id, d.id, { status: "Delivered" }).then(onChanged).catch((err) => onError(err instanceof Error ? err.message : "Could not update the deliverable"))}
                    className="rounded-md border px-2 py-1.5 text-xs font-medium text-brand-green hover:bg-green-50"
                  >
                    Mark delivered
                  </button>
                )}
                <button onClick={() => { setEditing(d); setOpen(true) }} className="rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted">Edit</button>
                <button
                  onClick={() => removeProjectDeliverable(p.id, d.id).then(onChanged).catch((err) => onError(err instanceof Error ? err.message : "Could not remove the deliverable"))}
                  className="rounded-md border px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DeliverableEditorDialog open={open} project={p} deliverable={editing} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChanged() }} />
    </div>
  )
}

function DeliverableEditorDialog({
  open, project, deliverable, onClose, onSaved,
}: {
  open: boolean
  project: Project
  deliverable: Project["deliverables"][number] | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [expectedDate, setExpectedDate] = useState("")
  const [status, setStatus] = useState("Pending")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setName(deliverable?.name || "")
    setDescription(deliverable?.description || "")
    setExpectedDate(deliverable?.expectedDate || "")
    setStatus(deliverable?.status || "Pending")
    setError("")
  }, [open, deliverable])

  if (!open) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      if (deliverable) await updateProjectDeliverable(project.id, deliverable.id, { name, description, expectedDate, status })
      else await addProjectDeliverable(project.id, { name, description, expectedDate })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the deliverable")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <DialogOverlay onClose={onClose} label="Deliverable editor">
      <h2 className="text-sm font-semibold text-brand-dark">{deliverable ? "Edit deliverable" : "Add deliverable"}</h2>
      <div className="mt-3 space-y-2.5 text-sm">
        <label className="block text-xs font-medium text-muted-foreground">
          Deliverable name *
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" placeholder="e.g. Topographical Map" autoFocus />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Expected delivery date
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
              {["Pending", "In Progress", "Ready", "Delivered"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          File attachments arrive with the Document Management System — each deliverable already reserves an attachment slot.
        </p>
      </div>
      {error && <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
        <button type="button" onClick={submit} disabled={saving || !name} className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save deliverable
        </button>
      </div>
    </DialogOverlay>,
    document.body,
  )
}

// ---------------------------------------------------------------- location

function LocationTab({ project: p, onChanged, onError }: { project: Project; onChanged: () => void; onError: (m: string) => void }) {
  const [lat, setLat] = useState(p.location.lat === null ? "" : String(p.location.lat))
  const [lon, setLon] = useState(p.location.lon === null ? "" : String(p.location.lon))
  const [saving, setSaving] = useState(false)

  const parts = [p.location.address, p.location.area, p.location.city, p.location.state, p.location.country].filter(Boolean)
  const hasCoords = p.location.lat !== null && p.location.lon !== null
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${p.location.lat},${p.location.lon}`
    : parts.length > 0
      ? `https://www.google.com/maps?q=${encodeURIComponent(parts.join(", "))}`
      : ""

  const saveCoords = async () => {
    setSaving(true)
    try {
      await updateProject(p.id, {
        location: {
          ...p.location,
          lat: lat === "" ? null : Number(lat),
          lon: lon === "" ? null : Number(lon),
        },
      })
      onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save the coordinates")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-dark">Site location</h2>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Address</dt><dd className="text-right">{p.location.address || "—"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Area / locality</dt><dd className="text-right">{p.location.area || "—"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">City</dt><dd className="text-right">{p.location.city || "—"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">State</dt><dd className="text-right">{p.location.state || "—"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Country</dt><dd className="text-right">{p.location.country || "—"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Coordinates</dt><dd className="text-right font-mono text-xs">{hasCoords ? `${p.location.lat}, ${p.location.lon}` : "—"}</dd></div>
        </dl>
        {p.location.description && <p className="mt-2 border-t pt-2 text-sm text-muted-foreground">{p.location.description}</p>}
        {mapsUrl && (
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            <MapPin className="h-3.5 w-3.5 text-brand-brown" /> Open map preview <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-dark">Coordinates</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Optional — latitude/longitude in decimal degrees. No map provider is required.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <label className="block text-xs font-medium text-muted-foreground">
            Latitude
            <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="e.g. 7.4385" className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Longitude
            <input value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" placeholder="e.g. 3.9087" className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
        </div>
        <button
          type="button"
          onClick={saveCoords}
          disabled={saving}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save coordinates
        </button>
      </section>
    </div>
  )
}

// ------------------------------------------------------------------- links

function LinksTab({ project: p }: { project: Project }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {p.quotation.id ? (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark"><ReceiptText className="h-4 w-4 text-brand-brown" /> Quotation</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Number</dt><dd className="font-mono text-xs font-semibold text-brand-brown">{p.quotation.number}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Quoted value</dt><dd className="font-semibold">{formatMinor(p.quotedValueMinor, p.currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Accepted</dt><dd>{p.quotation.acceptedAt ? crmDayOnly(p.quotation.acceptedAt) : "—"}</dd></div>
          </dl>
          <Link to={`/admin/quotations/${p.quotation.id}`} className="mt-3 inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            View Quotation <ExternalLink className="h-3 w-3" />
          </Link>
        </section>
      ) : (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark"><ReceiptText className="h-4 w-4 text-brand-brown" /> Quotation</h2>
          <p className="mt-2 text-sm text-muted-foreground">No quotation linked — this project was created manually.</p>
        </section>
      )}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark"><Building2 className="h-4 w-4 text-brand-green" /> Client</h2>
        <p className="mt-2 font-medium text-brand-dark">{p.client.company || p.client.name}</p>
        <p className="text-xs text-muted-foreground">{[p.client.email, p.client.phone].filter(Boolean).join(" · ") || "—"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {p.client.id && (
            <Link to={`/admin/crm/clients/${p.client.id}`} className="inline-flex items-center gap-1.5 rounded-md border border-brand-green/20 bg-brand-green/5 px-3 py-2 text-sm font-medium text-brand-green hover:bg-brand-green/10">
              View Client
            </Link>
          )}
          {p.lead.id && (
            <Link to={`/admin/crm/leads/${p.lead.id}`} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
              <Users className="h-3.5 w-3.5 text-brand-brown" /> View Lead ({p.lead.code})
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-dashed bg-white p-4 lg:col-span-2">
        <h2 className="text-sm font-semibold text-brand-dark">Future modules</h2>
        <p className="mt-1 text-xs text-muted-foreground">These plug into this project when the modules arrive — the data structure is already reserved.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {["Documents", "Equipment", "Client Portal"].map((label) => (
            <span key={label} className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Ban className="h-3 w-3" /> {label} — coming later
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- dialogs

function DialogOverlay({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={label} className="max-h-[88vh] w-full overflow-y-auto rounded-t-xl border bg-white p-5 shadow-lg sm:max-w-lg sm:rounded-xl">
        {children}
      </div>
    </div>
  )
}

function StatusDialog({ open, project, onClose, onSaved }: { open: boolean; project: Project; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setStatus("")
    setNotes("")
    setError("")
  }, [open])

  if (!open) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      await changeProjectStatus(project.id, status, notes)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the status")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <DialogOverlay onClose={onClose} label="Change status">
      <h2 className="text-sm font-semibold text-brand-dark">Change status — {project.number}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Progress follows the status default unless you set it manually.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {PROJECT_STATUSES.filter((s) => s !== project.status).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setStatus(option)}
            className={cn("rounded-md border px-3 py-2 text-sm font-medium", status === option ? "border-brand-brown bg-brand-brown/10 text-brand-brown" : "border-border text-muted-foreground hover:bg-muted")}
          >
            {option}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Notes (optional)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
      </label>
      {error && <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
        <button type="button" onClick={submit} disabled={saving || !status} className="rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50">
          {saving ? "Saving…" : "Save status"}
        </button>
      </div>
    </DialogOverlay>,
    document.body,
  )
}

function ProgressDialog({ open, project, onClose, onSaved }: { open: boolean; project: Project; onClose: () => void; onSaved: () => void }) {
  const [pct, setPct] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setPct(String(project.progressPct))
    setNote("")
    setError("")
  }, [open, project])

  if (!open) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      await updateProjectProgress(project.id, Number(pct), note)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update progress")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <DialogOverlay onClose={onClose} label="Update progress">
      <h2 className="text-sm font-semibold text-brand-dark">Update progress — {project.number}</h2>
      <div className="mt-3 space-y-2.5 text-sm">
        <label className="block text-xs font-medium text-muted-foreground">
          Progress (0–100%)
          <input value={pct} onChange={(e) => setPct(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
        </label>
        <ProgressBar pct={Number(pct) || 0} />
        <label className="block text-xs font-medium text-muted-foreground">
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
        </label>
        <p className="text-[11px] text-muted-foreground">A manual value here overrides the status default for this project.</p>
      </div>
      {error && <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
        <button type="button" onClick={submit} disabled={saving || pct === ""} className="rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50">
          {saving ? "Saving…" : "Save progress"}
        </button>
      </div>
    </DialogOverlay>,
    document.body,
  )
}

function CompleteDialog({ open, project, onClose, onSaved }: { open: boolean; project: Project; onClose: () => void; onSaved: () => void }) {
  const [completionSummary, setCompletionSummary] = useState("")
  const [finalNotes, setFinalNotes] = useState("")
  const [clientFacingSummary, setClientFacingSummary] = useState(project.clientFacingSummary || "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const outstanding = project.computed?.outstanding

  useEffect(() => {
    if (!open) return
    setCompletionSummary("")
    setFinalNotes("")
    setClientFacingSummary(project.clientFacingSummary || "")
    setError("")
  }, [open, project])

  if (!open) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      await completeProject(project.id, { completionSummary, finalNotes, clientFacingSummary })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete the project")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <DialogOverlay onClose={onClose} label="Mark project completed">
      <h2 className="text-sm font-semibold text-brand-dark">Mark {project.number} completed?</h2>
      <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2.5 text-sm">
        <p className="font-medium text-brand-dark">Before you confirm</p>
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          <li>{outstanding?.tasks.length ?? 0} outstanding task{(outstanding?.tasks.length ?? 0) === 1 ? "" : "s"}</li>
          <li>{outstanding?.milestones.length ?? 0} open milestone{(outstanding?.milestones.length ?? 0) === 1 ? "" : "s"}</li>
          <li>{outstanding?.deliverables.length ?? 0} pending deliverable{(outstanding?.deliverables.length ?? 0) === 1 ? "" : "s"}</li>
          <li>Current progress: {project.progressPct}%</li>
        </ul>
        {(outstanding?.tasks.length ?? 0) > 0 && (
          <ul className="mt-1.5 space-y-0.5 border-t pt-1.5 text-xs">
            {outstanding!.tasks.slice(0, 5).map((t) => (
              <li key={t.id}>· {t.name}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Completing sets status to Completed, progress to 100% and stamps the actual completion date.</p>
      <div className="mt-3 space-y-2.5 text-sm">
        <label className="block text-xs font-medium text-muted-foreground">
          Completion summary
          <textarea value={completionSummary} onChange={(e) => setCompletionSummary(e.target.value)} rows={3} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Final internal notes
          <textarea value={finalNotes} onChange={(e) => setFinalNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Client-facing summary
          <textarea value={clientFacingSummary} onChange={(e) => setClientFacingSummary(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
        </label>
      </div>
      {error && <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-md bg-brand-green px-3 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-50">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Mark completed
        </button>
      </div>
    </DialogOverlay>,
    document.body,
  )
}

// Publish: records publication metadata on the project AND appends the entry
// to SiteContent.projects through the existing admin content save flow —
// explicit, admin-chosen, never automatic.
function PublishDialog({ open, project, onClose, onSaved }: { open: boolean; project: Project; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [location, setLocation] = useState("")
  const [completionYear, setCompletionYear] = useState("")
  const [description, setDescription] = useState("")
  const [image, setImage] = useState("")
  const [alt, setAlt] = useState("")
  const [media, setMedia] = useState<{ url: string; pathname: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setTitle(project.title)
    setCategory(project.service.title || project.projectType || "")
    setLocation([project.location.city, project.location.state].filter(Boolean).join(", "))
    setCompletionYear(project.actualCompletionDate ? project.actualCompletionDate.slice(0, 4) : String(new Date().getFullYear()))
    setDescription(project.clientFacingSummary || project.description.slice(0, 300))
    setImage("")
    setAlt(project.title)
    setError("")
    fetchMedia().then((r) => setMedia(r.media.map((m) => ({ url: m.url, pathname: m.pathname })))).catch(() => setMedia([]))
  }, [open, project])

  if (!open) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      // 1. Record the publication metadata on the project.
      const result = await publishProject(project.id, { title, category, location, completionYear, image, alt, description })
      const portfolioProjectId = `pms-${result.publication.portfolioProjectId || project.id}`
      // 2. Add the public entry to the site content via the existing flow.
      const content = await fetchContent()
      const entry = {
        id: portfolioProjectId,
        title,
        category: category || "Project",
        location: location || "Nigeria",
        status: "Completed",
        image: image || "/media/placeholder-project.svg",
        alt: alt || title,
        thumb: undefined,
      }
      const projects = Array.isArray(content.projects) ? content.projects : []
      const existingIndex = projects.findIndex((x) => x.id === portfolioProjectId)
      const nextProjects = existingIndex >= 0 ? projects.map((x, i) => (i === existingIndex ? { ...x, ...entry } : x)) : [entry, ...projects]
      await saveContent({ ...content, projects: nextProjects })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish to the portfolio")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <DialogOverlay onClose={onClose} label="Publish to the public portfolio">
      <h2 className="text-sm font-semibold text-brand-dark">Publish to Website — {project.number}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Only the fields below become public on the portfolio. Internal notes, finances and team never leave the CMS.
      </p>
      <div className="mt-3 space-y-2.5 text-sm">
        <label className="block text-xs font-medium text-muted-foreground">
          Public title *
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Category
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" placeholder="e.g. Topographical Survey" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Location (public)
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Completion year
            <input value={completionYear} onChange={(e) => setCompletionYear(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Image alt text
            <input value={alt} onChange={(e) => setAlt(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
        </div>
        <label className="block text-xs font-medium text-muted-foreground">
          Public description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Public image
          <input value={image} onChange={(e) => setImage(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" placeholder="/media/… or https://…" />
        </label>
        {media.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) setImage(e.target.value)
            }}
            className="w-full rounded-md border bg-white px-2 py-2 text-sm"
          >
            <option value="">Pick from the Media library…</option>
            {media.map((m) => (
              <option key={m.url} value={m.url}>{m.pathname}</option>
            ))}
          </select>
        )}
      </div>
      {error && <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
        <button type="button" onClick={submit} disabled={saving || !title} className="inline-flex items-center gap-1.5 rounded-md bg-brand-green px-3 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-50">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Publish
        </button>
      </div>
    </DialogOverlay>,
    document.body,
  )
}

// Site-content helper shared by the unpublish confirm.
async function unpublishFromSite(p: Project) {
  const content = await fetchContent()
  const portfolioProjectId = `pms-${p.publication.portfolioProjectId || p.id}`
  const projects = (Array.isArray(content.projects) ? content.projects : []).filter((x) => x.id !== portfolioProjectId)
  await saveContent({ ...content, projects })
}
