// Safe money handling — integer minor-unit arithmetic ONLY.
//
// This is the authoritative frontend mirror of the calculation engine in
// api/_lib/quotationStore.js. The editor uses it for live totals; the server
// recomputes the same values from the same integers on save, so client and
// server can never disagree.
//
// Rules:
//   • Amounts are integers (minor units — kobo for NGN).
//   • Percentages are integer basis points (1000 bp = 10%).
//   • Quantity is a decimal string (non-monetary), handled in hundredths.
//   • No floating-point arithmetic ever touches money values.
import type { Currency, LineDiscount, LineTax, QuoteDiscount } from "@/types/quotations"

export const CURRENCY_PRESETS: Currency[] = [
  { code: "NGN", symbol: "₦", minorUnits: 2 },
  { code: "USD", symbol: "$", minorUnits: 2 },
  { code: "EUR", symbol: "€", minorUnits: 2 },
  { code: "GBP", symbol: "£", minorUnits: 2 },
  { code: "GHS", symbol: "GH₵", minorUnits: 2 },
  { code: "XOF", symbol: "CFA", minorUnits: 0 },
]

export const DEFAULT_CURRENCY: Currency = CURRENCY_PRESETS[0]

// Formats a major-unit number using Intl with the currency code (falls back
// to symbol-prefix when Intl lacks the code — formatting stays consistent).
export function formatMajor(major: number, currency: Currency): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: currency.minorUnits,
      maximumFractionDigits: currency.minorUnits,
    }).format(major)
  } catch {
    return `${currency.symbol}${major.toLocaleString(undefined, { minimumFractionDigits: currency.minorUnits, maximumFractionDigits: currency.minorUnits })}`
  }
}

// Minor units (integer) → display string. 123456 (NGN) → ₦1,234.56
export function formatMinor(minor: number, currency: Currency): string {
  const major = minor / 10 ** currency.minorUnits
  return formatMajor(major, currency)
}

// Compact display for table cells (₦1,850,000.00 → ₦1.85M on narrow lists is
// avoided — the PRD wants real figures; we only strip trailing .00 zeros).
export function formatMinorShort(minor: number, currency: Currency): string {
  const text = formatMinor(minor, currency)
  return currency.minorUnits > 0 ? text.replace(/\.00$/, "") : text
}

// Parses "₦1,234.56" / "1,234" / "1234.56" into integer minor units.
// Accepts the currency symbol and thousands separators; rejects negatives
// (returns 0 — inputs are clamped non-negative at the API too).
export function parseToMinor(input: string, currency: Currency): number {
  const cleaned = String(input || "")
    .replace(new RegExp(`[${currency.symbol.replace(/[^\p{L}\p{N}]/gu, "")}]`, "gu"), "")
    .replace(/[,\s]/g, "")
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return 0
  const [whole, frac = ""] = cleaned.split(".")
  const paddedFrac = frac.slice(0, currency.minorUnits).padEnd(currency.minorUnits, "0")
  return Number(whole || "0") * 10 ** currency.minorUnits + (paddedFrac ? Number(paddedFrac) : 0)
}

// Minor units → editable text ("123456" → "1234.56") for input fields.
export function minorToInputValue(minor: number, currency: Currency): string {
  const major = minor / 10 ** currency.minorUnits
  return currency.minorUnits > 0 ? major.toFixed(currency.minorUnits) : String(Math.round(major))
}

// Basis points → percentage text (1500 → "15"); percentage text → bp.
export function bpToPercentText(bp: number): string {
  return String(Math.round(bp) / 100)
}
export function percentTextToBp(text: string): number {
  const n = Number(String(text || "").replace(/[%,\s]/g, ""))
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(10000, Math.round(n * 100))
}

// ---------------------------------------------------------- line items

export type LineInput = {
  quantity: string
  unitPriceMinor: number
  discount: LineDiscount
  tax: LineTax
}

export type LineTotals = {
  grossMinor: number
  discountMinor: number
  taxMinor: number
  totalMinor: number
}

// Quantity string → hundredths ("1.5" → 150). Falls back to 1 (100).
export function quantityToHundredths(quantity: string): number {
  const n = Number(String(quantity || "").trim())
  if (!Number.isFinite(n) || n <= 0) return 100
  return Math.round(n * 100)
}

// Line gross (before discount): round(quantity × unitPrice) in minor units.
export function lineGross(qtyHundredths: number, unitPriceMinor: number): number {
  return Math.round((qtyHundredths * unitPriceMinor) / 100)
}

// Mirrors normaliseLineItem in api/_lib/quotationStore.js exactly.
export function computeLineTotals(line: LineInput): LineTotals {
  const qtyHundredths = quantityToHundredths(line.quantity)
  const unitPriceMinor = Math.max(0, Math.round(Number(line.unitPriceMinor) || 0))
  const gross = lineGross(qtyHundredths, unitPriceMinor)
  const discountValue =
    line.discount.mode === "percent" ? Math.round((gross * Math.min(10000, Math.max(0, line.discount.bp))) / 10000)
    : line.discount.mode === "fixed" ? Math.min(gross, Math.max(0, Math.round(Number(line.discount.minor) || 0)))
    : 0
  const net = Math.max(0, gross - discountValue)
  const taxValue = line.tax.mode === "percent" ? Math.round((net * Math.min(10000, Math.max(0, line.tax.bp))) / 10000) : 0
  return { grossMinor: gross, discountMinor: discountValue, taxMinor: taxValue, totalMinor: net + taxValue }
}

// ------------------------------------------------------------ quote totals

export type QuoteTotalsInput = {
  items: LineInput[]
  quoteDiscount: QuoteDiscount
  additionalChargesMinor: number
  taxBp: number
}

export type QuoteTotals = {
  subtotalMinor: number
  lineDiscountMinor: number
  quoteDiscountMinor: number
  discountMinor: number
  additionalChargesMinor: number
  taxMinor: number
  grandTotalMinor: number
}

// Mirrors computeTotals in api/_lib/quotationStore.js exactly. Tax rule (no
// double taxation): lines with their own rate pay tax on their own net; the
// quote-level rate applies only to the net the lines did NOT already tax,
// plus additional charges.
export function computeQuoteTotals(input: QuoteTotalsInput): QuoteTotals {
  const lines = input.items.map(computeLineTotals)
  const subtotalMinor = lines.reduce((sum, l) => sum + l.grossMinor, 0)
  const lineDiscountMinor = lines.reduce((sum, l) => sum + l.discountMinor, 0)
  const lineTaxMinor = lines.reduce((sum, l) => sum + l.taxMinor, 0)
  const taxedLinesNetMinor = lines.reduce(
    (sum, l, i) => (input.items[i].tax.mode === "percent" && input.items[i].tax.bp > 0 ? sum + (l.grossMinor - l.discountMinor) : sum),
    0,
  )
  const netAfterLines = subtotalMinor - lineDiscountMinor
  const quoteDiscountValue =
    input.quoteDiscount.mode === "percent" ? Math.round((netAfterLines * Math.min(10000, Math.max(0, input.quoteDiscount.bp))) / 10000)
    : input.quoteDiscount.mode === "fixed" ? Math.min(netAfterLines, Math.max(0, Math.round(Number(input.quoteDiscount.minor) || 0)))
    : 0
  const netMinor = Math.max(0, netAfterLines - quoteDiscountValue)
  const chargesMinor = Math.max(0, Math.round(Number(input.additionalChargesMinor) || 0))
  const taxBp = Math.min(10000, Math.max(0, Math.round(Number(input.taxBp) || 0)))
  const untaxedBaseMinor = Math.max(0, netMinor - taxedLinesNetMinor) + chargesMinor
  const quoteTaxMinor = taxBp > 0 ? Math.round((untaxedBaseMinor * taxBp) / 10000) : 0
  const taxMinor = lineTaxMinor + quoteTaxMinor
  return {
    subtotalMinor,
    lineDiscountMinor,
    quoteDiscountMinor: quoteDiscountValue,
    discountMinor: lineDiscountMinor + quoteDiscountValue,
    additionalChargesMinor: chargesMinor,
    taxMinor,
    grandTotalMinor: netMinor + chargesMinor + taxMinor,
  }
}

// Amount-range filter helper: "1850000" (major, as typed in the filter) → minor.
export function filterAmountToMinor(input: string, currency: Currency): string {
  const minor = parseToMinor(input, currency)
  return minor > 0 ? String(minor) : ""
}
