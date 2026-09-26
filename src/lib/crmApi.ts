// Typed fetch helpers for the CRM API (see api/crm.js). All calls use the
// same-origin session cookie and surface server error messages — failures
// are never swallowed silently.
import type {
  Lead,
  Client,
  CrmActivity,
  Followup,
  LeadListResult,
  ClientListResult,
  LeadDetailResult,
  ClientDetailResult,
  DashboardResult,
  CrmServiceRef,
} from "@/types/crm"

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

// ------------------------------------------------------------- dashboard

export function fetchCrmDashboard() {
  return request<DashboardResult>("/api/crm/dashboard")
}

// -------------------------------------------------------------- services

export function fetchCrmServices() {
  return request<{ services: CrmServiceRef[] }>("/api/crm/services")
}

// ----------------------------------------------------------------- leads

export type LeadQuery = {
  query?: string
  status?: string
  source?: string
  priority?: string
  assigned?: string
  service?: string
  from?: string
  to?: string
  sort?: string
  page?: number
  pageSize?: number
  archived?: string
}

export function fetchLeads(params: LeadQuery = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value))
  })
  const qs = search.toString()
  return request<LeadListResult>(`/api/crm/leads${qs ? `?${qs}` : ""}`)
}

export function fetchLead(id: string) {
  return request<LeadDetailResult>(`/api/crm/leads/${encodeURIComponent(id)}`)
}

export function createLead(payload: Partial<Lead>) {
  return request<{ ok: true; lead: Lead }>("/api/crm/leads", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateLead(id: string, patch: Partial<Lead>) {
  return request<{ ok: true; lead: Lead }>(`/api/crm/leads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function deleteLead(id: string) {
  return request<{ ok: true }>(`/api/crm/leads/${encodeURIComponent(id)}`, { method: "DELETE" })
}

export function convertLead(id: string, clientInput: Record<string, unknown> = {}) {
  return request<{ ok: true; created: boolean; lead: Lead; client: Client }>(
    `/api/crm/leads/${encodeURIComponent(id)}/convert`,
    { method: "POST", body: JSON.stringify(clientInput) },
  )
}

// --------------------------------------------------------------- clients

export function fetchClients(params: { query?: string; type?: string; page?: number; pageSize?: number } = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value))
  })
  const qs = search.toString()
  return request<ClientListResult>(`/api/crm/clients${qs ? `?${qs}` : ""}`)
}

export function fetchClient(id: string) {
  return request<ClientDetailResult>(`/api/crm/clients/${encodeURIComponent(id)}`)
}

export function createClient(payload: Partial<Client>) {
  return request<{ ok: true; client: Client }>("/api/crm/clients", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateClient(id: string, patch: Partial<Client>) {
  return request<{ ok: true; client: Client }>(`/api/crm/clients/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function deleteClient(id: string) {
  return request<{ ok: true }>(`/api/crm/clients/${encodeURIComponent(id)}`, { method: "DELETE" })
}

// ------------------------------------------------------------ activities

export function fetchCrmActivities(params: { ownerType?: string; ownerId?: string; type?: string; limit?: number } = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value))
  })
  const qs = search.toString()
  return request<{ activities: CrmActivity[] }>(`/api/crm/activities${qs ? `?${qs}` : ""}`)
}

export function createCrmActivity(payload: {
  ownerType: "lead" | "client"
  ownerId: string
  ownerCode?: string
  type: string
  description: string
  createdBy?: string
  at?: string
}) {
  return request<{ ok: true; activity: CrmActivity }>("/api/crm/activities", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

// ------------------------------------------------------------- followups

export function fetchFollowups(params: { status?: string; relatedType?: string; relatedId?: string } = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value))
  })
  const qs = search.toString()
  return request<{ followups: Followup[] }>(`/api/crm/followups${qs ? `?${qs}` : ""}`)
}

export function createFollowup(payload: {
  relatedType: "lead" | "client"
  relatedId: string
  relatedCode?: string
  date: string
  time?: string
  title: string
  description?: string
  priority?: string
  status?: string
}) {
  return request<{ ok: true; followup: Followup }>("/api/crm/followups", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateFollowup(id: string, patch: Partial<Followup>) {
  return request<{ ok: true; followup: Followup }>(`/api/crm/followups/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function deleteFollowup(id: string) {
  return request<{ ok: true }>(`/api/crm/followups/${encodeURIComponent(id)}`, { method: "DELETE" })
}
