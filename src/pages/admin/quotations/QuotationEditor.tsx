// Quotation builder: three sources — from CRM lead (auto-populate everything
// the lead already knows), from an existing CRM client (searchable picker,
// dedupe-safe), or manual. Line items + financial summary use the integer
// money engine; identity (number), status and links are server-controlled.
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, Search, Save, Building2, Sparkles, ExternalLink } from "lucide-react"
import { fetchQuotation, createQuotation, updateQuotation, fetchQuotationServices } from "@/lib/quotationsApi"
import { fetchLead, fetchClient, fetchClients, createClient } from "@/lib/crmApi"
import { CURRENCY_PRESETS, DEFAULT_CURRENCY } from "@/lib/money"
import type { Currency, CrmServiceRef } from "@/types/quotations"
import type { Lead, Client } from "@/types/crm"
import { CrmSpinner, CrmErrorState } from "@/components/admin/crm/CrmUI"
import {
  LineItemsEditor, FinancialSummary,
  editableLineToWire, wireLineToEditable, quoteMoneyToWire, wireToQuoteMoney,
  emptyLine, emptyQuoteMoney,
} from "@/components/admin/quotations/LineItemsEditor"
import type { EditableLine, QuoteMoneyInput } from "@/components/admin/quotations/LineItemsEditor"
import { ClientPickerDialog } from "@/components/admin/quotations/QuotationDialogs"

const todayStr = () => new Date().toISOString().slice(0, 10)
const addDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

type Source = "lead" | "client" | "manual"

export default function QuotationEditor() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const editMode = Boolean(id)
  const initialSource: Source = searchParams.get("leadId") ? "lead" : searchParams.get("clientId") ? "client" : "manual"

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  const [services, setServices] = useState<CrmServiceRef[]>([])
  const [lead, setLead] = useState<Lead | null>(null)
  const [pickedClient, setPickedClient] = useState<Client | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Client block (snapshot fields; linked id kept separately)
  const [clientName, setClientName] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [clientAddress, setClientAddress] = useState("")
  const linkedClientId = pickedClient?.id || ""

  // Quotation info
  const [quotationDate, setQuotationDate] = useState(todayStr())
  const [validUntil, setValidUntil] = useState(addDays(30))
  const [projectTitle, setProjectTitle] = useState("")
  const [location, setLocation] = useState("")
  const [preparedBy, setPreparedBy] = useState("")
  const [currency, setCurrency] = useState<Currency>(DEFAULT_CURRENCY)
  const [customCurrency, setCustomCurrency] = useState(false)

  // Sections
  const [projectDescription, setProjectDescription] = useState("")
  const [scopeOfWork, setScopeOfWork] = useState("")
  const [notes, setNotes] = useState("")
  const [paymentTerms, setPaymentTerms] = useState("50% mobilisation, balance on delivery of final deliverables")
  const [terms, setTerms] = useState("Prices are exclusive of applicable tax unless stated. This quotation is valid until the date shown above.")

  // Items + money
  const [lines, setLines] = useState<EditableLine[]>([emptyLine()])
  const [money, setMoney] = useState<QuoteMoneyInput>(emptyQuoteMoney())

  // Load services + initial source data
  useEffect(() => {
    fetchQuotationServices().then((r) => setServices(r.services)).catch(() => {})
  }, [])

  useEffect(() => {
    let active = true
    const leadId = searchParams.get("leadId")
    const clientId = searchParams.get("clientId")
    setLoading(true)
    setError("")

    const loadLead = async (leadId: string) => {
      const detail = await fetchLead(leadId)
      if (!active) return
      setLead(detail.lead)
      const l = detail.lead
      setClientName(l.company || l.name || "")
      setContactPerson(l.company ? l.name : "")
      setClientEmail(l.email || "")
      setClientPhone(l.phone || "")
      setLocation(l.location || "")
      setProjectTitle(l.projectType || l.service?.title || "")
      setProjectDescription(l.description || "")
    }
    const loadClient = async (clientId: string) => {
      const detail = await fetchClient(clientId)
      if (!active) return
      const c = detail.client
      setPickedClient(c)
      setClientName(c.company || c.name)
      setContactPerson(c.name)
      setClientEmail(c.email || "")
      setClientPhone(c.phone || "")
      setClientAddress(c.address || "")
    }

    const run = async () => {
      try {
        if (editMode && id) {
          const detail = await fetchQuotation(id)
          if (!active) return
          const q = detail.quotation
          if (String(q.status) !== "Draft") {
            setError("Only draft quotations can be edited. Create a revision instead.")
          }
          setClientName(q.client.company || q.client.name)
          setContactPerson(q.client.name)
          setClientEmail(q.client.email || "")
          setClientPhone(q.client.phone || "")
          setClientAddress(q.client.address || "")
          if (q.client.id) setPickedClient({ id: q.client.id, code: q.client.code, name: q.client.name, company: q.client.company, email: q.client.email, phone: q.client.phone, whatsapp: "", address: q.client.address, industry: "", type: "Individual", notes: "", createdAt: "", updatedAt: "" })
          setQuotationDate(q.quotationDate)
          setValidUntil(q.validUntil)
          setProjectTitle(q.projectTitle)
          setLocation(q.location)
          setPreparedBy(q.preparedBy)
          setCurrency(q.currency)
          setCustomCurrency(!CURRENCY_PRESETS.some((c) => c.code === q.currency.code))
          setProjectDescription(q.projectDescription)
          setScopeOfWork(q.scopeOfWork)
          setNotes(q.notes)
          setPaymentTerms(q.paymentTerms)
          setTerms(q.terms)
          setLines(q.items.length > 0 ? q.items.map((item) => wireLineToEditable(item, q.currency)) : [emptyLine()])
          setMoney(wireToQuoteMoney(q, q.currency))
        } else if (leadId) {
          await loadLead(leadId)
        } else if (clientId) {
          await loadClient(clientId)
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load the quotation")
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, searchParams.get("leadId"), searchParams.get("clientId")])

  const itemsPayload = useMemo(
    () => lines.map((line) => editableLineToWire(line, currency)).filter((l) => l.description.trim() || l.service.id),
    [lines, currency],
  )

  const save = async () => {
    setSaving(true)
    setSaveError("")
    try {
      if (editMode && id) {
        const result = await updateQuotation(id, {
          validUntil,
          projectTitle,
          location,
          projectDescription,
          scopeOfWork,
          notes,
          paymentTerms,
          terms,
          preparedBy,
          currency,
          items: itemsPayload,
          ...quoteMoneyToWire(money, currency),
        })
        navigate(`/admin/quotations/${result.quotation.id}`)
        return
      }

      // Create: resolve the client. Picked/linked → clientId; manual → snapshot.
      let clientId = linkedClientId
      if (!clientId && initialSource === "manual" && clientName.trim() && (clientEmail.trim() || clientPhone.trim())) {
        // Dedupe: reuse an existing client with the same email/phone instead of
        // creating a duplicate behind the admin's back.
        const search = await fetchClients({ query: clientEmail || clientPhone, pageSize: 100 })
        const digits = (v: string) => v.replace(/\D/g, "")
        const match =
          search.clients.find((c) => clientEmail && c.email && c.email === clientEmail.toLowerCase()) ||
          search.clients.find((c) => clientPhone && digits(c.phone) === digits(clientPhone))
        if (match) {
          clientId = match.id
        } else {
          const created = await createClient({
            name: contactPerson.trim() || clientName.trim(),
            company: clientName !== contactPerson ? clientName.trim() : "",
            email: clientEmail,
            phone: clientPhone,
            address: clientAddress,
          })
          clientId = created.client.id
        }
      }

      const result = await createQuotation({
        clientId: clientId || undefined,
        leadId: lead?.id || undefined,
        quotationDate,
        validUntil,
        projectTitle,
        location,
        projectDescription,
        scopeOfWork,
        notes,
        paymentTerms,
        terms,
        preparedBy,
        currency,
        items: itemsPayload,
        ...quoteMoneyToWire(money, currency),
        ...(clientId ? {} : { client: { name: clientName, company: "", email: clientEmail, phone: clientPhone, address: clientAddress } }),
      })
      navigate(`/admin/quotations/${result.quotation.id}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save the quotation")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <CrmSpinner />
  if (error) return <CrmErrorState message={error} />

  const sourceLabel = editMode ? "Edit draft" : initialSource === "lead" ? "From CRM lead" : initialSource === "client" ? "From CRM client" : "New quotation"

  return (
    <div className="space-y-4">
      <Link to="/admin/quotations/all" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All quotations
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{sourceLabel}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-brand-dark">
            {editMode ? "Edit quotation draft" : "Create quotation"}
          </h1>
        </div>
        {!editMode && (
          <div className="flex gap-2">
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
              title="Pick an existing CRM client instead of typing details"
            >
              <Search className="h-3.5 w-3.5" /> Use existing client
            </button>
          </div>
        )}
      </div>

      {/* 1 · Quotation information */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-dark">1 · Quotation information</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-muted-foreground">
            Quotation date
            <input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} disabled={editMode} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm disabled:bg-muted/40" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Valid until
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
            Project title
            <input value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} placeholder="e.g. Topographical survey — Ibadan site" className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Project location
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Ibadan, Oyo State" className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Prepared by
            <input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} placeholder="defaults to your admin name" className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Currency
            <select
              value={customCurrency ? "custom" : currency.code}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setCustomCurrency(true)
                } else {
                  setCustomCurrency(false)
                  const preset = CURRENCY_PRESETS.find((c) => c.code === e.target.value)
                  if (preset) setCurrency(preset)
                }
              }}
              className="mt-1 w-full rounded-md border bg-white px-2.5 py-2 text-sm"
            >
              {CURRENCY_PRESETS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
          </label>
          {customCurrency && (
            <>
              <label className="text-xs font-medium text-muted-foreground">
                Currency code
                <input
                  value={currency.code}
                  onChange={(e) => setCurrency({ ...currency, code: e.target.value.toUpperCase().slice(0, 8) })}
                  placeholder="e.g. ZAR"
                  className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Symbol
                <input value={currency.symbol} onChange={(e) => setCurrency({ ...currency, symbol: e.target.value.slice(0, 8) })} placeholder="e.g. R" className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
              </label>
            </>
          )}
        </div>
      </section>

      {/* 2 · Client */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
          <Building2 className="h-3.5 w-3.5 text-brand-brown" /> 2 · Client
        </h2>
        {lead && (
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-brand-green" /> Pre-filled from lead
            <Link to={`/admin/crm/leads/${lead.id}`} className="inline-flex items-center gap-1 font-mono font-semibold text-brand-brown hover:underline">
              {lead.code} <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        )}
        {pickedClient && !lead && (
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            Linked CRM client
            <Link to={`/admin/crm/clients/${pickedClient.id}`} className="inline-flex items-center gap-1 font-mono font-semibold text-brand-brown hover:underline">
              {pickedClient.code} <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted-foreground">
            Client / company name
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} disabled={editMode} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm disabled:bg-muted/40" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Contact person
            <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Email
            <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} type="email" className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Phone
            <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
            Address
            <input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
        </div>
        {editMode && (
          <p className="mt-2 text-xs text-muted-foreground">Client details are fixed after creation — they snapshot the CRM record at quotation time.</p>
        )}
      </section>

      {/* 3 · Project description / scope */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-dark">3 · Project</h2>
        <div className="mt-3 space-y-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Project description
            <textarea value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} rows={4} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Scope of work
            <textarea value={scopeOfWork} onChange={(e) => setScopeOfWork(e.target.value)} rows={4} placeholder="Bullet the deliverables and stages…" className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
        </div>
      </section>

      {/* 4 · Line items + financial summary */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-dark">4 · Line items</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Services come from the CMS catalogue — pick one or write a custom item. Totals calculate on safe integer arithmetic.</p>
        <div className="mt-3">
          <LineItemsEditor lines={lines} onChange={setLines} currency={currency} services={services} />
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-dark">5 · Financial summary</h2>
        <div className="mt-3">
          <FinancialSummary lines={lines} money={money} onMoneyChange={setMoney} currency={currency} />
        </div>
      </section>

      {/* 6 · Terms */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-dark">6 · Terms &amp; notes</h2>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Payment terms
            <textarea value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} rows={3} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Terms &amp; conditions
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground lg:col-span-2">
            Additional notes (internal — never shown to the client)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
        </div>
      </section>

      {saveError && <CrmErrorState message={saveError} />}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={saving || itemsPayload.length === 0 || !projectTitle.trim() || !clientName.trim()}
          title={!projectTitle.trim() ? "Project title is required" : !clientName.trim() ? "Client name is required" : itemsPayload.length === 0 ? "Add at least one line item" : "Save as draft"}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-4 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Saving…" : editMode ? "Save changes" : "Save draft"}
        </button>
        <button onClick={() => navigate(-1)} className="rounded-md border px-3 py-2 text-sm">
          Cancel
        </button>
        <p className="text-xs text-muted-foreground">Numbering, status and CRM links are assigned on save.</p>
      </div>

      <ClientPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPicked={(client) => {
          setPickedClient(client)
          setClientName(client.company || client.name)
          setContactPerson(client.name)
          setClientEmail(client.email || "")
          setClientPhone(client.phone || "")
          setClientAddress(client.address || "")
          setPickerOpen(false)
        }}
      />
    </div>
  )
}
