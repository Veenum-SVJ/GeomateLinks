// Project domain types — mirrors api/_lib/projectStore.js records.
// Money stays in integer minor units (see src/lib/money.ts).

export const PROJECT_STATUSES = [
  "Planning",
  "Scheduled",
  "Field Work",
  "Processing",
  "Quality Control",
  "Awaiting Delivery",
  "Completed",
  "On Hold",
  "Cancelled",
  "Archived",
] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const ACTIVE_PROJECT_STATUSES = [
  "Planning",
  "Scheduled",
  "Field Work",
  "Processing",
  "Quality Control",
  "Awaiting Delivery",
] as const

export const PROJECT_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const

export const PROJECT_TYPES = [
  "Topographical Survey",
  "Boundary/Cadastral Survey",
  "Engineering Survey",
  "Drone Mapping",
  "GIS Project",
  "Digitization",
  "Hydrographic Survey",
  "Training",
  "Other",
] as const

export const TASK_STATUSES = ["Not Started", "In Progress", "Completed", "Blocked", "Cancelled"] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const MILESTONE_STATUSES = ["Upcoming", "In Progress", "Completed"] as const
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]

export const DELIVERABLE_STATUSES = ["Pending", "In Progress", "Ready", "Delivered"] as const
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number]

export const STAFF_STATUSES = ["Active", "Inactive"] as const
export type StaffStatus = (typeof STAFF_STATUSES)[number]

export const PROJECT_HISTORY_ACTIONS = [
  "created",
  "edited",
  "status_changed",
  "progress_updated",
  "completed",
  "archived",
  "restored",
  "published",
  "unpublished",
  "team_added",
  "team_removed",
  "task_created",
  "task_updated",
  "task_completed",
  "milestone_completed",
  "deliverable_updated",
] as const
export type ProjectHistoryAction = (typeof PROJECT_HISTORY_ACTIONS)[number]

export const PROJECT_ACTIVITY_TYPES = [
  "project_created",
  "status_changed",
  "progress_updated",
  "note_added",
  "task_created",
  "task_completed",
  "milestone_completed",
  "team_added",
  "team_removed",
  "quotation_linked",
  "published",
] as const
export type ProjectActivityType = (typeof PROJECT_ACTIVITY_TYPES)[number]

export type Currency = { code: string; symbol: string; minorUnits: number }

export type ProjectLocation = {
  address: string
  area: string
  city: string
  state: string
  country: string
  lat: number | null
  lon: number | null
  description: string
}

export type ProjectTask = {
  id: string
  name: string
  description: string
  phase: string
  status: TaskStatus | string
  priority: string
  assigneeStaffId: string
  assigneeName: string
  startDate: string
  dueDate: string
  completedAt: string
  notes: string
  createdAt: string
}

export type ProjectMilestone = {
  id: string
  name: string
  description: string
  dueDate: string
  status: MilestoneStatus | string
  completedAt: string
  notes: string
  createdAt: string
}

export type ProjectDeliverable = {
  id: string
  name: string
  description: string
  expectedDate: string
  status: DeliverableStatus | string
  deliveredAt: string
  notes: string
  attachments: unknown[] // placeholder for the future Document Management System
  createdAt: string
}

export type ProjectTeamMember = {
  id: string
  staffId: string
  name: string
  role: string
  isManager: boolean
  addedAt: string
}

export type ProjectPublication = {
  published: boolean
  portfolioProjectId: string
  publishedAt: string
  title: string
  category: string
  location: string
  completionYear: string
  image: string
  thumb: string
  alt: string
  description: string
}

export type ProjectHistoryEntry = {
  id: string
  action: ProjectHistoryAction | string
  detail: string
  at: string
  createdBy: string
}

export type ProjectActivityEntry = {
  id: string
  projectId: string
  projectNumber: string
  projectTitle: string
  type: ProjectActivityType | string
  description: string
  progressPct: number | null
  at: string
  createdBy: string
  createdAt: string
}

export type ProjectComputed = {
  tasksTotal: number
  tasksOpen: number
  tasksCompleted: number
  tasksOverdue: number
  milestonesOverdue: number
  deliverablesPending: number
  isTerminal: boolean
  isActive: boolean
  isOverdue: boolean
  isDueSoon: boolean
  isStalled: boolean
  outstanding: { tasks: ProjectTask[]; milestones: ProjectMilestone[]; deliverables: ProjectDeliverable[] }
  manager: ProjectTeamMember | null
}

export type Project = {
  id: string
  number: string
  title: string
  status: ProjectStatus | string
  progressPct: number
  progressOverridden: boolean
  currentPhase: string
  phases: string[]
  priority: string
  projectType: string
  client: { id: string; code: string; name: string; company: string; email: string; phone: string }
  lead: { id: string; code: string; name: string }
  quotation: { id: string; number: string; acceptedAt: string }
  service: { id: string; title: string }
  quotedValueMinor: number
  currency: Currency
  paymentTerms: string
  description: string
  objectives: string
  internalNotes: string
  clientFacingSummary: string
  completionSummary: string
  location: ProjectLocation
  startDate: string
  expectedCompletionDate: string
  actualCompletionDate: string
  team: ProjectTeamMember[]
  managerMemberId: string
  tasks: ProjectTask[]
  milestones: ProjectMilestone[]
  deliverables: ProjectDeliverable[]
  history: ProjectHistoryEntry[]
  publication: ProjectPublication
  equipmentIds: string[] // reserved for the future Equipment Management System
  archived: boolean
  createdAt: string
  updatedAt: string
  computed?: ProjectComputed
}

export type ProjectDetailResult = {
  project: Project
  activities: ProjectActivityEntry[]
}

export type ProjectListResult = {
  projects: Project[]
  total: number
  page: number
  pageSize: number
}

export type ProjectQuery = {
  query?: string
  status?: string
  serviceId?: string
  clientId?: string
  leadId?: string
  quotationId?: string
  priority?: string
  projectType?: string
  managerStaffId?: string
  staffId?: string
  from?: string
  to?: string
  archived?: string
  sort?: string
  page?: number
  pageSize?: number
}

export type ProjectDashboardResult = {
  cards: {
    total: number
    active: number
    planning: number
    scheduled: number
    fieldWork: number
    processing: number
    qualityControl: number
    awaitingDelivery: number
    completed: number
    onHold: number
    cancelled: number
    archived: number
    overdue: number
  }
  recentProjects: Project[]
  requiringAttention: Project[]
  upcomingDeadlines: Project[]
  recentlyCompleted: Project[]
  overdueProjects: Project[]
  recentActivity: ProjectActivityEntry[]
}

export type StaffMember = {
  id: string
  name: string
  role: string
  phone: string
  email: string
  specialization: string
  status: StaffStatus | string
  notes: string
  createdAt: string
  updatedAt: string
}

export type ProjectTemplate = {
  id: string
  name: string
  description: string
  projectType: string
  phases: string[]
  tasks: { name: string; phase: string; description?: string; priority?: string }[]
  milestones: { name: string; description?: string }[]
  deliverables: { name: string; description?: string }[]
}
