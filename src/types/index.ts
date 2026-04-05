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

export type CommissionTier = 'new_doors' | 'kept_doors' | 'bigger_doors'

export type MetricCategory = 'brand_partnership' | 'event_attendance' | 'press_mention'

export const METRIC_CATEGORY_LABELS: Record<MetricCategory, string> = {
  brand_partnership: 'Brand Partnership',
  event_attendance: 'Event Attendance',
  press_mention: 'Press Mention',
}

export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly'

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const TASK_RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

export const COMMISSION_TIER_LABELS: Record<CommissionTier, string> = {
  new_doors: 'New Doors',
  kept_doors: 'Kept Doors',
  bigger_doors: 'Bigger Doors',
}

export const COMMISSION_TIER_RATES: Record<CommissionTier, number> = {
  new_doors: 0.20,
  kept_doors: 0.20,
  bigger_doors: 0.10,
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
  user_id: string
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
  user_id: string
  venue_id: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
  created_at: string
}

export interface OutreachNote {
  id: string
  user_id: string
  venue_id: string
  note: string
  created_at: string
}

export interface Template {
  id: string
  user_id: string
  name: string
  type: TemplateType
  sections: TemplateSection[]
  created_at: string
  updated_at: string
}

export interface GeneratedFile {
  id: string
  user_id: string
  name: string
  template_id: string | null
  venue_id: string | null
  content: string
  created_at: string
  venue?: Pick<Venue, 'id' | 'name'> | null
  template?: Pick<Template, 'id' | 'name'> | null
}

export interface ArtistProfile {
  user_id: string
  artist_name: string
  artist_email: string
  manager_name: string | null
  from_email: string
  created_at: string
  updated_at: string
}

export interface Metric {
  id: string
  user_id: string
  date: string
  category: MetricCategory
  title: string
  numeric_value: number | null
  description: string | null
  deal_id: string | null
  created_at: string
  deal?: Pick<Deal, 'id' | 'description'> | null
}

export interface MonthlyFee {
  id: string
  user_id: string
  month: string
  amount: number
  paid: boolean
  paid_date: string | null
  notes: string | null
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  notes: string | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  priority: TaskPriority
  recurrence: TaskRecurrence
  venue_id: string | null
  deal_id: string | null
  created_at: string
  venue?: Pick<Venue, 'id' | 'name'> | null
  deal?: Pick<Deal, 'id' | 'description'> | null
}

export interface Deal {
  id: string
  user_id: string
  description: string
  venue_id: string | null
  event_date: string | null
  gross_amount: number
  commission_tier: CommissionTier
  commission_rate: number
  commission_amount: number
  artist_paid: boolean
  artist_paid_date: string | null
  manager_paid: boolean
  manager_paid_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  venue?: Pick<Venue, 'id' | 'name'> | null
}
