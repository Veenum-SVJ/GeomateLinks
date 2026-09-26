// Printable quotation document — the canonical A4 layout used for Preview,
// Print and Download PDF. Branding (company name, address, contacts, RC
// number, logo) comes live from CMS content — never hard-coded.
//   /admin/quotations/:id/print            preview
//   /admin/quotations/:id/print?action=print  opens the print dialog
//   /admin/quotations/:id/print?pdf=1      renders, then saves a real .pdf
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Printer, Loader2 } from "lucide-react"
import type { SiteContent } from "@/types/content"
import { fetchQuotation } from "@/lib/quotationsApi"
import { fetchContent, fallbackContent } from "@/lib/api"
import { formatMinor, bpToPercentText } from "@/lib/money"
import { crmDayOnly } from "@/components/admin/crm/CrmUI"
import type { QuotationDetailResult, Quotation } from "@/types/quotations"

export default function QuotationPrint() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<QuotationDetailResult | null>(null)
  const [content, setContent] = useState<SiteContent | null>(null)
  const [error, setError] = useState("")
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchQuotation(id).then(setDetail).catch((err) => setError(err instanceof Error ? err.message : "Could not load the quotation"))
    fetchContent().then(setContent).catch(() => setContent(fallbackContent))
  }, [id])

  // ?action=print → open the browser print dialog once rendered.
  useEffect(() => {
    if (detail && new URLSearchParams(window.location.search).get("action") === "print") {
      const timer = window.setTimeout(() => window.print(), 400)
      return () => window.clearTimeout(timer)
    }
  }, [detail])

  const generatePdf = async (quotation: Quotation) => {
    const el = document.getElementById("quotation-document")
    if (!el) return
    setPdfBusy(true)
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")])
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", logging: false })
      const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgW = pageW
      const imgHFull = (canvas.height / canvas.width) * imgW
      const sliceH = Math.floor((canvas.width * pageH) / imgW)
      let y = 0
      let page = 0
      while (y < canvas.height) {
        const sliceCanvas = document.createElement("canvas")
        sliceCanvas.width = canvas.width
        sliceCanvas.height = Math.min(sliceH, canvas.height - y)
        const ctx = sliceCanvas.getContext("2d")
        if (!ctx) break
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
        ctx.drawImage(canvas, 0, y, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height)
        if (page > 0) pdf.addPage()
        pdf.addImage(sliceCanvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, imgW, (sliceCanvas.height / canvas.width) * imgW)
        y += sliceH
        page += 1
      }
      void imgHFull
      pdf.save(`${quotation.number}-v${quotation.version}.pdf`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the PDF")
    } finally {
      setPdfBusy(false)
    }
  }

  useEffect(() => {
    if (detail && new URLSearchParams(window.location.search).get("pdf") === "1") {
      generatePdf(detail.quotation)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-8 text-center">
        <div>
          <p className="text-sm text-red-700">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">Your admin session may have expired — log in again and retry.</p>
        </div>
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-brand-brown" />
      </div>
    )
  }

  const q = detail.quotation
  const company = content?.company
  const companyLines = company
    ? [
        [company.address?.suite, company.address?.street].filter(Boolean).join(", "),
        [company.address?.city, company.address?.state].filter(Boolean).join(", "),
        [company.address?.country].filter(Boolean).join(""),
      ].filter(Boolean)
    : []

  return (
    <div className="min-h-screen bg-muted/40 py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: A4; margin: 12mm 10mm; }
        #quotation-document { width: 794px; margin: 0 auto; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          #quotation-document { width: auto; margin: 0; box-shadow: none; border: none; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
          .doc-table thead { display: table-header-group; }
          .doc-table tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-between gap-2 px-2 print:hidden">
        <p className="text-xs text-muted-foreground">{q.number} · document preview</p>
        <div className="flex gap-2">
          <button
            onClick={() => generatePdf(q)}
            disabled={pdfBusy}
            className="inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDownIcon />} {pdfBusy ? "Rendering…" : "Download PDF"}
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>
      </div>

      {/* A4 document */}
      <div id="quotation-document" className="border border-border bg-white px-10 py-8 text-[13px] leading-relaxed text-stone-800 shadow-sm print:border-0 print:shadow-none">
        {/* Header */}
        <header className="avoid-break flex items-start justify-between gap-6 border-b-2 border-stone-800 pb-4">
          <div className="flex items-start gap-3">
            <img src="/favicon.ico" alt="" className="h-11 w-11 rounded" />
            <div>
              <h1 className="text-lg font-bold leading-tight text-stone-900">{company?.name || "Geomate Links Consulting Limited"}</h1>
              {company?.rcNumber && <p className="text-[11px] text-stone-500">RC {company.rcNumber}</p>}
              <div className="mt-1 space-y-0.5 text-[11px] text-stone-600">
                {companyLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {company?.phones?.length ? <p>{company.phones.join(" · ")}</p> : null}
                {company?.emails?.length ? <p>{company.emails.join(" · ")}</p> : null}
                {company?.website ? <p>{company.website}</p> : null}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-700">Quotation</p>
            <p className="font-mono text-base font-bold text-stone-900">{q.number}</p>
            <p className="mt-1 text-[11px] text-stone-600">Version {q.version}</p>
            <p className="text-[11px] text-stone-600">Date: {crmDayOnly(q.quotationDate)}</p>
            {q.validUntil && <p className="text-[11px] text-stone-600">Valid until: {crmDayOnly(q.validUntil)}</p>}
          </div>
        </header>

        {/* Client + project blocks */}
        <div className="avoid-break mt-5 grid grid-cols-2 gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">Client</p>
            <p className="mt-1 font-semibold text-stone-900">{q.client.company || q.client.name}</p>
            {q.client.company && q.client.name && <p className="text-stone-600">Attn: {q.client.name}</p>}
            {q.client.address && <p className="text-stone-600">{q.client.address}</p>}
            {q.client.email && <p className="text-stone-600">{q.client.email}</p>}
            {q.client.phone && <p className="text-stone-600">{q.client.phone}</p>}
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">Project</p>
            <p className="mt-1 font-semibold text-stone-900">{q.projectTitle}</p>
            {q.location && <p className="text-stone-600">Location: {q.location}</p>}
            <p className="text-stone-600">Prepared by: {q.preparedBy || "—"}</p>
          </div>
        </div>

        {q.projectDescription && (
          <section className="avoid-break mt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">Project description</p>
            <p className="mt-1 whitespace-pre-wrap text-stone-700">{q.projectDescription}</p>
          </section>
        )}
        {q.scopeOfWork && (
          <section className="avoid-break mt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">Scope of work</p>
            <p className="mt-1 whitespace-pre-wrap text-stone-700">{q.scopeOfWork}</p>
          </section>
        )}

        {/* Items */}
        <table className="doc-table mt-5 w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-y border-stone-800 bg-stone-100 text-left">
              <th className="py-1.5 pl-1 font-semibold uppercase tracking-wide text-stone-700">Description</th>
              <th className="w-14 py-1.5 text-center font-semibold uppercase tracking-wide text-stone-700">Qty</th>
              <th className="w-20 py-1.5 text-center font-semibold uppercase tracking-wide text-stone-700">Unit</th>
              <th className="w-28 py-1.5 pr-1 text-right font-semibold uppercase tracking-wide text-stone-700">Unit price</th>
              <th className="w-32 py-1.5 pr-1 text-right font-semibold uppercase tracking-wide text-stone-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((item) => (
              <tr key={item.id} className="border-b border-stone-200 align-top">
                <td className="py-1.5 pl-1">
                  <p className="font-medium text-stone-900">{item.description || item.service.title || "—"}</p>
                  {item.service.title && item.description && item.description !== item.service.title && (
                    <p className="text-[10px] text-stone-500">Service: {item.service.title}</p>
                  )}
                  {item.discountMinor > 0 && <p className="text-[10px] text-stone-500">incl. discount −{formatMinor(item.discountMinor, q.currency)}</p>}
                  {item.taxMinor > 0 && <p className="text-[10px] text-stone-500">incl. tax {formatMinor(item.taxMinor, q.currency)}</p>}
                </td>
                <td className="py-1.5 text-center">{item.quantity}</td>
                <td className="py-1.5 text-center">{item.unit || "—"}</td>
                <td className="py-1.5 pr-1 text-right">{formatMinor(item.unitPriceMinor, q.currency)}</td>
                <td className="py-1.5 pr-1 text-right font-semibold text-stone-900">{formatMinor(item.totalMinor, q.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="avoid-break mt-4 flex justify-end">
          <dl className="w-72 space-y-1 text-[12px]">
            <div className="flex justify-between"><dt className="text-stone-600">Subtotal</dt><dd>{formatMinor(q.subtotalMinor, q.currency)}</dd></div>
            {q.lineDiscountMinor > 0 && <div className="flex justify-between"><dt className="text-stone-600">Discounts</dt><dd>− {formatMinor(q.lineDiscountMinor, q.currency)}</dd></div>}
            {q.quoteDiscountMinor > 0 && <div className="flex justify-between"><dt className="text-stone-600">Quotation discount</dt><dd>− {formatMinor(q.quoteDiscountMinor, q.currency)}</dd></div>}
            {q.additionalChargesMinor > 0 && <div className="flex justify-between"><dt className="text-stone-600">Additional charges</dt><dd>+ {formatMinor(q.additionalChargesMinor, q.currency)}</dd></div>}
            {q.taxMinor > 0 && <div className="flex justify-between"><dt className="text-stone-600">Tax ({bpToPercentText(q.taxBp)}%)</dt><dd>+ {formatMinor(q.taxMinor, q.currency)}</dd></div>}
            <div className="mt-1 flex justify-between border-t-2 border-stone-800 pt-1.5">
              <dt className="font-bold uppercase tracking-wide text-stone-900">Total</dt>
              <dd className="font-bold text-stone-900">{formatMinor(q.grandTotalMinor, q.currency)}</dd>
            </div>
          </dl>
        </div>

        {/* Terms */}
        {q.paymentTerms && (
          <section className="avoid-break mt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">Payment terms</p>
            <p className="mt-1 whitespace-pre-wrap text-stone-700">{q.paymentTerms}</p>
          </section>
        )}
        {q.terms && (
          <section className="avoid-break mt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">Terms &amp; conditions</p>
            <p className="mt-1 whitespace-pre-wrap text-stone-700">{q.terms}</p>
          </section>
        )}

        {/* Signature */}
        <div className="avoid-break mt-8 flex justify-between">
          <div className="text-[11px] text-stone-600">
            <p>We remain available to discuss any aspect of this quotation.</p>
            <p className="mt-1">Thank you for considering {company?.shortName || "us"}.</p>
          </div>
          <div className="w-56 text-center">
            <div className="h-10" />
            <div className="border-t border-stone-800 pt-1">
              <p className="text-[11px] font-semibold text-stone-900">{q.preparedBy || "Authorized Signature"}</p>
              <p className="text-[10px] text-stone-600">For: {company?.name || "Geomate Links Consulting Limited"}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 border-t border-stone-300 pt-2 text-center text-[10px] text-stone-500">
          {company?.name || "Geomate Links Consulting Limited"}
          {company?.rcNumber ? ` · RC ${company.rcNumber}` : ""} — Quotation {q.number} v{q.version}
          {q.validUntil ? ` · valid until ${crmDayOnly(q.validUntil)}` : ""}
        </footer>
      </div>
    </div>
  )
}

function FileDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}
