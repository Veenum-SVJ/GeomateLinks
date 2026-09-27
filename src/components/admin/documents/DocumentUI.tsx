// Shared Document Management UI primitives — badges, formatting and the
// file-type chip used across every DMS screen. Styling follows the existing
// admin design language (see CrmUI.tsx / ProjectUI.tsx).
import { FileText, FileSpreadsheet, FileImage, FileArchive, FileCode, File, Star } from "lucide-react"
import { cn } from "@/lib/utils"

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const statusTone: Record<string, string> = {
  Draft: "border-border text-muted-foreground",
  Working: "border-blue-200 bg-blue-50 text-blue-700",
  "Under Review": "border-amber-200 bg-amber-50 text-amber-700",
  Approved: "border-green-200 bg-green-50 text-green-700",
  Final: "border-green-300 bg-green-100 text-green-800",
  Archived: "border-gray-300 bg-gray-100 text-gray-600",
}

export function DocumentStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", statusTone[status] || "border-border text-muted-foreground")}>
      {status}
    </span>
  )
}

const visibilityTone: Record<string, string> = {
  Internal: "border-border text-muted-foreground",
  Client: "border-blue-200 bg-blue-50 text-blue-700",
  "Public Portfolio": "border-amber-300 bg-amber-100 text-amber-800",
}

export function VisibilityBadge({ visibility }: { visibility: string }) {
  if (!visibility || visibility === "Internal") return null
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-semibold", visibilityTone[visibility] || "border-border text-muted-foreground")}>
      {visibility}
    </span>
  )
}

const typeIcon: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-4 w-4" />,
  doc: <FileText className="h-4 w-4" />,
  docx: <FileText className="h-4 w-4" />,
  xls: <FileSpreadsheet className="h-4 w-4" />,
  xlsx: <FileSpreadsheet className="h-4 w-4" />,
  csv: <FileSpreadsheet className="h-4 w-4" />,
  jpg: <FileImage className="h-4 w-4" />,
  jpeg: <FileImage className="h-4 w-4" />,
  png: <FileImage className="h-4 w-4" />,
  webp: <FileImage className="h-4 w-4" />,
  svg: <FileImage className="h-4 w-4" />,
  dwg: <FileCode className="h-4 w-4" />,
  dxf: <FileCode className="h-4 w-4" />,
  kml: <FileCode className="h-4 w-4" />,
  kmz: <FileCode className="h-4 w-4" />,
  zip: <FileArchive className="h-4 w-4" />,
  rar: <FileArchive className="h-4 w-4" />,
}

export function FileTypeChip({ ext }: { ext: string }) {
  return (
    <span className="inline-flex h-7 w-9 shrink-0 items-center justify-center rounded bg-muted font-mono text-[10px] font-bold uppercase text-muted-foreground" title={ext.toUpperCase()}>
      {typeIcon[ext] || <File className="h-4 w-4" />}
    </span>
  )
}

export function StarMark({ starred }: { starred: boolean }) {
  if (!starred) return null
  return <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Starred" />
}

export function VersionChip({ version }: { version: number }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded border bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
      v{version}
    </span>
  )
}

// Activity action labels (see documentStore.logDocumentActivity).
const actionLabels: Record<string, string> = {
  uploaded: "Uploaded",
  version_created: "Version created",
  version_restored: "Version restored",
  downloaded: "Downloaded",
  viewed: "Viewed",
  metadata_changed: "Metadata changed",
  archived: "Archived",
  restored: "Restored",
  deleted: "Deleted",
}

export function activityLabel(action: string): string {
  return actionLabels[action] || action
}
