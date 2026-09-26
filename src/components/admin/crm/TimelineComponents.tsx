// Shared activity-timeline and follow-up list components, used on the lead
// and client detail pages. Chronological (newest first) with type icons.
import { useState } from "react"
import { createPortal } from "react-dom"
import { Phone, Mail, MessageCircle, Users, MapPin, FileText, CalendarClock, StickyNote, ArrowLeftRight, FolderPlus, Sparkles, History, X, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { CrmActivity, Followup } from "@/types/crm"
import { LEAD_PRIORITIES } from "@/types/crm"
import { createCrmActivity, createFollowup, updateFollowup } from "@/lib/crmApi"
import { PriorityBadge, FollowupStatusBadge, crmRelativeTime, crmDay, crmDayOnly, followupWhenLabel } from "./CrmUI"

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  lead_created: "Lead created",
  phone_call: "Phone call",
  email: "Email",
  whatsapp: "WhatsApp",
  meeting: "Meeting",
  site_visit: "Site visit",
  quotation_sent: "Quotation sent",
  follow_up: "Follow-up",
  status_changed: "Status changed",
  note_added: "Note",
  client_converted: "Client converted",
  project_created: "Project created",
}

export const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  lead_created: <Sparkles className="h-3.5 w-3.5" />,
  phone_call: <Phone className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  whatsapp: <MessageCircle className="h-3.5 w-3.5" />,
  meeting: <Users className="h-3.5 w-3.5" />,
  site_visit: <MapPin className="h-3.5 w-3.5" />,
  quotation_sent: <FileText className="h-3.5 w-3.5" />,
  follow_up: <CalendarClock className="h-3.5 w-3.5" />,
  status_changed: <ArrowLeftRight className="h-3.5 w-3.5" />,
  note_added: <StickyNote className="h-3.5 w-3.5" />,
  client_converted: <ArrowLeftRight className="h-3.5 w-3.5" />,
  project_created: <FolderPlus className="h-3.5 w-3.5" />,
}

export type CrmOwner = {
  ownerType: "lead" | "client"
  ownerId: string
  ownerCode: string
  ownerName: string
}

// User-creatable activity types (system events like status_changed are
// logged automatically and not offered here).
const CREATABLE_TYPES: { value: string; label: string }[] = [
  { value: "phone_call", label: "Phone call" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp conversation" },
  { value: "meeting", label: "Meeting" },
  { value: "site_visit", label: "Site visit" },
  { value: "quotation_sent", label: "Quotation sent" },
  { value: "note_added", label: "Internal note" },
]

export function ActivityTimeline({ activities }: { activities: CrmActivity[] }) {
  if (activities.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
  }
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {activities.map((activity) => (
        <li key={activity.id} className="relative">
          <span className="absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border bg-white text-brand-brown">
            {ACTIVITY_ICONS[activity.type] || <History className="h-3.5 w-3.5" />}
          </span>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-medium text-brand-dark">{ACTIVITY_TYPE_LABELS[activity.type] || activity.type}</span>
            <span className="text-xs text-muted-foreground" title={new Date(activity.at).toLocaleString()}>
              {crmDay(activity.at)} · {crmRelativeTime(activity.at)}
            </span>
          </div>
          {activity.description && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{activity.description}</p>}
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">by {activity.createdBy}</p>
        </li>
      ))}
    </ol>
  )
}

export function FollowupsList({
  followups,
  onChanged,
}: {
  followups: Followup[]
  onChanged: () => void
}) {
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState("")

  const patch = async (id: string, status: string) => {
    setBusyId(id)
    setError("")
    try {
      await updateFollowup(id, { status })
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the follow-up")
    } finally {
      setBusyId("")
    }
  }

  if (followups.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No follow-ups scheduled.</p>
  }
  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {followups.map((f) => (
        <div key={f.id} className="flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-brand-dark">{f.title}</span>
              <FollowupStatusBadge status={f.status} />
              <PriorityBadge priority={f.priority} />
            </div>
            <p className="text-xs text-muted-foreground">
              {followupWhenLabel(f)}
              {f.time ? ` · ${f.time}` : ""}
              {f.description ? ` · ${f.description}` : ""}
            </p>
          </div>
          {f.status === "Pending" && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={busyId === f.id} onClick={() => patch(f.id, "Completed")} className="text-brand-green">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Complete
              </Button>
              <Button variant="ghost" size="sm" disabled={busyId === f.id} onClick={() => patch(f.id, "Cancelled")}>
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------- add activity

export function AddActivityDialog({
  open,
  owner,
  onClose,
  onSaved,
}: {
  open: boolean
  owner: CrmOwner | null
  onClose: () => void
  onSaved: () => void
}) {
  const [type, setType] = useState("phone_call")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [openFor, setOpenFor] = useState("")

  if (open && owner && openFor !== owner.ownerId) {
    setType("phone_call")
    setDescription("")
    setError("")
    setOpenFor(owner.ownerId)
  }
  if (!open && openFor) setOpenFor("")

  if (!open || !owner) return null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      await createCrmActivity({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        ownerCode: owner.ownerCode,
        type,
        description,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the activity")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Add activity" className="w-full max-w-md rounded-t-xl border bg-white shadow-lg sm:rounded-xl">
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold text-brand-dark">Add activity — {owner.ownerName}</h2>
          <button onClick={onClose} aria-label="Close" className="-m-2 p-2 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4">
          {error && (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Type</Label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:text-base">
                {CREATABLE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Description</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened?" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base" />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="bg-brand-brown text-white hover:bg-brand-brown/90">
              {saving ? "Adding…" : "Add activity"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

// --------------------------------------------------- schedule follow-up

export function FollowupDialog({
  open,
  owner,
  onClose,
  onSaved,
}: {
  open: boolean
  owner: CrmOwner | null
  onClose: () => void
  onSaved: () => void
}) {
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("Normal")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [openFor, setOpenFor] = useState("")

  if (open && owner && openFor !== owner.ownerId) {
    setDate("")
    setTime("")
    setTitle("")
    setDescription("")
    setPriority("Normal")
    setError("")
    setOpenFor(owner.ownerId)
  }
  if (!open && openFor) setOpenFor("")

  if (!open || !owner) return null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!date) {
      setError("Follow-up date is required")
      return
    }
    if (!title.trim()) {
      setError("Give the follow-up a short title")
      return
    }
    setSaving(true)
    setError("")
    try {
      await createFollowup({
        relatedType: owner.ownerType,
        relatedId: owner.ownerId,
        relatedCode: owner.ownerCode,
        date,
        time,
        title,
        description,
        priority,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not schedule the follow-up")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Schedule follow-up" className="w-full max-w-md rounded-t-xl border bg-white shadow-lg sm:rounded-xl">
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold text-brand-dark">Schedule follow-up — {owner.ownerName}</h2>
          <button onClick={onClose} aria-label="Close" className="-m-2 p-2 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4">
          {error && (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Date *</Label>
              <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-10 text-sm sm:text-base" />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 h-10 text-sm sm:text-base" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Call to confirm quotation" className="mt-1 h-10 text-sm sm:text-base" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base" />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Priority</Label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:text-base">
                {LEAD_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="bg-brand-brown text-white hover:bg-brand-brown/90">
              {saving ? "Scheduling…" : "Schedule"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

export { crmDayOnly }
