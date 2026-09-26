// Create/Edit lead dialog. Services come from the CMS via /api/crm/services
// (never hard-coded); the lead stores a snapshot so later renames/removals
// in the CMS never corrupt history.
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X } from "lucide-react"
import { LEAD_STATUSES, LEAD_SOURCES, LEAD_PRIORITIES } from "@/types/crm"
import type { Lead, CrmServiceRef } from "@/types/crm"
import { fetchCrmServices } from "@/lib/crmApi"

type Props = {
  open: boolean
  lead?: Lead | null
  onClose: () => void
  onSaved: (lead: Lead) => void
}

type FormState = {
  name: string
  company: string
  email: string
  phone: string
  whatsapp: string
  serviceId: string
  projectType: string
  location: string
  source: string
  description: string
  status: string
  priority: string
  assigned: string
  lastContactedAt: string
  nextFollowUpAt: string
}

const emptyForm: FormState = {
  name: "",
  company: "",
  email: "",
  phone: "",
  whatsapp: "",
  serviceId: "",
  projectType: "",
  location: "",
  source: "Phone",
  description: "",
  status: "New",
  priority: "Normal",
  assigned: "",
  lastContactedAt: "",
  nextFollowUpAt: "",
}

function toForm(lead: Lead, services: CrmServiceRef[]): FormState {
  const serviceId = lead.service?.id || ""
  const known = services.some((s) => s.id === serviceId)
  return {
    name: lead.name || "",
    company: lead.company || "",
    email: lead.email || "",
    phone: lead.phone || "",
    whatsapp: lead.whatsapp || "",
    // If the CMS service was renamed/removed, keep the stored title visible
    // as an explicit "(archived)" option instead of silently dropping it.
    serviceId: known || !serviceId ? serviceId : `__keep:${serviceId}`,
    projectType: lead.projectType || "",
    location: lead.location || "",
    source: lead.source || "Phone",
    description: lead.description || "",
    status: lead.status || "New",
    priority: lead.priority || "Normal",
    assigned: lead.assigned || "",
    lastContactedAt: lead.lastContactedAt ? lead.lastContactedAt.slice(0, 10) : "",
    nextFollowUpAt: lead.nextFollowUpAt ? lead.nextFollowUpAt.slice(0, 10) : "",
  }
}

const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base"

export default function LeadFormDialog({ open, lead, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [services, setServices] = useState<CrmServiceRef[]>([])
  const [archivedServiceTitle, setArchivedServiceTitle] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    fetchCrmServices()
      .then((res) => setServices(res.services))
      .catch(() => setServices([]))
  }, [open])

  useEffect(() => {
    if (!open) return
    setError("")
    if (lead) {
      fetchCrmServices()
        .then((res) => {
          setServices(res.services)
          const next = toForm(lead, res.services)
          setForm(next)
          const kept = next.serviceId.startsWith("__keep:")
          setArchivedServiceTitle(kept ? lead.service?.title || "" : "")
        })
        .catch(() => {
          setServices([])
          setForm(toForm(lead, []))
          setArchivedServiceTitle(lead.service?.id && lead.service?.title ? lead.service.title : "")
        })
    } else {
      setForm(emptyForm)
      setArchivedServiceTitle("")
    }
  }, [open, lead])

  if (!open) return null

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }))

  const handleSubmit = async (event?: React.SyntheticEvent) => {
    event?.preventDefault()
    setError("")
    if (!form.name.trim()) {
      setError("Name is required")
      return
    }
    if (!form.email.trim() && !form.phone.trim()) {
      setError("Provide at least an email or a phone number")
      return
    }
    const keptId = form.serviceId.startsWith("__keep:") ? form.serviceId.slice(7) : ""
    const chosen = services.find((s) => s.id === form.serviceId)
    const payload: Record<string, unknown> = {
      name: form.name,
      company: form.company,
      email: form.email,
      phone: form.phone,
      whatsapp: form.whatsapp,
      service: chosen ? { id: chosen.id, title: chosen.title } : keptId ? { id: keptId, title: archivedServiceTitle } : { id: "", title: "" },
      projectType: form.projectType,
      location: form.location,
      source: form.source,
      description: form.description,
      status: form.status,
      priority: form.priority,
      assigned: form.assigned,
      lastContactedAt: form.lastContactedAt || "",
      nextFollowUpAt: form.nextFollowUpAt || "",
    }
    setSaving(true)
    try {
      const { updateLead, createLead } = await import("@/lib/crmApi")
      const result = lead ? await updateLead(lead.id, payload) : await createLead(payload)
      onSaved(result.lead)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the lead")
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, node: React.ReactNode, span = false) => (
    <div className={span ? "sm:col-span-2" : ""}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="mt-1">{node}</div>
    </div>
  )

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={lead ? "Edit lead" : "New lead"} className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-xl border bg-white shadow-lg sm:rounded-xl">
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold text-brand-dark">{lead ? `Edit ${lead.code}` : "New lead"}</h2>
          <button onClick={onClose} aria-label="Close" className="-m-2 p-2 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("Full name *", <Input required value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} />)}
            {field("Company / organization", <Input value={form.company} onChange={(e) => set({ company: e.target.value })} className={inputClass} />)}
            {field("Email", <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className={inputClass} />)}
            {field("Phone", <Input type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} className={inputClass} />)}
            {field("WhatsApp number", <Input type="tel" value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} className={inputClass} />)}
            {field(
              "Service required",
              <select value={form.serviceId} onChange={(e) => set({ serviceId: e.target.value })} className={inputClass}>
                <option value="">Not specified</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
                {archivedServiceTitle && <option value={`__keep:${form.serviceId.slice(7)}`}>{archivedServiceTitle} (archived)</option>}
              </select>,
            )}
            {field("Project type", <Input value={form.projectType} onChange={(e) => set({ projectType: e.target.value })} placeholder="e.g. Topographical survey" className={inputClass} />)}
            {field("Project location", <Input value={form.location} onChange={(e) => set({ location: e.target.value })} className={inputClass} />)}
            {field(
              "Source",
              <select value={form.source} onChange={(e) => set({ source: e.target.value })} className={inputClass}>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>,
            )}
            {field(
              "Status",
              <select value={form.status} onChange={(e) => set({ status: e.target.value })} className={inputClass}>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>,
            )}
            {field(
              "Priority",
              <select value={form.priority} onChange={(e) => set({ priority: e.target.value })} className={inputClass}>
                {LEAD_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>,
            )}
            {field("Assigned person", <Input value={form.assigned} onChange={(e) => set({ assigned: e.target.value })} className={inputClass} />)}
            {field("Last contacted", <Input type="date" value={form.lastContactedAt} onChange={(e) => set({ lastContactedAt: e.target.value })} className={inputClass} />)}
            {field("Next follow-up", <Input type="date" value={form.nextFollowUpAt} onChange={(e) => set({ nextFollowUpAt: e.target.value })} className={inputClass} />)}
            {field(
              "Description / requirement",
              <Textarea rows={4} value={form.description} onChange={(e) => set({ description: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base" />,
              true,
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {lead ? "Changes are saved to this lead immediately." : "A lead ID (GML-…) is generated automatically."}
          </p>
        </form>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => handleSubmit()} disabled={saving} className="bg-brand-brown text-white hover:bg-brand-brown/90">
            {saving ? "Saving…" : lead ? "Save changes" : "Create lead"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
