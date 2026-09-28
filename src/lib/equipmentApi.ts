// Typed fetch helpers for the Equipment API (see api/equipment.js). Same
// idioms as projectsApi.ts: same-origin session cookie, server error
// messages surfaced verbatim (duplicate asset numbers, assignment
// conflicts), never swallowed.
import type {
  Equipment, EquipmentListResult, EquipmentDetailResult, EquipmentQuery,
  EquipmentDashboardResult, EquipmentAssignment, EquipmentReservation,
  MaintenanceRecord, CalibrationRecord, InspectionRecord, HistoryEntry,
  EquipmentCategory, LookupItem, ReportResult, EquipmentCondition, EquipmentPhoto,
} from "@/types/equipment"

// Write payload — every field optional (the server normalises and preserves
// stored values); nested schedules accept partial updates.
export type EquipmentWritePayload = {
  name?: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  description?: string
  purchase?: { date?: string; priceMinor?: number }
  currentValueMinor?: number
  condition?: EquipmentCondition
  location?: string
  warrantyExpiry?: string
  notes?: string
  maintenanceSchedule?: { frequency?: string; customDays?: number | null; lastDate?: string; nextDate?: string }
  calibrationSchedule?: { frequencyMonths?: number; lastDate?: string; nextDate?: string }
  photos?: EquipmentPhoto[]
}

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

export function fetchEquipmentDashboard() {
  return request<EquipmentDashboardResult>("/api/equipment/dashboard")
}

// ------------------------------------------------------------ equipment

export function fetchEquipment(params: EquipmentQuery = {}) {
  return request<EquipmentListResult>(`/api/equipment${toSearch(params as Record<string, string | number | undefined>)}`)
}

export function fetchEquipmentLookup(params: { query?: string; availableOnly?: boolean } = {}) {
  return request<{ equipment: LookupItem[]; total: number }>(`/api/equipment/lookup${toSearch({ query: params.query, availableOnly: params.availableOnly ? "1" : "" })}`)
}

export function fetchEquipmentDetail(id: string) {
  return request<EquipmentDetailResult>(`/api/equipment/${encodeURIComponent(id)}`)
}

export function createEquipmentItem(input: EquipmentWritePayload & { categoryId: string; assetNumber?: string }) {
  return request<{ ok: true; equipment: Equipment }>("/api/equipment", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateEquipmentItem(id: string, patch: EquipmentWritePayload) {
  return request<{ ok: true; equipment: Equipment }>(`/api/equipment/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function deleteEquipmentItem(id: string, assetNumber: string) {
  return request<{ ok: true }>(`/api/equipment/${encodeURIComponent(id)}?confirm=${encodeURIComponent(assetNumber)}`, {
    method: "DELETE",
  })
}

// -------------------------------------------------------------- actions

export function assignEquipmentItem(id: string, input: {
  projectId?: string; projectNumber?: string; projectTitle?: string
  staffId?: string; staffName?: string; startDate?: string; expectedReturnDate?: string; notes?: string
}) {
  return request<{ ok: true; equipment: Equipment }>(`/api/equipment/${encodeURIComponent(id)}/assign`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function returnEquipmentItem(id: string, input: {
  assignmentId?: string; returnDate?: string; conditionOnReturn: string
  damageReport?: string; requiresMaintenance?: boolean; notes?: string
}) {
  return request<{ ok: true; equipment: Equipment }>(`/api/equipment/${encodeURIComponent(id)}/return`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function reserveEquipmentItem(id: string, input: {
  projectId?: string; projectNumber?: string; projectTitle?: string
  reservedDate?: string; usageStart?: string; usageEnd?: string; notes?: string
}) {
  return request<{ ok: true; reservation: EquipmentReservation }>(`/api/equipment/${encodeURIComponent(id)}/reserve`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function cancelEquipmentReservation(equipmentId: string, reservationId: string) {
  return request<{ ok: true }>(`/api/equipment/${encodeURIComponent(equipmentId)}/reservations/${encodeURIComponent(reservationId)}/cancel`, {
    method: "POST",
  })
}

export function archiveEquipmentItem(id: string, archived: boolean, notes = "") {
  return request<{ ok: true; equipment: Equipment }>(`/api/equipment/${encodeURIComponent(id)}/archive`, {
    method: "POST",
    body: JSON.stringify({ archived, notes }),
  })
}

export function retireEquipmentItem(id: string, notes = "") {
  return request<{ ok: true; equipment: Equipment }>(`/api/equipment/${encodeURIComponent(id)}/retire`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  })
}

// ------------------------------------------- maintenance/calibration/inspection

export function createMaintenanceRecord(equipmentId: string, input: Partial<MaintenanceRecord>) {
  return request<{ ok: true; record: MaintenanceRecord }>(`/api/equipment/${encodeURIComponent(equipmentId)}/maintenance`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateMaintenanceRecord(equipmentId: string, recordId: string, patch: Partial<MaintenanceRecord>) {
  return request<{ ok: true; record: MaintenanceRecord }>(`/api/equipment/${encodeURIComponent(equipmentId)}/maintenance/${encodeURIComponent(recordId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function createCalibrationRecord(equipmentId: string, input: Partial<CalibrationRecord>) {
  return request<{ ok: true; record: CalibrationRecord }>(`/api/equipment/${encodeURIComponent(equipmentId)}/calibrations`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function createInspectionRecord(equipmentId: string, input: Partial<InspectionRecord>) {
  return request<{ ok: true; record: InspectionRecord }>(`/api/equipment/${encodeURIComponent(equipmentId)}/inspections`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

// ----------------------------------------------------------- categories

export function fetchEquipmentCategories() {
  return request<{ categories: EquipmentCategory[] }>("/api/equipment/categories")
}

export function createEquipmentCategory(input: { name: string; code?: string; description?: string }) {
  return request<{ ok: true; category: EquipmentCategory }>("/api/equipment/categories", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateEquipmentCategory(id: string, patch: { name?: string; description?: string }) {
  return request<{ ok: true; category: EquipmentCategory }>(`/api/equipment/categories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function deleteEquipmentCategory(id: string) {
  return request<{ ok: true }>(`/api/equipment/categories/${encodeURIComponent(id)}`, { method: "DELETE" })
}

// ------------------------------------------------- module-wide lists

export function fetchAssignments(params: { equipmentId?: string; projectId?: string; status?: string } = {}) {
  return request<{ assignments: EquipmentAssignment[] }>(`/api/equipment/assignments${toSearch(params)}`)
}

export function fetchReservations(params: { equipmentId?: string; projectId?: string; status?: string } = {}) {
  return request<{ reservations: EquipmentReservation[] }>(`/api/equipment/reservations${toSearch(params)}`)
}

export function fetchMaintenanceRecords(params: { equipmentId?: string } = {}) {
  return request<{ maintenance: MaintenanceRecord[] }>(`/api/equipment/maintenance${toSearch(params)}`)
}

export function fetchCalibrationRecords(params: { equipmentId?: string } = {}) {
  return request<{ calibrations: CalibrationRecord[] }>(`/api/equipment/calibrations${toSearch(params)}`)
}

export function fetchInspectionRecords(params: { equipmentId?: string } = {}) {
  return request<{ inspections: InspectionRecord[] }>(`/api/equipment/inspections${toSearch(params)}`)
}

export function fetchEquipmentHistory(params: { equipmentId?: string; limit?: number } = {}) {
  return request<{ history: HistoryEntry[] }>(`/api/equipment/history${toSearch(params)}`)
}

// -------------------------------------------------------------- reports

export function fetchReport(type: string) {
  return request<ReportResult>(`/api/equipment/reports/${encodeURIComponent(type)}`)
}

export function reportCsvUrl(type: string) {
  return `/api/equipment/reports/${encodeURIComponent(type)}?format=csv`
}
