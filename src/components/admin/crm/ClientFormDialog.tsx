// Create/Edit client dialog (PRD client field set).
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X } from "lucide-react"
import { CLIENT_TYPES } from "@/types/crm"
import type { Client } from "@/types/crm"
import { createClient, updateClient } from "@/lib/crmApi"

type Props = {
  open: boolean
  client?: Client | null
  onClose: () => void
  onSaved: (client: Client) => void
}

type FormState = {
  name: string
  company: string
  email: string
  phone: string
  whatsapp: string
  address: string
  industry: string
  type: string
  notes: string
}

const emptyForm: FormState = { name: "", company: "", email: "", phone: "", whatsapp: "", address: "", industry: "", type: "Individual", notes: "" }

const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base"

export default function ClientFormDialog({ open, client, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setError("")
    setForm(
      client
        ? {
            name: client.name || "",
            company: client.company || "",
            email: client.email || "",
            phone: client.phone || "",
            whatsapp: client.whatsapp || "",
            address: client.address || "",
            industry: client.industry || "",
            type: client.type || "Individual",
            notes: client.notes || "",
          }
        : emptyForm,
    )
  }, [open, client])

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
    setSaving(true)
    try {
      const result = client ? await updateClient(client.id, form) : await createClient(form)
      onSaved(result.client)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the client")
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
      <div role="dialog" aria-modal="true" aria-label={client ? "Edit client" : "New client"} className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-xl border bg-white shadow-lg sm:rounded-xl">
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold text-brand-dark">{client ? `Edit ${client.code}` : "New client"}</h2>
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
            {field("Name *", <Input required value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} />)}
            {field("Company", <Input value={form.company} onChange={(e) => set({ company: e.target.value })} className={inputClass} />)}
            {field("Email", <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className={inputClass} />)}
            {field("Phone", <Input type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} className={inputClass} />)}
            {field("WhatsApp number", <Input type="tel" value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} className={inputClass} />)}
            {field(
              "Client type",
              <select value={form.type} onChange={(e) => set({ type: e.target.value })} className={inputClass}>
                {CLIENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>,
            )}
            {field("Industry", <Input value={form.industry} onChange={(e) => set({ industry: e.target.value })} className={inputClass} />)}
            {field("Address", <Input value={form.address} onChange={(e) => set({ address: e.target.value })} className={inputClass} />)}
            {field("Internal notes (private)", <Textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base" />, true)}
          </div>
        </form>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => handleSubmit()} disabled={saving} className="bg-brand-brown text-white hover:bg-brand-brown/90">
            {saving ? "Saving…" : client ? "Save changes" : "Create client"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
