// Quotation builder core: line items editor (service catalogue dropdown from
// the CMS — custom line items allowed) and the financial summary block.
// All displayed totals come from src/lib/money.ts (integer arithmetic);
// the server recomputes the same values on save.
import { useMemo } from "react"
import { Plus, Trash2, Percent } from "lucide-react"
import {
  computeLineTotals, computeQuoteTotals,
  formatMinor, minorToInputValue, parseToMinor, percentTextToBp, bpToPercentText, lineGross,
  quantityToHundredths,
} from "@/lib/money"
import type { Currency, LineDiscount, LineTax, QuoteDiscount } from "@/types/quotations"
import type { CrmServiceRef } from "@/types/quotations"

// -------------------------------------------------------- line items UI

export type EditableLine = {
  id: string
  description: string
  serviceId: string
  quantity: string
  unit: string
  unitPrice: string // major units, as typed
  discountMode: "none" | "percent" | "fixed"
  discountValue: string // percent number or major-unit amount
  taxMode: "none" | "percent"
  taxPercent: string
}

let lineSeq = 0
export function emptyLine(): EditableLine {
  lineSeq += 1
  return {
    id: `line-${Date.now().toString(36)}-${lineSeq}-${Math.random().toString(36).slice(2, 7)}`,
    description: "",
    serviceId: "",
    quantity: "1",
    unit: "",
    unitPrice: "0.00",
    discountMode: "none",
    discountValue: "",
    taxMode: "none",
    taxPercent: "",
  }
}

// Editable line → wire format for the API (minor units + bp).
export function editableLineToWire(line: EditableLine, currency: Currency) {
  const discount: LineDiscount =
    line.discountMode === "percent" ? { mode: "percent", bp: percentTextToBp(line.discountValue), minor: 0 }
    : line.discountMode === "fixed" ? { mode: "fixed", bp: 0, minor: parseToMinor(line.discountValue, currency) }
    : { mode: "none", bp: 0, minor: 0 }
  const tax: LineTax = line.taxMode === "percent" ? { mode: "percent", bp: percentTextToBp(line.taxPercent) } : { mode: "none", bp: 0 }
  return {
    id: line.id,
    description: line.description,
    service: { id: line.serviceId, title: "" }, // title resolved server-side from the catalogue
    quantity: line.quantity || "1",
    unit: line.unit,
    unitPriceMinor: parseToMinor(line.unitPrice, currency),
    discount,
    tax,
  }
}

// Stored quotation line → editable line (draft editing / duplicate / revise).
export function wireLineToEditable(item: {
  id: string
  description: string
  service: { id: string; title: string }
  quantity: string
  unit: string
  unitPriceMinor: number
  discount: LineDiscount
  tax: LineTax
}, currency: Currency): EditableLine {
  return {
    id: item.id,
    description: item.description,
    serviceId: item.service?.id || "",
    quantity: item.quantity || "1",
    unit: item.unit || "",
    unitPrice: minorToInputValue(item.unitPriceMinor || 0, currency),
    discountMode: item.discount?.mode === "percent" ? "percent" : item.discount?.mode === "fixed" ? "fixed" : "none",
    discountValue:
      item.discount?.mode === "percent" ? bpToPercentText(item.discount.bp) : item.discount?.mode === "fixed" ? minorToInputValue(item.discount.minor, currency) : "",
    taxMode: item.tax?.mode === "percent" ? "percent" : "none",
    taxPercent: item.tax?.mode === "percent" ? bpToPercentText(item.tax.bp) : "",
  }
}

const UNITS = ["Project", "Day", "Days", "Hour", "Week", "Month", "Site", "Hectare", "Km", "Item", "Point", "Lot"]

export function LineItemsEditor({
  lines,
  onChange,
  currency,
  services,
}: {
  lines: EditableLine[]
  onChange: (lines: EditableLine[]) => void
  currency: Currency
  services: CrmServiceRef[]
}) {
  const update = (id: string, patch: Partial<EditableLine>) => {
    onChange(lines.map((line) => (line.id === id ? { ...line, ...patch } : line)))
  }
  const remove = (id: string) => {
    onChange(lines.filter((line) => line.id !== id))
  }
  const add = () => {
    onChange([...lines, emptyLine()])
  }
  const addFromService = (service: CrmServiceRef) => {
    onChange([...lines, { ...emptyLine(), serviceId: service.id, description: service.title }])
  }

  return (
    <div className="space-y-3">
      {/* Mobile: card per line. Desktop: grid rows. */}
      <div className="space-y-3">
        {lines.map((line, index) => {
          const wire = editableLineToWire(line, currency)
          const totals = computeLineTotals({
            quantity: wire.quantity,
            unitPriceMinor: wire.unitPriceMinor,
            discount: wire.discount,
            tax: wire.tax,
          })
          const gross = lineGross(quantityToHundredths(wire.quantity), wire.unitPriceMinor)
          return (
            <div key={line.id} className="rounded-lg border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Item {index + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(line.id)}
                  disabled={lines.length === 1}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-30"
                  title={lines.length === 1 ? "A quotation needs at least one item" : "Remove line"}
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
                  Service (from CMS catalogue)
                  <select
                    value={line.serviceId}
                    onChange={(e) => {
                      const service = services.find((s) => s.id === e.target.value)
                      update(line.id, { serviceId: e.target.value, description: service ? service.title : line.description })
                    }}
                    className="mt-1 w-full rounded-md border bg-white px-2.5 py-2 text-sm text-foreground"
                  >
                    <option value="">— Custom item (no catalogue service) —</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
                  Description
                  <input
                    value={line.description}
                    onChange={(e) => update(line.id, { description: e.target.value })}
                    placeholder="e.g. Field data collection (3 crews)"
                    className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Quantity
                  <input
                    value={line.quantity}
                    onChange={(e) => update(line.id, { quantity: e.target.value.replace(/[^\d.]/g, "") })}
                    inputMode="decimal"
                    className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Unit
                  <input
                    value={line.unit}
                    onChange={(e) => update(line.id, { unit: e.target.value })}
                    list="quotation-units"
                    placeholder="e.g. Days"
                    className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Unit price ({currency.code})
                  <input
                    value={line.unitPrice}
                    onChange={(e) => update(line.id, { unitPrice: e.target.value.replace(/[^\d.,]/g, "") })}
                    inputMode="decimal"
                    className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm"
                  />
                </label>
                <div className="grid grid-cols-[7rem_1fr] gap-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Discount
                    <select
                      value={line.discountMode}
                      onChange={(e) => update(line.id, { discountMode: e.target.value as EditableLine["discountMode"], discountValue: "" })}
                      className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm"
                    >
                      <option value="none">None</option>
                      <option value="percent">%</option>
                      <option value="fixed">{currency.code}</option>
                    </select>
                  </label>
                  {line.discountMode !== "none" && (
                    <label className="text-xs font-medium text-muted-foreground">
                      {line.discountMode === "percent" ? "Percent" : "Amount"}
                      <input
                        value={line.discountValue}
                        onChange={(e) => update(line.id, { discountValue: e.target.value.replace(line.discountMode === "percent" ? /[^\d.]/g : /[^\d.,]/g, "") })}
                        inputMode="decimal"
                        placeholder={line.discountMode === "percent" ? "e.g. 10" : "e.g. 50,000"}
                        className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm"
                      />
                    </label>
                  )}
                </div>
                <div className="grid grid-cols-[7rem_1fr] gap-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Tax
                    <select
                      value={line.taxMode}
                      onChange={(e) => update(line.id, { taxMode: e.target.value as EditableLine["taxMode"], taxPercent: "" })}
                      className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm"
                    >
                      <option value="none">None</option>
                      <option value="percent">%</option>
                    </select>
                  </label>
                  {line.taxMode === "percent" && (
                    <label className="text-xs font-medium text-muted-foreground">
                      Percent
                      <input
                        value={line.taxPercent}
                        onChange={(e) => update(line.id, { taxPercent: e.target.value.replace(/[^\d.]/g, "") })}
                        inputMode="decimal"
                        placeholder="e.g. 7.5"
                        className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm"
                      />
                    </label>
                  )}
                </div>
              </div>
              <p className="mt-2 text-right text-sm font-semibold text-brand-dark">
                Line total: {formatMinor(totals.totalMinor, currency)}
                {totals.discountMinor > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground line-through">{formatMinor(gross, currency)}</span>}
              </p>
            </div>
          )
        })}
      </div>

      <datalist id="quotation-units">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={add} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
          <Plus className="h-3.5 w-3.5" /> Add line item
        </button>
        {services.slice(0, 3).map((s) => (
          <button key={s.id} type="button" onClick={() => addFromService(s)} className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted">
            <Plus className="h-3 w-3" /> {s.title}
          </button>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------ financial summary

export type QuoteMoneyInput = {
  quoteDiscountMode: "none" | "percent" | "fixed"
  quoteDiscountValue: string
  additionalCharges: string
  taxBp: number
}

export function emptyQuoteMoney(): QuoteMoneyInput {
  return { quoteDiscountMode: "none", quoteDiscountValue: "", additionalCharges: "0.00", taxBp: 0 }
}

export function quoteMoneyToWire(money: QuoteMoneyInput, currency: Currency): { quoteDiscount: QuoteDiscount; additionalChargesMinor: number; taxBp: number } {
  return {
    quoteDiscount:
      money.quoteDiscountMode === "percent" ? { mode: "percent", bp: percentTextToBp(money.quoteDiscountValue), minor: 0 }
      : money.quoteDiscountMode === "fixed" ? { mode: "fixed", bp: 0, minor: parseToMinor(money.quoteDiscountValue, currency) }
      : { mode: "none", bp: 0, minor: 0 },
    additionalChargesMinor: parseToMinor(money.additionalCharges, currency),
    taxBp: money.taxBp,
  }
}

export function wireToQuoteMoney(input: { quoteDiscount: QuoteDiscount; additionalChargesMinor: number; taxBp: number }, currency: Currency): QuoteMoneyInput {
  return {
    quoteDiscountMode: input.quoteDiscount?.mode === "percent" ? "percent" : input.quoteDiscount?.mode === "fixed" ? "fixed" : "none",
    quoteDiscountValue:
      input.quoteDiscount?.mode === "percent" ? bpToPercentText(input.quoteDiscount.bp) : input.quoteDiscount?.mode === "fixed" ? minorToInputValue(input.quoteDiscount.minor, currency) : "",
    additionalCharges: minorToInputValue(input.additionalChargesMinor || 0, currency),
    taxBp: input.taxBp || 0,
  }
}

export function FinancialSummary({
  lines,
  money,
  onMoneyChange,
  currency,
}: {
  lines: EditableLine[]
  money: QuoteMoneyInput
  onMoneyChange: (money: QuoteMoneyInput) => void
  currency: Currency
}) {
  const totals = useMemo(
    () =>
      computeQuoteTotals({
        items: lines.map((line) => {
          const wire = editableLineToWire(line, currency)
          return { quantity: wire.quantity, unitPriceMinor: wire.unitPriceMinor, discount: wire.discount, tax: wire.tax }
        }),
        quoteDiscount: quoteMoneyToWire(money, currency).quoteDiscount,
        additionalChargesMinor: parseToMinor(money.additionalCharges, currency),
        taxBp: money.taxBp,
      }),
    [lines, money, currency],
  )

  const rows: [string, string, string?][] = [
    ["Subtotal", formatMinor(totals.subtotalMinor, currency)],
    ...(totals.lineDiscountMinor > 0 ? ([["Line discounts", `− ${formatMinor(totals.lineDiscountMinor, currency)}`]] as [string, string][]) : []),
    ...(totals.quoteDiscountMinor > 0 ? ([["Quotation discount", `− ${formatMinor(totals.quoteDiscountMinor, currency)}`]] as [string, string][]) : []),
    ...(totals.additionalChargesMinor > 0 ? ([["Additional charges", `+ ${formatMinor(totals.additionalChargesMinor, currency)}`]] as [string, string][]) : []),
    ...(totals.taxMinor > 0 ? ([["Tax", `+ ${formatMinor(totals.taxMinor, currency)}`, `${bpToPercentText(money.taxBp)}%`]] as [string, string, string][]) : []),
  ]

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs font-medium text-muted-foreground">
          Quote discount
          <div className="mt-1 grid grid-cols-[6.5rem_1fr] gap-2">
            <select
              value={money.quoteDiscountMode}
              onChange={(e) => onMoneyChange({ ...money, quoteDiscountMode: e.target.value as QuoteMoneyInput["quoteDiscountMode"], quoteDiscountValue: "" })}
              className="w-full rounded-md border bg-white px-2 py-2 text-sm"
            >
              <option value="none">None</option>
              <option value="percent">%</option>
              <option value="fixed">{currency.code}</option>
            </select>
            {money.quoteDiscountMode !== "none" && (
              <input
                value={money.quoteDiscountValue}
                onChange={(e) => onMoneyChange({ ...money, quoteDiscountValue: e.target.value.replace(money.quoteDiscountMode === "percent" ? /[^\d.]/g : /[^\d.,]/g, "") })}
                inputMode="decimal"
                placeholder={money.quoteDiscountMode === "percent" ? "e.g. 5" : "e.g. 100,000"}
                className="w-full rounded-md border px-2.5 py-2 text-sm"
              />
            )}
          </div>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Additional charges ({currency.code})
          <input
            value={money.additionalCharges}
            onChange={(e) => onMoneyChange({ ...money, additionalCharges: e.target.value.replace(/[^\d.,]/g, "") })}
            inputMode="decimal"
            className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Tax (%)
          <select
            value={KNOWN_TAX_BPS.includes(money.taxBp) ? String(money.taxBp) : "custom"}
            onChange={(e) => onMoneyChange({ ...money, taxBp: e.target.value === "custom" ? 1 : Number(e.target.value) })}
            className="mt-1 w-full rounded-md border bg-white px-2.5 py-2 text-sm"
          >
            {KNOWN_TAX_BPS.map((bp) => (
              <option key={bp} value={String(bp)}>
                {bp === 0 ? "No tax" : `${bpToPercentText(bp)}%`}
              </option>
            ))}
            <option value="custom">Custom…</option>
          </select>
          {!KNOWN_TAX_BPS.includes(money.taxBp) && (
            <input
              value={bpToPercentText(money.taxBp)}
              onChange={(e) => onMoneyChange({ ...money, taxBp: percentTextToBp(e.target.value) })}
              inputMode="decimal"
              placeholder="e.g. 7.5"
              className="mt-1.5 w-full rounded-md border px-2.5 py-2 text-sm"
            />
          )}
        </label>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3">
        <dl className="space-y-1.5 text-sm">
          {rows.map(([label, value, hint]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">
                {label}
                {hint && <span className="ml-1 text-xs">({hint})</span>}
              </dt>
              <dd className="font-medium text-brand-dark">{value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t pt-2">
            <dt className="font-semibold text-brand-dark">Grand total</dt>
            <dd className="text-lg font-bold text-brand-dark">{formatMinor(totals.grandTotalMinor, currency)}</dd>
          </div>
        </dl>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Percent className="h-3 w-3" /> Tax is admin-configured per quotation — nothing is hard-coded.
        </p>
      </div>
    </div>
  )
}

// Tax presets offered in the dropdown (basis points). Custom rates are typed
// into the revealed input — nothing about Nigerian tax is hard-coded; this
// list is just convenience shortcuts.
const KNOWN_TAX_BPS = [0, 500, 750, 1250, 1000]
