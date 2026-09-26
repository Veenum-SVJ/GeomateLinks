// Typed fetch helpers for the Quotations API (see api/quotations.js). Same
// idioms as crmApi.ts: same-origin session cookie, server error messages
// surfaced, never swallowed.
import type {
  Quotation,
  QuotationDetailResult,
  QuotationListResult,
  QuotationQuery,
  QuotationDashboardResult,
  QuotationHistoryEntry,
  QuotationVersionRef,
  QuotationStatus,
  ProjectHandoff,
  CrmServiceRef,
} from "@/types/quotations"

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

export function fetchQuotationDashboard() {
  return request<QuotationDashboardResult>("/api/quotations/dashboard")
}

// -------------------------------------------------------------- services

export function fetchQuotationServices() {
  return request<{ services: CrmServiceRef[] }>("/api/quotations/services")
}

// ------------------------------------------------------------ quotations

export function fetchQuotations(params: QuotationQuery = {}) {
  return request<QuotationListResult>(`/api/quotations${toSearch(params as Record<string, string | number | undefined>)}`)
}

export function fetchQuotation(id: string) {
  return request<QuotationDetailResult>(`/api/quotations/${encodeURIComponent(id)}`)
}

export type QuotationDraftInput = {
  clientId?: string
  leadId?: string
  quotationDate?: string
  validUntil?: string
  projectTitle?: string
  location?: string
  projectDescription?: string
  scopeOfWork?: string
  notes?: string
  paymentTerms?: string
  terms?: string
  preparedBy?: string
  currency?: { code: string; symbol: string; minorUnits: number }
  items?: unknown[]
  quoteDiscount?: unknown
  additionalChargesMinor?: number
  taxBp?: number
}

export function createQuotation(payload: QuotationDraftInput) {
  return request<{ ok: true; quotation: Quotation }>("/api/quotations", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

// Editable fields of a Draft (identity/numbering/links are server-fixed).
export type QuotationPatch = {
  validUntil?: string
  projectTitle?: string
  location?: string
  projectDescription?: string
  scopeOfWork?: string
  notes?: string
  paymentTerms?: string
  terms?: string
  preparedBy?: string
  currency?: { code: string; symbol: string; minorUnits: number }
  items?: unknown[]
  quoteDiscount?: unknown
  additionalChargesMinor?: number
  taxBp?: number
}

export function updateQuotation(id: string, patch: QuotationPatch) {
  return request<{ ok: true; quotation: Quotation }>(`/api/quotations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function changeQuotationStatus(id: string, status: QuotationStatus | string, extra: { reason?: string; notes?: string } = {}) {
  return request<{ ok: true; quotation: Quotation }>(`/api/quotations/${encodeURIComponent(id)}/status`, {
    method: "POST",
    body: JSON.stringify({ status, ...extra }),
  })
}

export function sendQuotationEmail(
  id: string,
  email: { to: string; cc?: string; subject?: string; message?: string },
  isResend = false,
) {
  return request<{ ok: true; emailConfigured: boolean; quotation: Quotation }>(
    `/api/quotations/${encodeURIComponent(id)}/send`,
    { method: "POST", body: JSON.stringify({ ...email, isResend }) },
  )
}

export function reviseQuotation(id: string) {
  return request<{ ok: true; quotation: Quotation }>(`/api/quotations/${encodeURIComponent(id)}/revise`, {
    method: "POST",
    body: JSON.stringify({}),
  })
}

export function duplicateQuotation(id: string) {
  return request<{ ok: true; quotation: Quotation; sourceNumber: string }>(
    `/api/quotations/${encodeURIComponent(id)}/duplicate`,
    { method: "POST", body: JSON.stringify({}) },
  )
}

export function setQuotationArchived(id: string, archived: boolean) {
  return request<{ ok: true; quotation: Quotation }>(`/api/quotations/${encodeURIComponent(id)}/archive`, {
    method: "POST",
    body: JSON.stringify({ archived }),
  })
}

export function fetchQuotationHistory(id: string) {
  return request<{ history: QuotationHistoryEntry[] }>(`/api/quotations/${encodeURIComponent(id)}/history`)
}

export function fetchQuotationVersions(id: string) {
  return request<{ versions: QuotationVersionRef[] }>(`/api/quotations/${encodeURIComponent(id)}/versions`)
}

// ------------------------------------------------------- CRM-side lookups

export function fetchQuotationsByLead(leadId: string) {
  return request<{ quotations: Quotation[] }>(`/api/quotations/by-lead/${encodeURIComponent(leadId)}`)
}

export function fetchQuotationsByClient(clientId: string) {
  return request<{ quotations: Quotation[] }>(`/api/quotations/by-client/${encodeURIComponent(clientId)}`)
}

// ------------------------------------------------------- accepted → PMS

export function createProjectHandoff(id: string) {
  return request<{ ok: true; handoff: ProjectHandoff }>(`/api/quotations/${encodeURIComponent(id)}/project-handoff`, {
    method: "POST",
    body: JSON.stringify({}),
  })
}
