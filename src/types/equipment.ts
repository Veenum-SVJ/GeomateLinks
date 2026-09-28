// Equipment Management System types — mirror the JSON returned by
// api/equipment.js (see api/_lib/equipmentStore.js for the source shapes).

export const EQUIPMENT_STATUSES = [
  "Available", "Assigned", "Reserved", "Under Maintenance", "Under Calibration",
  "Damaged", "Lost", "Retired", "Archived",
] as const
export const EQUIPMENT_CONDITIONS = ["Excellent", "Good", "Fair", "Needs Repair", "Damaged", "Unusable"] as const
export const MAINTENANCE_STATUSES = ["Scheduled", "In Progress", "Completed", "Cancelled"] as const
export const MAINTENANCE_TYPES = ["Preventive", "Corrective", "Battery Replacement", "Firmware/Software", "Inspection", "Other"] as const
export const MAINTENANCE_FREQUENCIES = ["None", "Monthly", "Quarterly", "Biannually", "Annually", "Custom"] as const
export const CALIBRATION_RESULTS = ["Passed", "Adjusted", "Failed"] as const
export const INSPECTION_RESULTS = ["Passed", "Failed"] as const
export const INSPECTION_TYPES = ["Pre-field", "Post-field", "Periodic", "Damage Assessment", "Other"] as const

export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number]
export type EquipmentCondition = (typeof EQUIPMENT_CONDITIONS)[number]

export type CategoryRef = { id: string; code: string; name: string }
export type ProjectRef = { id: string; number: string; title: string }
export type StaffRef = { id: string; name: string }

export type MaintenanceSchedule = {
  frequency: (typeof MAINTENANCE_FREQUENCIES)[number]
  customDays: number | null
  lastDate: string
  nextDate: string
}
export type CalibrationSchedule = { frequencyMonths: number; lastDate: string; nextDate: string }
export type EquipmentPhoto = { url: string; label: string; uploadedAt: string }

export type EquipmentComputed = {
  maintenanceState: "none" | "ok" | "due-soon" | "overdue"
  maintenanceDays: number | null
  maintenanceDue: boolean
  maintenanceOverdue: boolean
  maintenanceDueSoon: boolean
  calibrationState: "none" | "ok" | "due-soon" | "overdue"
  calibrationDays: number | null
  calibrationDue: boolean
  calibrationOverdue: boolean
  calibrationDueSoon: boolean
  warrantyExpired: boolean
  conditionBad: boolean
  needsAttention: boolean
  assignable: boolean
  categoryName?: string
  activeAssignment?: EquipmentAssignment | null
  activeReservations?: EquipmentReservation[]
}

export type Equipment = {
  id: string
  createdAt: string
  updatedAt: string
  assetNumber: string
  name: string
  category: CategoryRef
  manufacturer: string
  model: string
  serialNumber: string
  description: string
  purchase: { date: string; priceMinor: number }
  currentValueMinor: number
  currency: { code: string; symbol: string; minorUnits: number }
  condition: EquipmentCondition
  status: EquipmentStatus
  location: string
  assignedStaff: StaffRef
  assignedProject: ProjectRef
  warrantyExpiry: string
  maintenanceSchedule: MaintenanceSchedule
  calibrationSchedule: CalibrationSchedule
  notes: string
  photos: EquipmentPhoto[]
  retiredAt: string
  archived: boolean
  computed: EquipmentComputed
}

export type EquipmentAssignment = {
  id: string
  equipmentId: string
  assetNumber: string
  equipmentName: string
  project: ProjectRef
  staff: StaffRef
  startDate: string
  expectedReturnDate: string
  assignedAt: string
  returnedAt: string
  returnDate: string
  conditionOnReturn: string
  damageReport: string
  requiresMaintenance: boolean
  notes: string
  status: "Assigned" | "Returned" | "Cancelled"
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type EquipmentReservation = {
  id: string
  equipmentId: string
  assetNumber: string
  equipmentName: string
  project: ProjectRef
  reservedDate: string
  usageStart: string
  usageEnd: string
  notes: string
  status: "Reserved" | "Fulfilled" | "Cancelled"
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type MaintenanceRecord = {
  id: string
  equipmentId: string
  assetNumber: string
  equipmentName: string
  type: (typeof MAINTENANCE_TYPES)[number]
  description: string
  date: string
  serviceProvider: string
  technician: string
  costMinor: number
  partsReplaced: string[]
  nextMaintenanceDate: string
  status: (typeof MAINTENANCE_STATUSES)[number]
  notes: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type CalibrationRecord = {
  id: string
  equipmentId: string
  assetNumber: string
  equipmentName: string
  date: string
  provider: string
  certificateNumber: string
  result: (typeof CALIBRATION_RESULTS)[number]
  nextCalibrationDate: string
  documentIds: string[]
  notes: string
  status: "Valid" | "Failed"
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type InspectionRecord = {
  id: string
  equipmentId: string
  assetNumber: string
  equipmentName: string
  date: string
  type: (typeof INSPECTION_TYPES)[number]
  inspector: string
  condition: string
  findings: string
  recommendations: string
  result: (typeof INSPECTION_RESULTS)[number]
  nextInspectionDate: string
  notes: string
  createdBy: string
  createdAt: string
}

export type HistoryEntry = {
  id: string
  equipmentId: string
  assetNumber: string
  action: string
  detail: string
  project: ProjectRef
  staff: StaffRef
  actor: string
  at: string
}

export type EquipmentCategory = {
  id: string
  code: string
  name: string
  system: boolean
  description: string
  createdAt: string
  updatedAt: string
}

export type EquipmentListResult = { equipment: Equipment[]; total: number; page: number; pageSize: number }
export type EquipmentDetailResult = {
  equipment: Equipment
  assignments: EquipmentAssignment[]
  reservations: EquipmentReservation[]
  maintenance: MaintenanceRecord[]
  calibrations: CalibrationRecord[]
  inspections: InspectionRecord[]
  history: HistoryEntry[]
}
export type EquipmentDashboardResult = {
  cards: {
    total: number; available: number; assigned: number; reserved: number
    underMaintenance: number; underCalibration: number; calibrationDue: number
    inspectionDue: number; damaged: number; lost: number; retired: number; archived: number
  }
  recentlyAdded: Equipment[]
  recentAssignments: EquipmentAssignment[]
  recentReturns: EquipmentAssignment[]
  maintenanceDue: Equipment[]
  calibrationDue: Equipment[]
  inspectionDue: Equipment[]
  attention: Equipment[]
  upcomingMaintenance: MaintenanceRecord[]
}
export type EquipmentQuery = {
  query?: string; categoryId?: string; status?: string; condition?: string
  location?: string; projectId?: string; staffId?: string; purchaseYear?: string
  maintenance?: string; calibration?: string; archived?: string
  sort?: string; page?: number; pageSize?: number
}
export type LookupItem = {
  id: string; assetNumber: string; name: string; categoryCode: string
  categoryName: string; status: string; condition: string; location: string
}
export type ReportResult = { title: string; headers: string[]; rows: string[][] }
