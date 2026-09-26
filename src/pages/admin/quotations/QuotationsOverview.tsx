// Quotations overview: summary cards, recent quotations, awaiting response,
// recently accepted / rejected — with empty state pointing at Create.
import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { FileText, Plus, Clock3, CheckCircle2, XCircle, Banknote } from "lucide-react"
import { fetchQuotationDashboard } from "@/lib/quotationsApi"
import { formatMinorShort } from "@/lib/money"
import { CrmSpinner, CrmErrorState, CrmEmptyState, crmDayOnly } from "@/components/admin/crm/CrmUI"
import { QuotationList, QuotationStatusBadge } from "@/components/admin/quotations/QuotationUI"
import type { QuotationDashboardResult } from "@/types/quotations"

export default function QuotationsOverview() {
  const navigate = useNavigate()
  const [data, setData] = useState<QuotationDashboardResult | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setError("")
    try {
      setData(await fetchQuotationDashboard())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load quotations")
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const isEmpty = data && data.cards.total === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-dark">Quotations</h1>
          <p className="text-sm text-muted-foreground">Client proposals, from draft to acceptance.</p>
        </div>
        <button
          onClick={() => navigate("/admin/quotations/new")}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90"
        >
          <Plus className="h-4 w-4" /> Create Quotation
        </button>
      </div>

      {error && <CrmErrorState message={error} onRetry={load} />}
      {!data && !error && <CrmSpinner />}

      {isEmpty && (
        <CrmEmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No quotations yet"
          description="Create your first quotation to begin tracking client proposals — from a CRM lead, an existing client, or from scratch."
          actionLabel="Create Quotation"
          onAction={() => navigate("/admin/quotations/new")}
        />
      )}

      {data && !isEmpty && (
        <>
          {/* Cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            {(
              [
                ["Total", data.cards.total, "/admin/quotations/all", "text-brand-dark"],
                ["Drafts", data.cards.draft, "/admin/quotations/list/Draft", "text-muted-foreground"],
                ["Sent", data.cards.sent, "/admin/quotations/list/Sent", "text-amber-600"],
                ["Accepted", data.cards.accepted, "/admin/quotations/list/Accepted", "text-brand-green"],
                ["Rejected", data.cards.rejected, "/admin/quotations/list/Rejected", "text-red-500"],
                ["Expired", data.cards.expired, "/admin/quotations/list/Expired", "text-muted-foreground"],
                ["Awaiting", data.cards.awaitingResponse, "/admin/quotations/all", "text-brand-brown"],
              ] as const
            ).map(([label, value, href, tone]) => (
              <Link key={label} to={href} className="rounded-lg border bg-white px-4 py-3.5 transition-colors hover:bg-muted/40">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
                <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
              </Link>
            ))}
          </div>

          {/* Accepted value banner */}
          {data.cards.acceptedValueMinor > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-brand-green/20 bg-brand-green/5 px-4 py-3">
              <Banknote className="h-5 w-5 shrink-0 text-brand-green" />
              <p className="text-sm text-brand-dark">
                <span className="font-semibold">Accepted value:</span>{" "}
                {formatMinorShort(data.cards.acceptedValueMinor, { code: "NGN", symbol: "₦", minorUnits: 2 })}{" "}
                across {data.cards.accepted} accepted quotation{data.cards.accepted === 1 ? "" : "s"}.
              </p>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-brand-dark">Recent Quotations</h2>
                <Link to="/admin/quotations/all" className="text-xs font-medium text-brand-brown hover:underline">
                  View all
                </Link>
              </div>
              <div className="p-4">
                {data.recentQuotations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing yet.</p>
                ) : (
                  <QuotationList quotations={data.recentQuotations} />
                )}
              </div>
            </section>

            <section className="rounded-lg border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
                  <Clock3 className="h-3.5 w-3.5 text-brand-brown" /> Awaiting Response
                </h2>
                <Link to="/admin/quotations/list/Sent" className="text-xs font-medium text-brand-brown hover:underline">
                  View all
                </Link>
              </div>
              <div className="p-4">
                {data.awaitingResponse.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing awaiting a client response.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.awaitingResponse.map((q) => (
                      <li key={q.id}>
                        <Link to={`/admin/quotations/${q.id}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-brand-dark">
                              {q.number} — {q.client.company || q.client.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {q.projectTitle} · sent {q.sentAt ? crmDayOnly(q.sentAt) : crmDayOnly(q.createdAt)}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-xs font-semibold">{formatMinorShort(q.grandTotalMinor, q.currency)}</span>
                            {q.validUntil && <span className="block text-[11px] text-muted-foreground">valid to {crmDayOnly(q.validUntil)}</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="rounded-lg border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" /> Recently Accepted
                </h2>
              </div>
              <div className="p-4">
                {data.recentlyAccepted.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No accepted quotations yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.recentlyAccepted.map((q) => (
                      <li key={q.id}>
                        <Link to={`/admin/quotations/${q.id}`} className="flex items-center justify-between gap-3 rounded-md border border-brand-green/20 bg-brand-green/5 px-3 py-2 text-sm hover:bg-brand-green/10">
                          <span className="min-w-0 truncate font-medium text-brand-dark">
                            {q.number} — {q.client.company || q.client.name}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{q.acceptedAt ? crmDayOnly(q.acceptedAt) : ""}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="rounded-lg border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
                  <XCircle className="h-3.5 w-3.5 text-red-500" /> Recently Rejected
                </h2>
              </div>
              <div className="p-4">
                {data.recentlyRejected.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rejected quotations.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.recentlyRejected.map((q) => (
                      <li key={q.id}>
                        <Link to={`/admin/quotations/${q.id}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-brand-dark">
                              {q.number} — {q.client.company || q.client.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">{q.rejectionReason || "No reason recorded"}</span>
                          </span>
                          <QuotationStatusBadge status={String(q.status)} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
