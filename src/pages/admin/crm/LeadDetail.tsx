// Lead detail profile: contact + project info, merged timeline (activities,
// follow-ups, notes), attachments and the full PRD action bar — Edit, Change
// Status, Add Activity, Schedule Follow-up, Convert to Client, Create
// Quotation (integration point), Create Project (won leads only), Archive,
// View Original Message.
import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, Pencil, Activity, CalendarClock, ArrowLeftRight, FileText, FolderPlus, Archive, ArchiveRestore,
  Phone, MapPin, Briefcase, StickyNote, ExternalLink, Sparkles, History, FolderKanban, Users, Trash2, AlertTriangle,
} from "lucide-react"
import type { Project, SiteContent } from "@/types/content"
import type { Lead as CrmLead, LeadDetailResult as LeadDetail, CrmActivity as CrmActivityT, Followup as FollowupT } from "@/types/crm"
import { LEAD_STATUSES } from "@/types/crm"
import { fetchLead, updateLead, deleteLead } from "@/lib/crmApi"
import { fetchContent, fallbackContent } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { LeadStatusBadge, PriorityBadge, SourceBadge, CrmSpinner, CrmErrorState, CrmEmptyState, crmRelativeTime, crmDayOnly, CrmConfirmDialog } from "@/components/admin/crm/CrmUI"
import { ActivityTimeline, FollowupsList, AddActivityDialog, FollowupDialog, ACTIVITY_TYPE_LABELS, ACTIVITY_ICONS } from "@/components/admin/crm/TimelineComponents"
import LeadFormDialog from "@/components/admin/crm/LeadFormDialog"
import ConvertLeadDialog from "@/components/admin/crm/ConvertLeadDialog"

type MergedItem = {
  kind: "activity" | "followup"
  id: string
  at: string
  activity?: CrmActivityT
  followup?: FollowupT
}

function StatusChangeDialog({
  open,
  lead,
  onClose,
  onSaved,
}: {
  open: boolean
  lead: CrmLead | null
  onClose: () => void
  onSaved: (lead: CrmLead) => void
}) {
  const [status, setStatus] = useState("New")
  const [lastLeadId, setLastLeadId] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  if (open && lead && lastLeadId !== lead.id) {
    setStatus(String(lead.status))
    setError("")
    setLastLeadId(lead.id)
  }

  if (!open || !lead) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      const result = await updateLead(lead.id, { status })
      onSaved(result.lead)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the status")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Change status" className="w-full max-w-sm rounded-lg border bg-white p-5 shadow-lg">
        <h2 className="text-sm font-semibold text-brand-dark">Change status — {lead.code}</h2>
        {error && <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {LEAD_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${status === s ? "border-brand-brown bg-brand-brown/10 text-brand-brown" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={saving || status === lead.status} className="rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save status"}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateProjectDialog({
  open,
  lead,
  projects,
  onClose,
  onSaved,
}: {
  open: boolean
  lead: CrmLead | null
  projects: Project[]
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const [existingId, setExistingId] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [seededFor, setSeededFor] = useState("")

  if (open && lead && seededFor !== lead.id) {
    setExistingId(lead.projectRef?.id || "")
    setNewTitle(lead.service?.title && lead.location ? `${lead.service.title} — ${lead.location}` : lead.service?.title || lead.projectType || "")
    setError("")
    setSeededFor(lead.id)
  }

  if (!open || !lead) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      const chosen = projects.find((p) => p.id === existingId)
      const projectRef = chosen
        ? { id: chosen.id, title: chosen.title }
        : { id: `local-${Date.now().toString(36)}`, title: newTitle || lead.service?.title || "New project" }
      await updateLead(lead.id, { projectRef, status: "Won" })
      onSaved(chosen ? `Linked to “${chosen.title}”.` : `Project “${projectRef.title}” recorded on the lead. Add it to the public Projects page from Projects → Publish when ready.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the project link")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Create project" className="w-full max-w-md rounded-lg border bg-white p-5 shadow-lg">
        <h2 className="text-sm font-semibold text-brand-dark">Create project — {lead.code}</h2>
        {error && <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Link an existing portfolio project</p>
            <select value={existingId} onChange={(e) => setExistingId(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:text-base">
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Or record a new project</p>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Project title" className="mt-1 h-10 text-sm sm:text-base" />
          </div>
          <p className="rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            This records the project on the lead and marks it Won. The client's profile lists all their linked projects. Publishing a new portfolio entry to the public site is still done from the Projects editor.
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50">
            {saving ? "Saving…" : "Create project"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<LeadDetail | null>(null)
  const [content, setContent] = useState<SiteContent | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<"timeline" | "activities" | "followups" | "notes">("timeline")
  const [actionError, setActionError] = useState("")
  const [actionBusy, setActionBusy] = useState("")
  const [confirm, setConfirm] = useState<null | { title: string; description: string; confirmLabel: string; run: () => Promise<void> }>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [followupOpen, setFollowupOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [attachmentBusy, setAttachmentBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setError("")
    try {
      const result = await fetchLead(id)
      setDetail(result)
      setNotFound(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load the lead"
      if (message.includes("404")) setNotFound(true)
      setError(message)
    }
  }, [id])

  useEffect(() => {
    load()
    fetchContent()
      .then(setContent)
      .catch(() => setContent(null))
  }, [load])

  const handleUpload = async (file: File) => {
    if (!detail) return
    setAttachmentBusy(true)
    setActionError("")
    try {
      const { upload } = await import("@vercel/blob/client")
      const blob = await upload(`media/${Date.now().toString(36)}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
      })
      const attachments = [...(detail.lead.attachments || []), { name: file.name, url: blob.url }]
      const result = await updateLead(detail.lead.id, { attachments })
      setDetail({ ...detail, lead: result.lead })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setAttachmentBusy(false)
    }
  }

  const removeAttachment = async (url: string) => {
    if (!detail) return
    setConfirm({
      title: "Remove attachment",
      description: "The file stays in the media library; only the link on this lead is removed.",
      confirmLabel: "Remove",
      run: async () => {
        const attachments = (detail.lead.attachments || []).filter((a) => a.url !== url)
        const result = await updateLead(detail.lead.id, { attachments })
        setDetail({ ...detail, lead: result.lead })
      },
    })
  }

  const markContacted = async () => {
    if (!detail) return
    setActionBusy("message")
    setActionError("")
    try {
      const result = await updateLead(detail.lead.id, { lastContactedAt: new Date().toISOString() })
      setDetail({ ...detail, lead: result.lead })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update the lead")
    } finally {
      setActionBusy("")
    }
  }

  const doDelete = async () => {
    if (!detail) return
    await deleteLead(detail.lead.id)
    navigate("/admin/crm/leads")
  }

  if (notFound) {
    return (
      <CrmEmptyState
        icon={<AlertTriangle className="h-8 w-8" />}
        title="Lead not found"
        description="It may have been deleted. Head back to the leads list."
      />
    )
  }

  const lead = detail?.lead
  const projects = content?.projects || fallbackContent.projects

  return (
    <div className="space-y-4">
      <Link to="/admin/crm/leads" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All leads
      </Link>

      {error && <CrmErrorState message={error} onRetry={load} />}
      {!detail && !error && <CrmSpinner />}

      {lead && detail && (
        <>
          {/* Header */}
          <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Lead {lead.code}</p>
              <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-brand-dark">{lead.name}</h1>
              {lead.company && <p className="text-sm text-muted-foreground">{lead.company}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <LeadStatusBadge status={lead.status} />
                <PriorityBadge priority={lead.priority} />
                <SourceBadge source={lead.source} />
                {lead.convertedAt && (
                  <span className="inline-flex items-center rounded-full border border-brand-green/20 bg-brand-green/10 px-2.5 py-0.5 text-xs font-semibold text-brand-green">
                    Client · {crmDayOnly(lead.convertedAt)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button onClick={() => setStatusOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Change Status
              </button>
              <button onClick={() => setActivityOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
                <Activity className="h-3.5 w-3.5" /> Add Activity
              </button>
              <button onClick={() => setFollowupOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
                <CalendarClock className="h-3.5 w-3.5" /> Schedule Follow-up
              </button>
              {!lead.clientId && (
                <button onClick={() => setConvertOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-green px-3 py-2 text-sm font-semibold text-white hover:bg-brand-green/90">
                  <ArrowLeftRight className="h-3.5 w-3.5" /> Convert to Client
                </button>
              )}
              <button
                onClick={() => setProjectOpen(true)}
                disabled={lead.status !== "Won"}
                title={lead.status !== "Won" ? "Available once the lead is Won" : "Create or link a project"}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FolderPlus className="h-3.5 w-3.5" /> Create Project
              </button>
              <button
                onClick={async () => {
                  setActionBusy("quote")
                  setActionError("")
                  try {
                    const result = await updateLead(lead.id, { quotationRef: { code: `QT-${new Date().getFullYear()}-${lead.code.split("-").pop()}`, createdAt: new Date().toISOString() } })
                    setDetail({ ...detail, lead: result.lead })
                  } catch (err) {
                    setActionError(err instanceof Error ? err.message : "Could not record the quotation")
                  } finally {
                    setActionBusy("")
                  }
                }}
                disabled={actionBusy === "quote"}
                title="Integration point — the quotation module will build on this reference"
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                <FileText className="h-3.5 w-3.5" /> Create Quotation
              </button>
              <button
                onClick={() =>
                  setConfirm({
                    title: lead.archived ? "Restore lead" : "Archive lead",
                    description: lead.archived
                      ? "The lead returns to the active pipeline."
                      : "Archived leads stay in history (switch the list view to Archived to see them) but leave the active pipeline and dashboard counts.",
                    confirmLabel: lead.archived ? "Restore" : "Archive",
                    run: async () => {
                      const result = await updateLead(lead.id, { archived: !lead.archived })
                      setDetail({ ...detail, lead: result.lead })
                    },
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                {lead.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                {lead.archived ? "Restore" : "Archive"}
              </button>
            </div>
          </div>

          {actionError && <CrmErrorState message={actionError} />}

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Left column: info */}
            <div className="space-y-4 lg:col-span-1">
              <section className="rounded-lg border bg-white p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
                  <Phone className="h-3.5 w-3.5 text-brand-brown" /> Contact
                </h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd>{lead.phone ? <a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a> : "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="min-w-0 truncate">{lead.email ? <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a> : "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">WhatsApp</dt>
                    <dd>{lead.whatsapp ? <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="hover:underline">{lead.whatsapp}</a> : "—"}</dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-lg border bg-white p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
                  <Briefcase className="h-3.5 w-3.5 text-brand-brown" /> Project
                </h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Service</dt>
                    <dd className="text-right">{lead.service?.title || "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Project type</dt>
                    <dd className="text-right">{lead.projectType || "—"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <dt className="text-muted-foreground">Location</dt>
                    <dd className="flex items-center gap-1 text-right">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {lead.location || "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Assigned</dt>
                    <dd className="text-right">{lead.assigned || "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Next follow-up</dt>
                    <dd className="text-right">{lead.nextFollowUpAt ? crmDayOnly(lead.nextFollowUpAt) : "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Last contacted</dt>
                    <dd className="text-right">{lead.lastContactedAt ? crmDayOnly(lead.lastContactedAt) : "—"}</dd>
                  </div>
                </dl>
                {lead.description && (
                  <div className="mt-3 border-t pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description / requirement</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{lead.description}</p>
                  </div>
                )}
              </section>

              {/* Message link + client link */}
              <section className="space-y-2 rounded-lg border bg-white p-4 text-sm">
                {lead.messageRef && (
                  <Link to="/admin/messages" className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted/50">
                    <span className="inline-flex items-center gap-2">
                      <ExternalLink className="h-3.5 w-3.5 text-brand-brown" /> View Original Message
                    </span>
                    <span className="text-xs text-muted-foreground">Messages inbox</span>
                  </Link>
                )}
                {lead.clientId && (
                  <Link to={`/admin/crm/clients/${lead.clientId}`} className="flex items-center justify-between rounded-md border border-brand-green/20 bg-brand-green/5 px-3 py-2 hover:bg-brand-green/10">
                    <span className="inline-flex items-center gap-2 text-brand-green">
                      <Users className="h-3.5 w-3.5" /> View client record
                    </span>
                    <span className="text-xs text-muted-foreground">CRM → Clients</span>
                  </Link>
                )}
                {lead.messageRef && (
                  <button onClick={markContacted} disabled={actionBusy === "message"} className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50 disabled:opacity-50">
                    Mark lead as contacted today
                  </button>
                )}
                <button onClick={() => setConfirm({
                  title: "Delete lead",
                  description: "This permanently removes the lead, its activities and follow-ups. Archiving is the safer way to retire a lead while keeping history.",
                  confirmLabel: "Delete",
                  run: doDelete,
                })} className="flex w-full items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" /> Delete lead
                </button>
              </section>
            </div>

            {/* Right column: tabs */}
            <div className="lg:col-span-2">
              <div className="rounded-lg border bg-white">
                <div className="flex overflow-x-auto border-b" role="tablist">
                  {(
                    [
                      ["timeline", "Timeline", History],
                      ["activities", "Activities", Activity],
                      ["followups", "Follow-ups", CalendarClock],
                      ["notes", "Notes", StickyNote],
                    ] as const
                  ).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={tab === key}
                      onClick={() => setTab(key)}
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium ${tab === key ? "border-b-2 border-brand-brown text-brand-brown" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {label}
                      {key === "followups" && detail.followups.filter((f) => f.status === "Pending").length > 0 && (
                        <span className="rounded-full bg-brand-brown px-1.5 text-[10px] font-semibold text-white">{detail.followups.filter((f) => f.status === "Pending").length}</span>
                      )}
                      {key === "notes" && detail.activities.filter((a) => a.type === "note_added").length > 0 && (
                        <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">{detail.activities.filter((a) => a.type === "note_added").length}</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="p-4">
                  {tab === "timeline" && <MergedTimeline detail={detail} />}
                  {tab === "activities" && <ActivityTimeline activities={detail.activities} />}
                  {tab === "followups" && (
                    <FollowupsList
                      followups={detail.followups}
                      onChanged={() => {
                        load()
                      }}
                    />
                  )}
                  {tab === "notes" && <NotesList activities={detail.activities} />}
                </div>
              </div>

              {/* Attachments */}
              <section className="mt-4 rounded-lg border bg-white p-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
                    <FolderKanban className="h-3.5 w-3.5 text-brand-brown" /> Attachments ({detail.lead.attachments?.length || 0})
                  </h2>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                    {attachmentBusy ? "Uploading…" : "Upload file"}
                    <input
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) handleUpload(file)
                        event.target.value = ""
                      }}
                    />
                  </label>
                </div>
                {(detail.lead.attachments?.length || 0) === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No attachments. Upload quotes, site plans or any supporting files.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {detail.lead.attachments.map((a) => (
                      <li key={a.url} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                        <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:underline">{a.name || a.url}</a>
                        <button onClick={() => removeAttachment(a.url)} className="shrink-0 text-xs text-red-600 hover:underline">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>

          {/* Dialogs */}
          <LeadFormDialog
            open={editOpen}
            lead={lead}
            onClose={() => setEditOpen(false)}
            onSaved={(updated) => {
              setEditOpen(false)
              setDetail({ ...detail, lead: updated })
            }}
          />
          <StatusChangeDialog open={statusOpen} lead={lead} onClose={() => setStatusOpen(false)} onSaved={() => { setStatusOpen(false); load() }} />
          <AddActivityDialog open={activityOpen} owner={{ ownerType: "lead", ownerId: lead.id, ownerCode: lead.code, ownerName: lead.name }} onClose={() => setActivityOpen(false)} onSaved={() => { setActivityOpen(false); load() }} />
          <FollowupDialog open={followupOpen} owner={{ ownerType: "lead", ownerId: lead.id, ownerCode: lead.code, ownerName: lead.name }} onClose={() => setFollowupOpen(false)} onSaved={() => { setFollowupOpen(false); load() }} />
          <ConvertLeadDialog
            open={convertOpen}
            lead={lead}
            onClose={() => setConvertOpen(false)}
            onConverted={(updated) => {
              setConvertOpen(false)
              setDetail({ ...detail, lead: updated })
              load()
            }}
          />
          <CreateProjectDialog open={projectOpen} lead={lead} projects={projects} onClose={() => setProjectOpen(false)} onSaved={() => { setProjectOpen(false); load() }} />
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
        </>
      )}
    </div>
  )
}

function MergedTimeline({ detail }: { detail: LeadDetail }) {
  const items: MergedItem[] = [
    ...detail.activities.map((activity) => ({ kind: "activity" as const, id: activity.id, at: activity.at, activity })),
    ...detail.followups.map((f) => ({ kind: "followup" as const, id: f.id, at: `${f.date}T${f.time || "09:00"}:00`, followup: f })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)))

  if (items.length === 0) {
    return <CrmEmptyState icon={<Sparkles className="h-8 w-8" />} title="Nothing on the timeline yet" description="Activities, follow-ups and notes will appear here as you work this lead." />
  }

  return (
    <ol className="relative space-y-4 border-l pl-5">
      {items.map((item) => {
        if (item.kind === "followup" && item.followup) {
          const f = item.followup
          const overdue = f.status === "Pending" && f.date < new Date().toISOString().slice(0, 10)
          return (
            <li key={`f-${f.id}`} className="relative">
              <span className={`absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border bg-white ${overdue ? "text-red-500" : "text-brand-green"}`}>
                <CalendarClock className="h-3.5 w-3.5" />
              </span>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium text-brand-dark">Follow-up: {f.title}</span>
                <span className={`text-xs ${overdue ? "font-semibold text-red-600" : "text-muted-foreground"}`}>
                  {f.status === "Pending" && overdue ? "Overdue · " : ""}
                  {crmDayOnly(f.date)}
                  {f.time ? ` · ${f.time}` : ""}
                </span>
                <span className="rounded border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{f.status}</span>
              </div>
              {f.description && <p className="mt-0.5 text-sm text-muted-foreground">{f.description}</p>}
            </li>
          )
        }
        const activity = item.activity as CrmActivityT
        return (
          <li key={activity.id} className="relative">
            <span className="absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border bg-white text-brand-brown">
              {ACTIVITY_ICONS[activity.type] || <History className="h-3.5 w-3.5" />}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-medium text-brand-dark">{ACTIVITY_TYPE_LABELS[activity.type] || activity.type}</span>
              <span className="text-xs text-muted-foreground">{crmDayOnly(activity.at)} · {crmRelativeTime(activity.at)}</span>
            </div>
            {activity.description && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{activity.description}</p>}
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">by {activity.createdBy}</p>
          </li>
        )
      })}
    </ol>
  )
}

function NotesList({ activities }: { activities: CrmActivityT[] }) {
  const notes = activities.filter((a) => a.type === "note_added")
  if (notes.length === 0) {
    return <CrmEmptyState icon={<StickyNote className="h-8 w-8" />} title="No notes yet" description="Internal notes are private — they never appear on the public website. Add one via “Add Activity”." />
  }
  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <div key={note.id} className="rounded-lg border bg-muted/30 px-3.5 py-3">
          <p className="whitespace-pre-wrap text-sm">{note.description}</p>
          <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            {note.createdBy} · {crmDayOnly(note.at)} {crmRelativeTime(note.at)}
          </p>
        </div>
      ))}
    </div>
  )
}
