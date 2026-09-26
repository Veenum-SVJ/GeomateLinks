// Typed fetch helpers for the Projects API (see api/projects.js). Same
// idioms as quotationsApi.ts: same-origin session cookie, server error
// messages surfaced, never swallowed.
import type {
  Project,
  ProjectDetailResult,
  ProjectListResult,
  ProjectQuery,
  ProjectDashboardResult,
  ProjectActivityEntry,
  ProjectHistoryEntry,
  StaffMember,
  ProjectPublication,
  Currency,
} from "@/types/projects"

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  })
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) detail = data.error
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return (await res.json()) as T
}

function toSearch(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value))
  })
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

// ------------------------------------------------------------- dashboard

export function fetchProjectDashboard() {
  return request<ProjectDashboardResult>("/api/projects/dashboard")
}

// -------------------------------------------------------------- projects

export function fetchProjects(params: ProjectQuery = {}) {
  return request<ProjectListResult>(`/api/projects${toSearch(params as Record<string, string | number | undefined>)}`)
}

export function fetchProject(id: string) {
  return request<ProjectDetailResult>(`/api/projects/${encodeURIComponent(id)}`)
}

export type ProjectCreateInput = {
  clientId?: string
  leadId?: string
  quotationId?: string
  title?: string
  projectType?: string
  priority?: string
  description?: string
  objectives?: string
  location?: Partial<Project["location"]> | { description: string }
  serviceId?: string
  serviceTitle?: string
  startDate?: string
  expectedCompletionDate?: string
  phases?: string[]
  currentPhase?: string
  internalNotes?: string
  clientFacingSummary?: string
  paymentTerms?: string
  quotedValueMinor?: number
  currency?: Currency
  team?: { staffId?: string; name?: string; role?: string; isManager?: boolean }[]
  managerMemberId?: string
  tasks?: { name: string; phase?: string; description?: string; priority?: string; assigneeStaffId?: string }[]
  milestones?: { name: string; description?: string }[]
  deliverables?: { name: string; description?: string }[]
}

export function createProject(payload: ProjectCreateInput) {
  return request<{ ok: true; project: Project }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export type ProjectPatch = {
  title?: string
  projectType?: string
  priority?: string
  description?: string
  objectives?: string
  internalNotes?: string
  clientFacingSummary?: string
  completionSummary?: string
  location?: Partial<Project["location"]>
  service?: { id: string; title: string }
  startDate?: string
  expectedCompletionDate?: string
  phases?: string[]
  currentPhase?: string
  paymentTerms?: string
  managerMemberId?: string
}

export function updateProject(id: string, patch: ProjectPatch) {
  return request<{ ok: true; project: Project }>(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function changeProjectStatus(id: string, status: string, notes = "") {
  return request<{ ok: true; project: Project }>(`/api/projects/${encodeURIComponent(id)}/status`, {
    method: "POST",
    body: JSON.stringify({ status, notes }),
  })
}

export function updateProjectProgress(id: string, progressPct: number, note = "") {
  return request<{ ok: true; project: Project }>(`/api/projects/${encodeURIComponent(id)}/progress`, {
    method: "POST",
    body: JSON.stringify({ progressPct, note }),
  })
}

export function completeProject(
  id: string,
  extra: { completionSummary?: string; finalNotes?: string; clientFacingSummary?: string } = {},
) {
  return request<{ ok: true; project: Project; outstanding: NonNullable<Project["computed"]>["outstanding"] }>(
    `/api/projects/${encodeURIComponent(id)}/complete`,
    { method: "POST", body: JSON.stringify(extra) },
  )
}

export function setProjectArchived(id: string, archived: boolean) {
  return request<{ ok: true; project: Project }>(`/api/projects/${encodeURIComponent(id)}/archive`, {
    method: "POST",
    body: JSON.stringify({ archived }),
  })
}

// Re-exported for pages that prefer one import source.
export type { Project } from "@/types/projects"

// ------------------------------------------------------- CRM-side lookups

export function fetchProjectsByClient(clientId: string) {
  return request<{ projects: Project[] }>(`/api/projects/by-client/${encodeURIComponent(clientId)}`)
}

export function fetchProjectsByLead(leadId: string) {
  return request<{ projects: Project[] }>(`/api/projects/by-lead/${encodeURIComponent(leadId)}`)
}

export function fetchProjectsByQuotation(quotationId: string) {
  return request<{ projects: Project[] }>(`/api/projects/by-quotation/${encodeURIComponent(quotationId)}`)
}

// ------------------------------------------------------------------ tasks

export function addProjectTask(
  id: string,
  task: { name: string; description?: string; phase?: string; status?: string; priority?: string; assigneeStaffId?: string; startDate?: string; dueDate?: string; notes?: string },
) {
  return request<{ ok: true; project: Project; task: Project["tasks"][number] }>(`/api/projects/${encodeURIComponent(id)}/tasks`, {
    method: "POST",
    body: JSON.stringify(task),
  })
}

export function updateProjectTask(id: string, taskId: string, patch: Record<string, unknown>) {
  return request<{ ok: true; project: Project; task: Project["tasks"][number] }>(
    `/api/projects/${encodeURIComponent(id)}/tasks/${encodeURIComponent(taskId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  )
}

export function removeProjectTask(id: string, taskId: string) {
  return request<{ ok: true; project: Project }>(`/api/projects/${encodeURIComponent(id)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  })
}

// -------------------------------------------------------------- milestones

export function addProjectMilestone(id: string, milestone: { name: string; description?: string; dueDate?: string; notes?: string }) {
  return request<{ ok: true; project: Project; milestone: Project["milestones"][number] }>(
    `/api/projects/${encodeURIComponent(id)}/milestones`,
    { method: "POST", body: JSON.stringify(milestone) },
  )
}

export function updateProjectMilestone(id: string, milestoneId: string, patch: Record<string, unknown>) {
  return request<{ ok: true; project: Project; milestone: Project["milestones"][number] }>(
    `/api/projects/${encodeURIComponent(id)}/milestones/${encodeURIComponent(milestoneId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  )
}

export function removeProjectMilestone(id: string, milestoneId: string) {
  return request<{ ok: true; project: Project }>(`/api/projects/${encodeURIComponent(id)}/milestones/${encodeURIComponent(milestoneId)}`, {
    method: "DELETE",
  })
}

// ------------------------------------------------------------- deliverables

export function addProjectDeliverable(id: string, deliverable: { name: string; description?: string; expectedDate?: string; notes?: string }) {
  return request<{ ok: true; project: Project; deliverable: Project["deliverables"][number] }>(
    `/api/projects/${encodeURIComponent(id)}/deliverables`,
    { method: "POST", body: JSON.stringify(deliverable) },
  )
}

export function updateProjectDeliverable(id: string, deliverableId: string, patch: Record<string, unknown>) {
  return request<{ ok: true; project: Project; deliverable: Project["deliverables"][number] }>(
    `/api/projects/${encodeURIComponent(id)}/deliverables/${encodeURIComponent(deliverableId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  )
}

export function removeProjectDeliverable(id: string, deliverableId: string) {
  return request<{ ok: true; project: Project }>(
    `/api/projects/${encodeURIComponent(id)}/deliverables/${encodeURIComponent(deliverableId)}`,
    { method: "DELETE" },
  )
}

// ------------------------------------------------------------------- team

export function addProjectTeamMember(id: string, member: { staffId?: string; name?: string; role?: string; isManager?: boolean; makeManager?: boolean }) {
  return request<{ ok: true; project: Project; member: Project["team"][number] }>(`/api/projects/${encodeURIComponent(id)}/team`, {
    method: "POST",
    body: JSON.stringify(member),
  })
}

export function removeProjectTeamMember(id: string, memberId: string) {
  return request<{ ok: true; project: Project }>(`/api/projects/${encodeURIComponent(id)}/team/${encodeURIComponent(memberId)}`, {
    method: "DELETE",
  })
}

export function setProjectManager(id: string, memberId: string) {
  return request<{ ok: true; project: Project }>(`/api/projects/${encodeURIComponent(id)}/manager`, {
    method: "POST",
    body: JSON.stringify({ memberId }),
  })
}

// -------------------------------------------------------------- activities

export function addProjectActivity(
  id: string,
  entry: { type?: string; description: string; progressPct?: number | string },
) {
  return request<{ ok: true; activity: ProjectActivityEntry; project: Project }>(`/api/projects/${encodeURIComponent(id)}/activities`, {
    method: "POST",
    body: JSON.stringify(entry),
  })
}

// -------------------------------------------------------------- publication

export function publishProject(id: string, publication: Partial<ProjectPublication>) {
  return request<{ ok: true; project: Project; publication: ProjectPublication }>(`/api/projects/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    body: JSON.stringify({ publication }),
  })
}

export function unpublishProject(id: string) {
  return request<{ ok: true; project: Project }>(`/api/projects/${encodeURIComponent(id)}/unpublish`, {
    method: "POST",
    body: JSON.stringify({}),
  })
}

// ------------------------------------------------------------------ audit

export function fetchProjectAudit(id: string) {
  return request<{ history: ProjectHistoryEntry[] }>(`/api/projects/${encodeURIComponent(id)}/audit`)
}

export function fetchProjectActivities(id: string) {
  return request<{ activities: ProjectActivityEntry[] }>(`/api/projects/${encodeURIComponent(id)}/activities`)
}

// --------------------------------------------------------- quotations reuse

// Re-export so the editor can list accepted quotations from the same client.
export { fetchQuotations } from "@/lib/quotationsApi"

// ------------------------------------------------------------------ staff

export function fetchStaff() {
  return request<{ staff: StaffMember[] }>("/api/projects/staff")
}

export function createStaffMember(payload: Partial<StaffMember>) {
  return request<{ ok: true; staff: StaffMember }>("/api/projects/staff", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateStaffMember(id: string, patch: Partial<StaffMember>) {
  return request<{ ok: true; staff: StaffMember }>(`/api/projects/staff/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function deleteStaffMember(id: string) {
  return request<{ ok: true }>(`/api/projects/staff/${encodeURIComponent(id)}`, { method: "DELETE" })
}
