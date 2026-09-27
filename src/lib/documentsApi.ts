// Typed fetch helpers for the Documents API (see api/documents.js). Same
// idioms as projectsApi.ts/quotationsApi.ts: same-origin session cookie,
// server error messages surfaced, never swallowed.
import type {
  DocumentRecord,
  DocumentDetailResult,
  DocumentListResult,
  DocumentQuery,
  DocumentFolder,
  DocumentCategory,
  DocumentProjectSummary,
  DocumentsDashboardResult,
  DocumentsProjectsLookup,
  DocumentRegisterInput,
  DocumentVersion,
} from "@/types/documents"

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

export function fetchDocumentsDashboard() {
  return request<DocumentsDashboardResult>("/api/documents/dashboard")
}

// ------------------------------------------------------------------ list

export function fetchDocuments(params: DocumentQuery = {}) {
  return request<DocumentListResult>(`/api/documents${toSearch(params as Record<string, string | number | undefined>)}`)
}

// ------------------------------------------------- project summary + lookup

export function fetchProjectDocumentSummary(projectId: string) {
  return request<DocumentProjectSummary>(`/api/documents/project-summary?projectId=${encodeURIComponent(projectId)}`)
}

export function fetchDocumentsProjectsLookup() {
  return request<DocumentsProjectsLookup>("/api/documents/projects-lookup")
}

// ------------------------------------------------------- folders + categories

export function fetchDocumentFolders(projectId?: string) {
  return request<{ folders: DocumentFolder[] }>(`/api/documents/folders${projectId ? toSearch({ projectId }) : ""}`)
}

export function createDocumentFolder(payload: { projectId: string; name: string }) {
  return request<{ ok: true; folder: DocumentFolder }>("/api/documents/folders", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateDocumentFolder(id: string, patch: Partial<Pick<DocumentFolder, "name" | "archived" | "projectId">>) {
  return request<{ ok: true; folder: DocumentFolder }>(`/api/documents/folders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function deleteDocumentFolder(id: string, force = false) {
  return request<{ ok: true; documentsDeleted?: number }>(`/api/documents/folders/${encodeURIComponent(id)}${force ? "?force=1" : ""}`, {
    method: "DELETE",
  })
}

export function fetchDocumentCategories() {
  return request<{ categories: DocumentCategory[] }>("/api/documents/categories")
}

export function createDocumentCategory(payload: { name: string }) {
  return request<{ ok: true; category: DocumentCategory }>("/api/documents/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateDocumentCategory(id: string, patch: { name?: string }) {
  return request<{ ok: true; category: DocumentCategory }>(`/api/documents/categories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function deleteDocumentCategory(id: string) {
  return request<{ ok: true; documentsUpdated?: number }>(`/api/documents/categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

// ------------------------------------------------------------- documents

// Registers an uploaded Blob object as a document (server re-validates the
// extension whitelist, size cap and storage pathname).
export function registerDocument(payload: DocumentRegisterInput) {
  return request<{ ok: true; document: DocumentRecord }>("/api/documents", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

// Bytes go straight to Blob via the existing /api/admin/upload client
// handshake — re-exported so DMS screens have one import source.
export { upload } from "@vercel/blob/client"

export function fetchDocument(id: string) {
  return request<DocumentDetailResult>(`/api/documents/${encodeURIComponent(id)}`)
}

export function updateDocument(id: string, patch: Partial<DocumentRecord> & { actor?: string }) {
  return request<{ ok: true; document: DocumentRecord }>(`/api/documents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function deleteDocument(id: string) {
  return request<{ ok: true; versionsDeleted: number }>(`/api/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  })
}

export function archiveDocument(id: string, archived: boolean) {
  return request<{ ok: true; document: DocumentRecord }>(`/api/documents/${encodeURIComponent(id)}/archive`, {
    method: "POST",
    body: JSON.stringify({ archived }),
  })
}

// ----------------------------------------------------------------- bulk

export type BulkAction = "archive" | "restore" | "star" | "unstar" | "move" | "category" | "status" | "tags"

export function bulkDocuments(
  ids: string[],
  action: BulkAction,
  payload: Record<string, unknown> = {},
) {
  return request<{ ok: boolean; applied: number; total: number; results: { id: string; ok: boolean; error?: string }[] }>(
    "/api/documents/bulk",
    { method: "POST", body: JSON.stringify({ ids, action, ...payload }) },
  )
}

// -------------------------------------------------------------- versions

export function registerDocumentVersion(
  documentId: string,
  payload: { originalFilename: string; pathname: string; sizeBytes: number; versionNotes?: string; uploadedBy?: string },
) {
  return request<{ ok: true; document: DocumentRecord; version: DocumentVersion }>(
    `/api/documents/${encodeURIComponent(documentId)}/versions`,
    { method: "POST", body: JSON.stringify(payload) },
  )
}

export function restoreDocumentVersion(documentId: string, versionId: string) {
  return request<{ ok: true; document: DocumentRecord }>(`/api/documents/${encodeURIComponent(documentId)}/restore-version`, {
    method: "POST",
    body: JSON.stringify({ versionId }),
  })
}

// ----------------------------------------------------------------- files

// Auth-checked URL for <img>/embed/iframe previews — the server validates
// the session cookie before redirecting to the short-lived Blob URL.
export function documentFileUrl(documentId: string, opts: { version?: number; download?: boolean } = {}) {
  const params = new URLSearchParams()
  if (opts.version) params.set("v", String(opts.version))
  if (opts.download) params.set("download", "1")
  const qs = params.toString()
  return `/api/documents/${encodeURIComponent(documentId)}/file${qs ? `?${qs}` : ""}`
}
