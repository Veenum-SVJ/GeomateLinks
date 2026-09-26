// Quotation domain types — mirrors api/_lib/quotationStore.js records.
// Money is carried as integer minor units (kobo for NGN); percentages as
// integer basis points. See src/lib/money.ts for the formatting/calc mirror.

export const QUOTATION_STATUSES = [
  "Draft",
  "Sent",
  "Under Review",
  "Accepted",
  "Rejected",
  "Expired",
  "Cancelled",
] as const
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number]

export const REJECTION_REASONS = [
  "Budget too high",
  "Project postponed",
  "Competitor selected",
  "Project cancelled",
  "Other",
] as const
export type RejectionReason = (typeof REJECTION_REASONS)[number]

export const QUOTATION_HISTORY_ACTIONS = [
  "created",
  "edited",
  "sent",
  "resent",
  "status_changed",
  "revision_created",
  "accepted",
  "rejected",
  "cancelled",
  "archived",
  "unarchived",
  "duplicated",
  "email_failed",
] as const
export type QuotationHistoryAction = (typeof QUOTATION_HISTORY_ACTIONS)[number]

export type Currency = {
  code: string
  symbol: string
  minorUnits: number
}

export type LineDiscount =
  | { mode: "none"; bp: 0; minor: 0 }
  | { mode: "percent"; bp: number; minor: 0 }
  | { mode: "fixed"; bp: 0; minor: number }

export type LineTax = { mode: "none" | "percent"; bp: number }

export type QuotationLineItem = {
  id: string
  description: string
  service: { id: string; title: string }
  quantity: string
  unit: string
  unitPriceMinor: number
  discount: LineDiscount
  tax: LineTax
  grossMinor: number
  discountMinor: number
  taxMinor: number
  totalMinor: number
}

export type QuoteDiscount = LineDiscount

export type QuotationClientSnapshot = {
  id: string
  code: string
  name: string
  company: string
  email: string
  phone: string
  address: string
}

export type QuotationLeadSnapshot = {
  id: string
  code: string
  name: string
}

export type Quotation = {
  id: string
  number: string
  version: number
  rootId: string
  supersedesId: string
  client: QuotationClientSnapshot
  lead: QuotationLeadSnapshot
  quotationDate: string
  validUntil: string
  projectTitle: string
  location: string
  projectDescription: string
  scopeOfWork: string
  notes: string
  paymentTerms: string
  terms: string
  preparedBy: string
  currency: Currency
  items: QuotationLineItem[]
  quoteDiscount: QuoteDiscount
  taxBp: number
  subtotalMinor: number
  lineDiscountMinor: number
  quoteDiscountMinor: number
  discountMinor: number
  additionalChargesMinor: number
  taxMinor: number
  grandTotalMinor: number
  status: QuotationStatus | string
  rejectionReason: string
  rejectionNotes: string
  archived: boolean
  sentAt: string
  acceptedAt: string
  rejectedAt: string
  cancelledAt: string
  sentVia: string
  email: { to: string; cc: string; subject: string; message: string }
  createdAt: string
  updatedAt: string
}

export type QuotationHistoryEntry = {
  id: string
  quotationId: string
  quotationNumber: string
  quotationVersion: number
  action: QuotationHistoryAction | string
  detail: string
  at: string
  createdBy: string
}

export type QuotationVersionRef = {
  id: string
  version: number
  status: string
  createdAt: string
  grandTotalMinor: number
  isCurrent: boolean
}

export type QuotationDetailResult = {
  quotation: Quotation
  history: QuotationHistoryEntry[]
  versions: QuotationVersionRef[]
}

export type QuotationListResult = {
  quotations: Quotation[]
  total: number
  page: number
  pageSize: number
  newlyExpired?: number
}

export type QuotationQuery = {
  query?: string
  status?: string
  clientId?: string
  leadId?: string
  serviceId?: string
  from?: string
  to?: string
  amountMin?: string | number
  amountMax?: string | number
  expiredBefore?: string
  expiredAfter?: string
  archived?: string
  sort?: string
  allVersions?: string
  page?: number
  pageSize?: number
}

export type QuotationDashboardResult = {
  cards: {
    total: number
    draft: number
    sent: number
    underReview: number
    accepted: number
    rejected: number
    expired: number
    cancelled: number
    awaitingResponse: number
    acceptedValueMinor: number
  }
  recentQuotations: Quotation[]
  awaitingResponse: Quotation[]
  recentlyAccepted: Quotation[]
  recentlyRejected: Quotation[]
}

export type CrmServiceRef = {
  id: string
  title: string
}

export type ProjectHandoff = {
  quotationId: string
  quotationNumber: string
  version: number
  client: QuotationClientSnapshot
  lead: QuotationLeadSnapshot
  project: {
    title: string
    location: string
    description: string
    scopeOfWork: string
    services: { id: string; title: string }[]
  }
  finance: {
    currency: Currency
    grandTotalMinor: number
    paymentTerms: string
  }
  preparedBy: string
  acceptedAt: string
}
