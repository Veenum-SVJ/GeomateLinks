// Document Management System domain types — mirrors api/_lib/documentStore.js
// records. Metadata is the source of truth; binaries live in Blob storage
// and are only reachable through the auth-checked /file route.

export const DOCUMENT_STATUSES = ["Draft", "Working", "Under Review", "Approved", "Final", "Archived"] as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export const VISIBILITY_LEVELS = ["Internal", "Client", "Public Portfolio"] as const
export type DocumentVisibility = (typeof VISIBILITY_LEVELS)[number]

export type ProjectRef = {
  id: string
  number: string
  title: string
}

export type DocumentRecord = {
  id: string
  documentNumber: string
  originalFilename: string
  storedFilename: string
  pathname: string
  mimeType: string
  ext: string
  sizeBytes: number
  projectRef: ProjectRef
  folderId: string
  folderName: string
  categoryId: string
  categoryName: string
  description: string
  tags: string[]
  version: number
  status: DocumentStatus | string
  visibility: DocumentVisibility | string
  starred: boolean
  archived: boolean
  uploadedBy: string
  deliverableIds: string[]
  versionNotes: string
  lastAccessedAt: string
  createdAt: string
  updatedAt: string
}

export type DocumentVersion = {
  id: string
  documentId: string
  version: number
  pathname: string
  originalFilename: string
  storedFilename: string
  ext: string
  sizeBytes: number
  notes: string
  uploadedBy: string
  uploadedAt: string
}

export type DocumentFolder = {
  id: string
  projectId: string
  name: string
  system: boolean
  archived: boolean
  createdAt: string
}

export type DocumentCategory = {
  id: string
  name: string
  slug: string
  system: boolean
  createdAt: string
}

export type DocumentActivityEntry = {
  id: string
  at: string
  documentId: string
  projectId: string
  projectNumber: string
  filename: string
  action: string
  detail: string
  actor: string
}

export type DocumentDetailResult = {
  document: DocumentRecord
  versions: DocumentVersion[]
  activity: DocumentActivityEntry[]
  previewable: boolean
}

export type DocumentListResult = {
  documents: DocumentRecord[]
  total: number
  page: number
  pageSize: number
}

export type DocumentQuery = {
  query?: string
  projectId?: string
  folderId?: string
  categoryId?: string
  type?: string
  status?: string
  tag?: string
  uploadedBy?: string
  visibility?: string
  from?: string
  to?: string
  starred?: string
  archived?: string
  sort?: string
  page?: number
  pageSize?: number
}

export type DocumentProjectSummary = {
  summary: {
    totalFiles: number
    storageBytes: number
    recentFiles: DocumentRecord[]
    folders: { id: string; name: string; files: number; sizeBytes: number }[]
    deliverablesLinked: number
  }
  folders: DocumentFolder[]
  documents: DocumentRecord[]
}

export type DocumentsDashboardResult = {
  totals: {
    files: number
    archivedFiles: number
    storageBytes: number
    uploadedToday: number
    awaitingReview: number
    starred: number
  }
  recent: DocumentRecord[]
  recentlyModified: DocumentRecord[]
  recentlyDownloaded: DocumentRecord[]
  byType: Record<string, number>
  byProject: { id: string; number: string; title: string; files: number; sizeBytes: number }[]
  categories: DocumentCategory[]
}

export type DocumentsProjectsLookup = {
  projects: { id: string; number: string; title: string; client: string; archived: boolean }[]
}

// Upload input — metadata registered after the Blob client-upload completes.
export type DocumentRegisterInput = {
  originalFilename: string
  pathname: string
  sizeBytes: number
  projectRef: { id: string; number: string; title: string }
  folderId?: string
  folderName?: string
  categoryId?: string
  categoryName?: string
  description?: string
  tags?: string[]
  status?: string
  visibility?: string
  uploadedBy?: string
  versionNotes?: string
  deliverableIds?: string[]
}

// How the file can be shown in the browser (drives the preview pane).
export function previewKind(ext: string): "pdf" | "image" | "text" | "none" {
  if (ext === "pdf") return "pdf"
  if (["jpg", "jpeg", "png", "webp", "svg"].includes(ext)) return "image"
  if (["csv", "txt"].includes(ext)) return "text"
  return "none"
}

export const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF", doc: "DOC", docx: "DOCX", xls: "XLS", xlsx: "XLSX", csv: "CSV",
  jpg: "JPG", jpeg: "JPEG", png: "PNG", webp: "WEBP", svg: "SVG",
  dwg: "DWG", dxf: "DXF", kml: "KML", kmz: "KMZ", zip: "ZIP", rar: "RAR",
}

export const SUGGESTED_TAGS = [
  "Survey", "GNSS", "Drone", "Fieldwork", "Draft", "Final", "Client", "GIS", "CAD", "Report", "Topographic",
]
