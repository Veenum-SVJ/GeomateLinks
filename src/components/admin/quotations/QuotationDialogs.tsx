// Dialogs for the quotation module: CRM client picker (search + dedupe-safe
// selection), send-by-email interface, rejection reason, status change and
// the accepted → project handoff dialog. Portal-based like the CRM dialogs,
// bottom-sheet on mobile, native <select> only.
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Search, CheckCircle2, Info, Send, Loader2 } from "lucide-react"
import type { Client } from "@/types/crm"
import { REJECTION_REASONS, QUOTATION_STATUSES } from "@/types/quotations"
import type { Quotation, ProjectHandoff, QuotationStatus } from "@/types/quotations"
import { fetchClients } from "@/lib/crmApi"
import { sendQuotationEmail, changeQuotationStatus, createProjectHandoff } from "@/lib/quotationsApi"
import { formatMinor } from "@/lib/money"
import { crmDayOnly } from "@/components/admin/crm/CrmUI"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------- dialog shell

function DialogShell({
  open,
  label,
  onClose,
  children,
  wide,
}: {
  open: boolean
  label: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          "max-h-[88vh] w-full overflow-y-auto rounded-t-xl border bg-white p-5 shadow-lg sm:rounded-xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

function DialogError({ message }: { message: string }) {
  if (!message) return null
  return (
    <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {message}
    </p>
  )
}

// ------------------------------------------------------ client picker

export function ClientPickerDialog({
  open,
  onClose,
  onPicked,
}: {
  open: boolean
  onClose: () => void
  onPicked: (client: Client) => void
}) {
  const [query, setQuery] = useState("")
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setError("")
    fetchClients({ query, pageSize: 100 })
      .then((result) => {
        if (active) setClients(result.clients)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load clients")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, query])

  return (
    <DialogShell open={open} label="Select a CRM client" onClose={onClose} wide>
      <h2 className="text-sm font-semibold text-brand-dark">Select a CRM client</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Search by name, company, email, phone or client ID.</p>
      <div className="relative mt-3">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients…"
          className="w-full rounded-md border py-2 pl-8 pr-3 text-sm"
          autoFocus
        />
      </div>
      <DialogError message={error} />
      <div className="mt-3 max-h-[50vh] space-y-1.5 overflow-y-auto">
        {loading && <p className="py-4 text-center text-sm text-muted-foreground">Searching…</p>}
        {!loading && clients.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No clients match. You can create a new client in the quotation editor instead.
          </p>
        )}
        {!loading &&
          clients.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => onPicked(client)}
              className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-brand-dark">{client.company || client.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-brand-brown">{client.code}</span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {[client.name, client.email, client.phone, client.address].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">
          Cancel
        </button>
      </div>
    </DialogShell>
  )
}

// ------------------------------------------------------ send by email

export function SendEmailDialog({
  open,
  quotation,
  companyName,
  onClose,
  onSent,
}: {
  open: boolean
  quotation: Quotation | null
  companyName: string
  onClose: () => void
  onSent: (quotation: Quotation, emailConfigured: boolean) => void
}) {
  const [to, setTo] = useState("")
  const [cc, setCc] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [lastId, setLastId] = useState("")

  if (open && quotation && lastId !== quotation.id) {
    setTo(quotation.client.email || "")
    setCc("")
    setSubject(`Quotation ${quotation.number} — ${quotation.projectTitle}`)
    setMessage(
      [
        `Dear ${quotation.client.name},`,
        "",
        `Thank you for your interest in ${quotation.projectTitle}. Please find attached our quotation ${quotation.number} totalling ${formatMinor(quotation.grandTotalMinor, quotation.currency)}${quotation.validUntil ? `, valid until ${crmDayOnly(quotation.validUntil)}` : ""}.`,
        "",
        "We remain available to discuss any aspect of the proposal.",
        "",
        "Kind regards,",
        quotation.preparedBy || "Geomate Links Consulting Limited",
        companyName,
      ].join("\n"),
    )
    setError("")
    setLastId(quotation.id)
  }

  if (!open || !quotation) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      const result = await sendQuotationEmail(quotation.id, { to, cc, subject, message })
      onSent(result.quotation, result.emailConfigured)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the send")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogShell open={open} label={`Send ${quotation.number} by email`} onClose={onClose}>
      <h2 className="text-sm font-semibold text-brand-dark">Send by email — {quotation.number}</h2>
      <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          No email provider is connected yet. This records the send, marks the quotation <strong>Sent</strong> and logs it in
          history — download the PDF and attach it from your mail client for now.
        </p>
      </div>
      <div className="mt-3 space-y-2.5 text-sm">
        <label className="block text-xs font-medium text-muted-foreground">
          To
          <input value={to} onChange={(e) => setTo(e.target.value)} type="email" className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Cc
          <input value={cc} onChange={(e) => setCc(e.target.value)} type="email" placeholder="optional" className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Message
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
        </label>
        <p className="text-[11px] text-muted-foreground">Internal notes are never included — the client receives the quotation document only.</p>
      </div>
      <DialogError message={error} />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || !to}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {saving ? "Recording…" : "Record send"}
        </button>
      </div>
    </DialogShell>
  )
}

// ------------------------------------------------------ rejection reason

export function RejectDialog({
  open,
  quotation,
  onClose,
  onConfirm,
}: {
  open: boolean
  quotation: Quotation | null
  onClose: () => void
  onConfirm: (reason: string, notes: string) => Promise<void>
}) {
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [lastId, setLastId] = useState("")

  if (open && quotation && lastId !== quotation.id) {
    setReason(quotation.rejectionReason || "")
    setNotes(quotation.rejectionNotes || "")
    setError("")
    setLastId(quotation.id)
  }

  if (!open || !quotation) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      await onConfirm(reason, notes)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the rejection")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogShell open={open} label="Record rejection" onClose={onClose}>
      <h2 className="text-sm font-semibold text-brand-dark">Record rejection — {quotation.number}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Optional — keep the record even without a reason.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {REJECTION_REASONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setReason(reason === option ? "" : option)}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium",
              reason === option ? "border-brand-brown bg-brand-brown/10 text-brand-brown" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {option}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="optional" className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
      </label>
      <DialogError message={error} />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Mark rejected"}
        </button>
      </div>
    </DialogShell>
  )
}

// ------------------------------------------------------ status change

export function QuotationStatusDialog({
  open,
  quotation,
  onClose,
  onSaved,
}: {
  open: boolean
  quotation: Quotation | null
  onClose: () => void
  onSaved: (quotation: Quotation) => void
}) {
  const [status, setStatus] = useState<QuotationStatus | string>("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [lastId, setLastId] = useState("")

  if (open && quotation && lastId !== quotation.id) {
    setStatus(String(quotation.status))
    setError("")
    setLastId(quotation.id)
  }

  if (!open || !quotation) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      const result = await changeQuotationStatus(quotation.id, status)
      onSaved(result.quotation)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the status")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogShell open={open} label="Change status" onClose={onClose}>
      <h2 className="text-sm font-semibold text-brand-dark">Change status — {quotation.number}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Use “Rejected” to record a reason. Terminal states need a revision instead.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {QUOTATION_STATUSES.filter((s) => s !== quotation.status).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setStatus(option)}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium",
              status === option ? "border-brand-brown bg-brand-brown/10 text-brand-brown" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {option}
          </button>
        ))}
      </div>
      <DialogError message={error} />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || !status || status === quotation.status}
          className="rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save status"}
        </button>
      </div>
    </DialogShell>
  )
}

// ------------------------------------------------------ project handoff

export function CreateProjectDialog({
  open,
  quotation,
  onClose,
  onDone,
}: {
  open: boolean
  quotation: Quotation | null
  onClose: () => void
  onDone?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setDone(false)
      setError("")
    }
  }, [open])

  if (!open || !quotation) return null

  const run = async () => {
    setBusy(true)
    setError("")
    try {
      await createProjectHandoff(quotation.id)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare the handoff")
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogShell open={open} label="Create project from quotation" onClose={onClose}>
      {done ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-brand-green" />
          <h2 className="mt-2 text-sm font-semibold text-brand-dark">Handoff prepared</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The project brief from {quotation.number} is recorded on the quotation and the linked lead. The Project Management
            System arrives in the next phase and will pick it up from here.
          </p>
          <button
            type="button"
            onClick={() => {
              onClose()
              onDone?.()
            }}
            className="mt-4 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90"
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <h2 className="text-sm font-semibold text-brand-dark">Create project — {quotation.number}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Prepares the handoff from this accepted quotation.</p>
          <dl className="mt-3 space-y-1.5 rounded-md border bg-muted/30 px-3 py-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Client</dt>
              <dd className="text-right font-medium">{quotation.client.company || quotation.client.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Project</dt>
              <dd className="text-right font-medium">{quotation.projectTitle}</dd>
            </div>
            {quotation.location && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Location</dt>
                <dd className="text-right">{quotation.location}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Services</dt>
              <dd className="text-right">{[...new Set(quotation.items.map((i) => i.service.title).filter(Boolean))].join(", ") || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="text-right font-semibold">{formatMinor(quotation.grandTotalMinor, quotation.currency)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">
            The Project Management System is a future module — nothing else is created yet.
          </p>
          <DialogError message={error} />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={run}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-green px-3 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy ? "Preparing…" : "Prepare handoff"}
            </button>
          </div>
        </>
      )}
    </DialogShell>
  )
}

// Exported for the editor's source chooser.
export { DialogShell }
export type { ProjectHandoff as ProjectHandoffType }
