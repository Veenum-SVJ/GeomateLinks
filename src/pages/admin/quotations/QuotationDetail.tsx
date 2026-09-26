// Quotation detail: full record + lifecycle actions, version chain, audit
// history, CRM links (View Lead / View Client), preview and PDF actions.
import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, Pencil, Send, GitBranch, Copy, Archive, ArchiveRestore, CheckCircle2,
  Eye, Printer, FileDown, Users, Building2, FolderPlus, RefreshCw,
} from "lucide-react"
import type { SiteContent } from "@/types/content"
import {
  fetchQuotation, changeQuotationStatus, reviseQuotation, duplicateQuotation,
  setQuotationArchived,
} from "@/lib/quotationsApi"
import { fetchContent } from "@/lib/api"
import { formatMinor } from "@/lib/money"
import { crmDayOnly, crmRelativeTime, CrmSpinner, CrmErrorState, CrmEmptyState, CrmConfirmDialog } from "@/components/admin/crm/CrmUI"
import {
  QuotationStatusBadge, VersionBadge, QuotationHistoryList, QuotationVersionsList, ArchivedBadge,
} from "@/components/admin/quotations/QuotationUI"
import { SendEmailDialog, RejectDialog, QuotationStatusDialog, CreateProjectDialog } from "@/components/admin/quotations/QuotationDialogs"
import type { QuotationDetailResult } from "@/types/quotations"

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<QuotationDetailResult | null>(null)
  const [content, setContent] = useState<SiteContent | null>(null)
  const [error, setError] = useState("")
  const [actionError, setActionError] = useState("")
  const [busy, setBusy] = useState("")
  const [confirm, setConfirm] = useState<null | { title: string; description: string; confirmLabel: string; run: () => Promise<void> }>(null)

  const [sendOpen, setSendOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setError("")
    try {
      setDetail(await fetchQuotation(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the quotation")
    }
  }, [id])

  useEffect(() => {
    load()
    fetchContent().then(setContent).catch(() => setContent(null))
  }, [load])

  if (error && !detail) return <CrmErrorState message={error} onRetry={load} />
  if (!detail) return <CrmSpinner />

  const q = detail.quotation
  const status = String(q.status)
  const isDraft = status === "Draft"
  const isTerminal = ["Accepted", "Rejected", "Expired", "Cancelled"].includes(status)
  const isArchived = q.archived

  const doRevise = async () => {
    setBusy("revise")
    setActionError("")
    try {
      const result = await reviseQuotation(q.id)
      navigate(`/admin/quotations/${result.quotation.id}`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not create the revision")
    } finally {
      setBusy("")
    }
  }

  const doDuplicate = async () => {
    setBusy("duplicate")
    setActionError("")
    try {
      const result = await duplicateQuotation(q.id)
      navigate(`/admin/quotations/${result.quotation.id}`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not duplicate")
    } finally {
      setBusy("")
    }
  }

  const doArchive = async (archived: boolean) => {
    setBusy("archive")
    setActionError("")
    try {
      await setQuotationArchived(q.id, archived)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not archive")
    } finally {
      setBusy("")
    }
  }

  const openPrint = (mode: "preview" | "print" | "pdf") => {
    const suffix = mode === "preview" ? "" : mode === "print" ? "?action=print" : "?pdf=1"
    const win = window.open(`/admin/quotations/${q.id}/print${suffix}`, "_blank")
    if (!win) setActionError("Allow pop-ups for this site to preview, print or download the PDF.")
  }

  // Prior versions open read-only: redirect to the current one.
  if (q.supersedesId) {
    return (
      <div className="space-y-4">
        <Link to="/admin/quotations/all" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All quotations
        </Link>
        <CrmEmptyState
          icon={<GitBranch className="h-8 w-8" />}
          title={`Version ${q.version} of ${q.number} (superseded)`}
          description="Prior versions are preserved read-only. Open the current version to take action."
          actionLabel="Open current version"
          onAction={async () => {
            try {
              const fresh = await fetchQuotation(q.rootId || q.id)
              const currentId = fresh.versions.find((v) => v.isCurrent)?.id
              if (currentId) navigate(`/admin/quotations/${currentId}`)
            } catch {
              setActionError("Could not find the current version")
            }
          }}
        />
        {actionError && <CrmErrorState message={actionError} />}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link to="/admin/quotations/all" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All quotations
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Quotation {q.number} · v{q.version}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-brand-dark">{q.projectTitle}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <QuotationStatusBadge status={status} />
            <VersionBadge version={q.version} isCurrent />
            {isArchived && <ArchivedBadge />}
            {q.sentAt && <span className="text-xs text-muted-foreground">sent {crmDayOnly(q.sentAt)}</span>}
            {q.validUntil && <span className="text-xs text-muted-foreground">valid until {crmDayOnly(q.validUntil)}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {isDraft && (
            <>
              <button onClick={() => setSendOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90">
                <Send className="h-3.5 w-3.5" /> Send by Email
              </button>
              <button onClick={() => navigate(`/admin/quotations/${q.id}/edit`)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            </>
          )}
          {!isDraft && !isTerminal && (
            <>
              <button onClick={() => setSendOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
                <RefreshCw className="h-3.5 w-3.5" /> Resend
              </button>
              <button onClick={() => setStatusOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
                Status
              </button>
              <button onClick={() => setRejectOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                Reject
              </button>
              <button
                onClick={() =>
                  setConfirm({
                    title: "Accept this quotation?",
                    description: "Accepting closes the review and unlocks the Create Project handoff.",
                    confirmLabel: "Accept",
                    run: async () => {
                      await changeQuotationStatus(q.id, "Accepted")
                      await load()
                    },
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-green px-3 py-2 text-sm font-semibold text-white hover:bg-brand-green/90"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Accept
              </button>
            </>
          )}
          {status === "Accepted" && (
            <button onClick={() => setProjectOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-green px-3 py-2 text-sm font-semibold text-white hover:bg-brand-green/90">
              <FolderPlus className="h-3.5 w-3.5" /> Create Project
            </button>
          )}
          {isTerminal && (
            <button onClick={doRevise} disabled={busy === "revise"} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
              <GitBranch className="h-3.5 w-3.5" /> {busy === "revise" ? "Creating…" : "Create Revision"}
            </button>
          )}
          <button onClick={doDuplicate} disabled={busy === "duplicate"} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </button>
          <button
            onClick={() =>
              setConfirm({
                title: isArchived ? "Restore quotation" : "Archive quotation",
                description: isArchived
                  ? "The quotation returns to the active lists."
                  : "Archived quotations stay available for record keeping but leave the active lists. This is the normal retirement path — there is no delete in the interface.",
                confirmLabel: isArchived ? "Restore" : "Archive",
                run: () => doArchive(!isArchived),
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            {isArchived ? "Restore" : "Archive"}
          </button>
        </div>
      </div>

      {actionError && <CrmErrorState message={actionError} />}

      {/* Document actions */}
      <div className="flex flex-wrap gap-2 rounded-lg border bg-white p-3">
        <button onClick={() => openPrint("preview")} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
          <Eye className="h-3.5 w-3.5" /> Preview
        </button>
        <button onClick={() => openPrint("print")} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
        <button onClick={() => openPrint("pdf")} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
          <FileDown className="h-3.5 w-3.5" /> Download PDF
        </button>
        <p className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto sm:self-center">
          The print window uses the browser's PDF export; Download PDF saves a ready-to-send file.
        </p>
      </div>

      {/* Content grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-4 lg:col-span-1">
          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Client</h2>
            <p className="mt-1 font-medium text-brand-dark">{q.client.company || q.client.name}</p>
            {q.client.company && q.client.name && <p className="text-sm text-muted-foreground">Attn: {q.client.name}</p>}
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Email</dt><dd className="min-w-0 truncate">{q.client.email || "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Phone</dt><dd>{q.client.phone || "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Address</dt><dd className="min-w-0 text-right">{q.client.address || "—"}</dd></div>
            </dl>
            <div className="mt-3 space-y-2 border-t pt-3">
              {q.client.id && (
                <Link to={`/admin/crm/clients/${q.client.id}`} className="flex items-center justify-between rounded-md border border-brand-green/20 bg-brand-green/5 px-3 py-2 text-sm hover:bg-brand-green/10">
                  <span className="inline-flex items-center gap-2 text-brand-green"><Building2 className="h-3.5 w-3.5" /> View Client</span>
                  <span className="font-mono text-xs">{q.client.code}</span>
                </Link>
              )}
              {q.lead.id && (
                <Link to={`/admin/crm/leads/${q.lead.id}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                  <span className="inline-flex items-center gap-2"><Users className="h-3.5 w-3.5 text-brand-brown" /> View Lead</span>
                  <span className="font-mono text-xs">{q.lead.code}</span>
                </Link>
              )}
              {!q.lead.id && <p className="text-xs text-muted-foreground">No CRM lead linked.</p>}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Financial summary</h2>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatMinor(q.subtotalMinor, q.currency)}</dd></div>
              {q.lineDiscountMinor > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Line discounts</dt><dd>− {formatMinor(q.lineDiscountMinor, q.currency)}</dd></div>}
              {q.quoteDiscountMinor > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Quotation discount</dt><dd>− {formatMinor(q.quoteDiscountMinor, q.currency)}</dd></div>}
              {q.additionalChargesMinor > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Additional charges</dt><dd>+ {formatMinor(q.additionalChargesMinor, q.currency)}</dd></div>}
              {q.taxMinor > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd>+ {formatMinor(q.taxMinor, q.currency)}</dd></div>}
              <div className="flex justify-between border-t pt-2"><dt className="font-semibold">Grand total</dt><dd className="text-lg font-bold">{formatMinor(q.grandTotalMinor, q.currency)}</dd></div>
            </dl>
            {q.rejectionReason && (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Rejected{q.rejectionReason ? ` — ${q.rejectionReason}` : ""}{q.rejectionNotes ? `: ${q.rejectionNotes}` : ""}
              </p>
            )}
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Versions</h2>
            <div className="mt-2">
              <QuotationVersionsList versions={detail.versions} currentId={q.id} currency={q.currency} />
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Quotation details</h2>
            <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-2 sm:block"><dt className="text-muted-foreground sm:text-xs sm:uppercase sm:tracking-wide">Number</dt><dd className="font-mono">{q.number}</dd></div>
              <div className="flex justify-between gap-2 sm:block"><dt className="text-muted-foreground sm:text-xs sm:uppercase sm:tracking-wide">Date</dt><dd>{crmDayOnly(q.quotationDate)}</dd></div>
              <div className="flex justify-between gap-2 sm:block"><dt className="text-muted-foreground sm:text-xs sm:uppercase sm:tracking-wide">Valid until</dt><dd>{q.validUntil ? crmDayOnly(q.validUntil) : "—"}</dd></div>
              <div className="flex justify-between gap-2 sm:block"><dt className="text-muted-foreground sm:text-xs sm:uppercase sm:tracking-wide">Prepared by</dt><dd>{q.preparedBy || "—"}</dd></div>
              <div className="flex justify-between gap-2 sm:block"><dt className="text-muted-foreground sm:text-xs sm:uppercase sm:tracking-wide">Currency</dt><dd>{q.currency.code}</dd></div>
              <div className="flex justify-between gap-2 sm:block"><dt className="text-muted-foreground sm:text-xs sm:uppercase sm:tracking-wide">Last updated</dt><dd>{crmRelativeTime(q.updatedAt)}</dd></div>
            </dl>
            {q.location && <p className="mt-2 text-sm"><span className="text-muted-foreground">Location:</span> {q.location}</p>}
            {q.projectDescription && (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{q.projectDescription}</p>
              </div>
            )}
            {q.scopeOfWork && (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scope of work</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{q.scopeOfWork}</p>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-lg border bg-white">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold text-brand-dark">Line items</h2>
              <span className="text-xs text-muted-foreground">{q.currency.code}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-2 py-2 font-medium">Qty</th>
                    <th className="px-2 py-2 font-medium">Unit</th>
                    <th className="px-3 py-2 text-right font-medium">Unit price</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {q.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-brand-dark">{item.description || item.service.title || "—"}</p>
                        {item.service.title && item.description && item.description !== item.service.title && (
                          <p className="text-xs text-muted-foreground">Service: {item.service.title}</p>
                        )}
                      </td>
                      <td className="px-2 py-2.5">{item.quantity}</td>
                      <td className="px-2 py-2.5">{item.unit || "—"}</td>
                      <td className="px-3 py-2.5 text-right">{formatMinor(item.unitPriceMinor, q.currency)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{formatMinor(item.totalMinor, q.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">Terms</h2>
            {q.paymentTerms && (
              <div className="mt-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment terms</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{q.paymentTerms}</p>
              </div>
            )}
            {q.terms && (
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Terms &amp; conditions</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{q.terms}</p>
              </div>
            )}
            {q.notes && (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Internal notes (never sent to client)</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{q.notes}</p>
              </div>
            )}
            {!q.paymentTerms && !q.terms && !q.notes && <p className="mt-2 text-sm text-muted-foreground">No terms recorded.</p>}
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold text-brand-dark">History</h2>
            <div className="mt-3">
              <QuotationHistoryList history={detail.history} />
            </div>
          </section>
        </div>
      </div>

      {/* Dialogs */}
      <SendEmailDialog
        open={sendOpen}
        quotation={q}
        companyName={content?.company?.name || ""}
        onClose={() => setSendOpen(false)}
        onSent={(quotation) => {
          setSendOpen(false)
          setDetail({ ...detail, quotation })
          load()
        }}
      />
      <RejectDialog
        open={rejectOpen}
        quotation={q}
        onClose={() => setRejectOpen(false)}
        onConfirm={async (reason, notes) => {
          await changeQuotationStatus(q.id, "Rejected", { reason, notes })
          await load()
        }}
      />
      <QuotationStatusDialog open={statusOpen} quotation={q} onClose={() => setStatusOpen(false)} onSaved={() => { setStatusOpen(false); load() }} />
      <CreateProjectDialog open={projectOpen} quotation={q} onClose={() => setProjectOpen(false)} onDone={load} />
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
    </div>
  )
}
