export type VenueType = 'bar' | 'club' | 'festival' | 'theater' | 'lounge' | 'other'

export type OutreachStatus =
  | 'not_contacted'
  | 'reached_out'
  | 'in_discussion'
  | 'agreement_sent'
  | 'booked'
  | 'rejected'
  | 'archived'

export const OUTREACH_STATUS_LABELS: Record<OutreachStatus, string> = {
  not_contacted: 'Not Contacted',
  reached_out: 'Reached Out',
  in_discussion: 'In Discussion',
  agreement_sent: 'Agreement Sent',
  booked: 'Booked',
  rejected: 'Rejected',
  archived: 'Archived',
}

export const OUTREACH_STATUS_ORDER: OutreachStatus[] = [
  'not_contacted',
  'reached_out',
  'in_discussion',
  'agreement_sent',
  'booked',
  'rejected',
  'archived',
]

export type TemplateType = 'agreement' | 'invoice'

export type ExpenseCategory = 'travel' | 'equipment' | 'promotion' | 'accommodation' | 'food' | 'misc'

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  travel: 'Travel',
  equipment: 'Equipment',
  promotion: 'Promotion',
  accommodation: 'Accommodation',
  food: 'Food',
  misc: 'Misc',
}

export interface DealTerms {
  event_date?: string
  pay?: number
  set_length?: string
  load_in_time?: string
  notes?: string
}

export interface TemplateSection {
  id: string
  label: string
  content: string
}

export interface Venue {
  id: string
  name: string
  location: string | null
  city: string | null
  venue_type: VenueType
  priority: number
  status: OutreachStatus
  follow_up_date: string | null
  deal_terms: DealTerms | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  venue_id: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
  created_at: string
}

export interface OutreachNote {
  id: string
  venue_id: string
  note: string
  created_at: string
}

export interface Template {
  id: string
  name: string
  type: TemplateType
  sections: TemplateSection[]
  created_at: string
  updated_at: string
}

export interface GeneratedFile {
  id: string
  name: string
  template_id: string | null
  venue_id: string | null
  content: string
  created_at: string
  venue?: Pick<Venue, 'id' | 'name'> | null
  template?: Pick<Template, 'id' | 'name'> | null
}

export interface Expense {
  id: string
  amount: number
  category: ExpenseCategory
  description: string | null
  date: string
  venue_id: string | null
  created_at: string
  venue?: Pick<Venue, 'id' | 'name'> | null
}
