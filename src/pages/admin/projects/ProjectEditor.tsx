// Project editor. Create mode has two paths (PRD §4): FROM QUOTATION —
// pick an accepted quotation, fetch its handoff payload and prefill
// everything (client, lead, quotation, title, description, service,
// location, quoted value); or MANUAL — pick a client and optionally apply a
// template (phases/tasks/milestones/deliverables). Edit mode patches the
// editable fields only; identity, links and finance snapshots are immutable.
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Loader2, Sparkles, Info } from "lucide-react"
import { createProject, updateProject, fetchProject, fetchQuotations, fetchProjects } from "@/lib/projectsApi"
import { fetchClients } from "@/lib/crmApi"
import { fetchQuotationServices, createProjectHandoff } from "@/lib/quotationsApi"
import { PROJECT_TEMPLATES } from "@/lib/projectTemplates"
import { formatMinor, parseToMinor, minorToInputValue, CURRENCY_PRESETS, DEFAULT_CURRENCY } from "@/lib/money"
import { CrmSpinner, CrmErrorState } from "@/components/admin/crm/CrmUI"
import type { Project, ProjectCreateInput, ProjectPatch } from "@/lib/projectsApi"
import type { Client } from "@/types/crm"
import type { CrmServiceRef, ProjectHandoff, Quotation } from "@/types/quotations"
import type { ProjectTemplate } from "@/types/projects"
import { PROJECT_TYPES } from "@/types/projects"
import { cn } from "@/lib/utils"

type Mode = "create" | "edit"

const DEFAULT_PHASES_UI = ["Planning", "Field Work", "Data Processing", "Quality Control", "Deliverables", "Completion"]

export default function ProjectEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const mode: Mode = id ? "edit" : "create"

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [services, setServices] = useState<CrmServiceRef[]>([])
  const [clients, setClients] = useState<Client[]>([])

  // Shared form state
  const [title, setTitle] = useState("")
  const [projectType, setProjectType] = useState("")
  const [priority, setPriority] = useState("Normal")
  const [clientId, setClientId] = useState("")
  const [clientLabel, setClientLabel] = useState("")
  const [description, setDescription] = useState("")
  const [objectives, setObjectives] = useState("")
  const [serviceId, setServiceId] = useState("")
  const [serviceTitle, setServiceTitle] = useState("")
  const [locationDescription, setLocationDescription] = useState("")
  const [locationCity, setLocationCity] = useState("")
  const [locationState, setLocationState] = useState("")
  const [locationAddress, setLocationAddress] = useState("")
  const [startDate, setStartDate] = useState("")
  const [expectedCompletionDate, setExpectedCompletionDate] = useState("")
  const [phases, setPhases] = useState<string[]>(DEFAULT_PHASES_UI)
  const [internalNotes, setInternalNotes] = useState("")
  const [clientFacingSummary, setClientFacingSummary] = useState("")
  const [valueInput, setValueInput] = useState("")
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [paymentTerms, setPaymentTerms] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [leadId, setLeadId] = useState("")
  const [quotationId, setQuotationId] = useState("")
  const [quotationNumber, setQuotationNumber] = useState("")

  // From-quotation path
  const [source, setSource] = useState<"quotation" | "manual">("quotation")
  const [candidates, setCandidates] = useState<Quotation[]>([])
  const [pickedQuotation, setPickedQuotation] = useState<Quotation | null>(null)
  const [handoff, setHandoff] = useState<ProjectHandoff | "loading" | null>(null)

  // Edit mode load
  const [loadingExisting, setLoadingExisting] = useState(mode === "edit")

  useEffect(() => {
    fetchQuotationServices().then((r) => setServices(r.services)).catch(() => {})
    fetchClients({ pageSize: 100 }).then((r) => setClients(r.clients)).catch(() => {})
  }, [])

  useEffect(() => {
    if (mode !== "edit" || !id) return
    setLoadingExisting(true)
    fetchProject(id)
      .then((detail) => hydrate(detail.project))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the project"))
      .finally(() => setLoadingExisting(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode])

  function hydrate(p: Project) {
    setTitle(p.title)
    setProjectType(p.projectType)
    setPriority(p.priority)
    setClientId(p.client.id)
    setClientLabel(p.client.company || p.client.name)
    setDescription(p.description)
    setObjectives(p.objectives)
    setServiceId(p.service.id)
    setServiceTitle(p.service.title)
    setLocationDescription(p.location.description)
    setLocationCity(p.location.city)
    setLocationState(p.location.state)
    setLocationAddress(p.location.address)
    setStartDate(p.startDate)
    setExpectedCompletionDate(p.expectedCompletionDate)
    setPhases(p.phases.length > 0 ? p.phases : DEFAULT_PHASES_UI)
    setInternalNotes(p.internalNotes)
    setClientFacingSummary(p.clientFacingSummary)
    setCurrency(p.currency)
    setPaymentTerms(p.paymentTerms)
    setQuotationNumber(p.quotation.number)
  }

  // Accepted quotations without a project, for the from-quotation path.
  // Projects are fetched in parallel so quotations that already became
  // projects are excluded (the server also enforces one-per-quotation).
  useEffect(() => {
    if (mode !== "create" || source !== "quotation") return
    let active = true
    Promise.all([fetchQuotations({ status: "Accepted", pageSize: 100 }), fetchProjects({ pageSize: 100 })])
      .then(([quotationsResult, projectsResult]) => {
        if (!active) return
        const usedQuotationIds = new Set(projectsResult.projects.map((p) => p.quotation.id).filter(Boolean))
        setCandidates(quotationsResult.quotations.filter((q) => !usedQuotationIds.has(q.id)))
      })
      .catch(() => {
        if (active) setCandidates([])
      })
    return () => {
      active = false
    }
  }, [mode, source])

  const applyHandoff = useCallback(async (quotation: Quotation) => {
    setPickedQuotation(quotation)
    setHandoff("loading")
    setError("")
    try {
      const result = await createProjectHandoff(quotation.id)
      const h = result.handoff
      setHandoff(h)
      setTitle(h.project.title)
      setDescription(h.project.description || h.project.scopeOfWork || "")
      setObjectives(h.project.scopeOfWork || "")
      setLocationDescription(h.project.location || "")
      setClientId(h.client.id)
      setClientLabel(h.client.company || h.client.name)
      setLeadId(h.lead.id)
      setQuotationId(h.quotationId)
      setQuotationNumber(h.quotationNumber)
      const firstService = h.project.services[0]
      if (firstService) {
        setServiceId(firstService.id)
        setServiceTitle(firstService.title)
      }
      setCurrency(h.finance.currency || DEFAULT_CURRENCY)
      setValueInput(minorToInputValue(h.finance.grandTotalMinor, h.finance.currency))
      setPaymentTerms(h.finance.paymentTerms || "")
      // Suggest a template from the quotation's primary service title.
      const match = firstService
        ? PROJECT_TEMPLATES.find((t) => firstService.title.toLowerCase().includes(t.name.split(" ")[0].toLowerCase()))
        : null
      if (match) {
        setTemplateId(match.id)
        setPhases(match.phases)
      }
    } catch (err) {
      setHandoff(null)
      setError(err instanceof Error ? err.message : "Could not prepare the handoff")
    }
  }, [])

  function applyTemplate(template: ProjectTemplate) {
    setPhases(template.phases.length > 0 ? template.phases : DEFAULT_PHASES_UI)
    if (template.projectType) setProjectType(template.projectType)
  }

  const serviceOptions = useMemo(() => {
    const seen = new Set(services.map((s) => s.id))
    const extra = serviceId && serviceTitle && !seen.has(serviceId) ? [{ id: serviceId, title: serviceTitle }] : []
    return [...extra, ...services]
  }, [services, serviceId, serviceTitle])

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      if (mode === "edit" && id) {
        const patch: ProjectPatch = {
          title,
          projectType,
          priority,
          description,
          objectives,
          service: serviceId ? { id: serviceId, title: serviceTitle } : undefined,
          location: { address: locationAddress, area: "", city: locationCity, state: locationState, country: "", lat: null, lon: null, description: locationDescription },
          startDate,
          expectedCompletionDate,
          phases,
          internalNotes,
          clientFacingSummary,
          paymentTerms,
        }
        await updateProject(id, patch)
        navigate(`/admin/pms/${id}`)
        return
      }
      const payload: ProjectCreateInput = {
        clientId,
        leadId: leadId || undefined,
        quotationId: quotationId || undefined,
        title,
        projectType,
        priority,
        description,
        objectives,
        serviceId: serviceId || undefined,
        serviceTitle,
        location: { address: locationAddress, city: locationCity, state: locationState, description: locationDescription },
        startDate,
        expectedCompletionDate,
        phases,
        internalNotes,
        clientFacingSummary,
        paymentTerms,
      }
      if (valueInput) payload.quotedValueMinor = parseToMinor(valueInput, currency)
      if (currency.code !== DEFAULT_CURRENCY.code) payload.currency = currency
      const template = PROJECT_TEMPLATES.find((t) => t.id === templateId)
      if (template) {
        payload.tasks = template.tasks.map((t) => ({ name: t.name, phase: t.phase, description: t.description, priority: t.priority }))
        payload.milestones = template.milestones.map((m) => ({ name: m.name, description: m.description }))
        payload.deliverables = template.deliverables.map((d) => ({ name: d.name, description: d.description }))
      }
      const result = await createProject(payload)
      navigate(`/admin/pms/${result.project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the project")
    } finally {
      setSaving(false)
    }
  }

  if (loadingExisting) return <CrmSpinner />

  return (
    <div className="space-y-4">
      <Link to={mode === "edit" ? `/admin/pms/${id}` : "/admin/pms/all"} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {mode === "edit" ? "Back to project" : "All projects"}
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-brand-dark">{mode === "edit" ? "Edit Project" : "Create Project"}</h1>
        <p className="text-sm text-muted-foreground">{mode === "edit" ? "Update the project record." : "From an accepted quotation (prefilled) or manually."}</p>
      </div>

      {mode === "create" && (
        <div className="rounded-lg border bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            {(
              [
                ["quotation", "From accepted quotation"],
                ["manual", "Create manually"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSource(value)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm font-medium",
                  source === value ? "border-brand-brown bg-brand-brown/10 text-brand-brown" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {source === "quotation" && (
            <div className="mt-3">
              {candidates.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
                  No accepted quotations are waiting for a project. Accept a quotation in the Quotations module first, or switch to “Create manually”.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {candidates.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => applyHandoff(q)}
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50",
                        pickedQuotation?.id === q.id && "border-brand-brown bg-brand-brown/5",
                      )}
                    >
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-medium text-brand-dark">
                          <span className="font-mono text-xs text-brand-brown">{q.number}</span> — {q.projectTitle}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {q.client.company || q.client.name} · {formatMinor(q.grandTotalMinor, q.currency)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {handoff === "loading" && (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing handoff…
                </p>
              )}
              {handoff && handoff !== "loading" && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-brand-green">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Prefilled from {handoff.quotationNumber}: client, lead, title, description, service, location and quoted value. Adjust anything below before saving.
                </p>
              )}
              {candidates.length > 0 && !pickedQuotation && (
                <p className="mt-2 text-xs text-muted-foreground">Pick a quotation above to prefill the form.</p>
              )}
            </div>
          )}
        </div>
      )}

      {error && <CrmErrorState message={error} onRetry={() => setError("")} />}

      {/* Form */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Project</h2>
            <div className="mt-3 space-y-3 text-sm">
              <label className="block text-xs font-medium text-muted-foreground">
                Project title *
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" placeholder="e.g. Bodija Residential Development" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-muted-foreground">
                  Project type
                  <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                    <option value="">—</option>
                    {PROJECT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-muted-foreground">
                  Priority
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                    {["Low", "Normal", "High", "Urgent"].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-xs font-medium text-muted-foreground">
                Project description
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Project objectives
                <textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} rows={3} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
              </label>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Location &amp; schedule</h2>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <label className="block text-xs font-medium text-muted-foreground">
                Address / area
                <input value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                City
                <input value={locationCity} onChange={(e) => setLocationCity(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                State
                <input value={locationState} onChange={(e) => setLocationState(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Location description
                <input value={locationDescription} onChange={(e) => setLocationDescription(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" placeholder="e.g. Plot 14, Bodija Estate" />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Start date
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Expected completion
                <input type="date" value={expectedCompletionDate} onChange={(e) => setExpectedCompletionDate(e.target.value)} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
              </label>
            </div>
          </section>

          {mode === "create" && (
            <section className="rounded-lg border bg-white p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
                <Sparkles className="h-3.5 w-3.5 text-brand-brown" /> Template
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Optional — seeds phases, starter tasks, milestones and deliverables. Everything stays editable after saving.
              </p>
              <select
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value)
                  const t = PROJECT_TEMPLATES.find((x) => x.id === e.target.value)
                  if (t) applyTemplate(t)
                }}
                className="mt-2 w-full rounded-md border bg-white px-2 py-2 text-sm"
              >
                <option value="">No template</option>
                {PROJECT_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {templateId && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {PROJECT_TEMPLATES.find((t) => t.id === templateId)?.phases.length} phases ·{" "}
                  {PROJECT_TEMPLATES.find((t) => t.id === templateId)?.tasks.length} starter tasks ·{" "}
                  {PROJECT_TEMPLATES.find((t) => t.id === templateId)?.milestones.length} milestones ·{" "}
                  {PROJECT_TEMPLATES.find((t) => t.id === templateId)?.deliverables.length} deliverables
                </p>
              )}
            </section>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Client</h2>
            <div className="mt-3 text-sm">
              {mode === "edit" || quotationId ? (
                <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{clientLabel || "—"}</p>
              ) : (
                <>
                  <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full rounded-md border bg-white px-2 py-2 text-sm">
                    <option value="">Select a client…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company || c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-muted-foreground">Clients are managed in the CRM.</p>
                </>
              )}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Service</h2>
            <select
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value)
                setServiceTitle(services.find((s) => s.id === e.target.value)?.title || (e.target.value === serviceId ? serviceTitle : ""))
              }}
              className="mt-2 w-full rounded-md border bg-white px-2 py-2 text-sm"
            >
              <option value="">—</option>
              {serviceOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Quoted value</h2>
            {mode === "edit" ? (
              <p className="mt-2 text-sm text-muted-foreground">
                The quoted value comes from the linked quotation and cannot be edited here.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <select value={currency.code} onChange={(e) => setCurrency(CURRENCY_PRESETS.find((c) => c.code === e.target.value) || DEFAULT_CURRENCY)} className="rounded-md border bg-white px-2 py-2 text-sm">
                  {CURRENCY_PRESETS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
                <input
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="col-span-2 rounded-md border px-2.5 py-2 text-sm"
                />
              </div>
            )}
            {quotationNumber && <p className="mt-1.5 text-xs text-muted-foreground">Linked to {quotationNumber}.</p>}
            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              Payment terms
              <textarea value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
            </label>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Notes</h2>
            <label className="mt-2 block text-xs font-medium text-muted-foreground">
              Internal notes
              <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
            </label>
            <label className="mt-2 block text-xs font-medium text-muted-foreground">
              Client-facing summary
              <textarea value={clientFacingSummary} onChange={(e) => setClientFacingSummary(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
            </label>
          </section>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Link to={mode === "edit" ? `/admin/pms/${id}` : "/admin/pms/all"} className="rounded-md border px-3 py-2 text-sm">
          Cancel
        </Link>
        <button
          type="button"
          onClick={submit}
          disabled={saving || !title || (mode === "create" && !clientId)}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-4 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Create project"}
        </button>
      </div>
    </div>
  )
}
