// CRM domain types — mirrors api/_lib/crmStore.js records.

export const LEAD_STATUSES = [
  'New',
  'Contacted',
  'Qualified',
  'Quotation Sent',
  'Negotiation',
  'Won',
  'Lost',
  'On Hold',
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_SOURCES = [
  'Website',
  'Phone',
  'WhatsApp',
  'Email',
  'Referral',
  'Social Media',
  'Walk-in',
  'Existing Client',
  'Other',
] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

export const LEAD_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const
export type LeadPriority = (typeof LEAD_PRIORITIES)[number]

export const CLIENT_TYPES = [
  'Individual',
  'Company',
  'Government',
  'NGO',
  'Institution',
  'Other',
] as const
export type ClientType = (typeof CLIENT_TYPES)[number]

export const FOLLOWUP_STATUSES = ['Pending', 'Completed', 'Cancelled'] as const
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number]

export const ACTIVITY_TYPES = [
  'lead_created',
  'phone_call',
  'email',
  'whatsapp',
  'meeting',
  'site_visit',
  'quotation_sent',
  'follow_up',
  'status_changed',
  'note_added',
  'client_converted',
  'project_created',
] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export type LeadServiceSnapshot = {
  id: string
  title: string
}

export type CrmAttachment = {
  name: string
  url: string
}

export type LeadProjectRef = {
  id: string
  title: string
}

export type LeadQuotationRef = {
  code: string
  createdAt: string
}

export type Lead = {
  id: string
  code: string
  name: string
  company: string
  email: string
  phone: string
  whatsapp: string
  service: LeadServiceSnapshot
  projectType: string
  location: string
  source: LeadSource | string
  description: string
  status: LeadStatus | string
  priority: LeadPriority | string
  assigned: string
  nextFollowUpAt: string
  lastContactedAt: string
  messageRef: string
  projectRef: LeadProjectRef
  quotationRef: LeadQuotationRef
  attachments: CrmAttachment[]
  clientId: string
  convertedAt: string
  archived: boolean
  statusChangedAt?: string
  createdAt: string
  updatedAt: string
}

export type Client = {
  id: string
  code: string
  name: string
  company: string
  email: string
  phone: string
  whatsapp: string
  address: string
  industry: string
  type: ClientType | string
  notes: string
  createdAt: string
  updatedAt: string
}

export type CrmActivity = {
  id: string
  ownerType: 'lead' | 'client'
  ownerId: string
  ownerCode: string
  type: ActivityType | string
  description: string
  at: string
  createdBy: string
  createdAt: string
}

export type Followup = {
  id: string
  relatedType: 'lead' | 'client'
  relatedId: string
  relatedCode: string
  date: string
  time: string
  title: string
  description: string
  priority: LeadPriority | string
  status: FollowupStatus | string
  createdAt: string
  updatedAt: string
}

export type LeadListResult = {
  leads: Lead[]
  total: number
  page: number
  pageSize: number
}

export type ClientListResult = {
  clients: Client[]
  total: number
  page: number
  pageSize: number
}

export type LeadDetailResult = {
  lead: Lead
  activities: CrmActivity[]
  followups: Followup[]
}

export type ClientDetailResult = {
  client: Client
  leads: Lead[]
  activities: CrmActivity[]
  followups: Followup[]
}

export type DashboardResult = {
  cards: {
    totalLeads: number
    newLeads: number
    activeLeads: number
    qualifiedLeads: number
    quotationsPending: number
    activeClients: number
    followupsDue: number
    projectsWon: number
  }
  recentLeads: Lead[]
  recentActivities: CrmActivity[]
  upcomingFollowups: {
    overdue: Followup[]
    today: Followup[]
    tomorrow: Followup[]
    upcoming: Followup[]
  }
  recentlyConverted: Lead[]
}

export type CrmServiceRef = {
  id: string
  title: string
}
