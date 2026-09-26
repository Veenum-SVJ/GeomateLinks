// Convert-to-client dialog. Shows whether an existing client matches by
// email or phone (dedupe) and lets the administrator adjust the client
// details before creating a new one. The original lead is always preserved.
import { useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"
import { CLIENT_TYPES } from "@/types/crm"
import type { Lead } from "@/types/crm"
import { convertLead } from "@/lib/crmApi"

type Props = {
  open: boolean
  lead: Lead | null
  onClose: () => void
  onConverted: (lead: Lead, created: boolean) => void
}

export default function ConvertLeadDialog({ open, lead, onClose, onConverted }: Props) {
  const [name, setName] = useState("")
  const [company, setCompany] = useState("")
  const [type, setType] = useState("Company")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [seededFor, setSeededFor] = useState<string | null>(null)

  // Seed the fields from the lead when the dialog opens for it.
  if (open && lead && seededFor !== lead.id) {
    setName(lead.name || "")
    setCompany(lead.company || "")
    setType(lead.company ? "Company" : "Individual")
    setSeededFor(lead.id)
  }
  if (!open && seededFor) setSeededFor(null)

  if (!open || !lead) return null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    setSaving(true)
    try {
      const result = await convertLead(lead.id, { name, company, type })
      onConverted(result.lead, result.created)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not convert the lead")
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
      <div role="dialog" aria-modal="true" aria-label="Convert to client" className="w-full max-w-md rounded-t-xl border bg-white shadow-lg sm:rounded-xl">
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold text-brand-dark">Convert {lead.code} to client</h2>
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
              <Label className="text-xs font-medium text-muted-foreground">Client name *</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-10 text-sm sm:text-base" />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 h-10 text-sm sm:text-base" />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Client type</Label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:text-base">
                {CLIENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <p className="rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {lead.email || lead.phone
                ? "If a client with the same email or phone number already exists, this lead will be linked to that client instead of creating a duplicate. The original lead is preserved."
                : "This lead has no email or phone, so a new client will be created."}
            </p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="bg-brand-green text-white hover:bg-brand-green/90">
              {saving ? "Converting…" : "Convert"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
