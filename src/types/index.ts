export type VenueType = 'bar' | 'club' | 'festival' | 'theater' | 'lounge' | 'other'

export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  bar: 'Bar',
  club: 'Club',
  festival: 'Festival',
  theater: 'Theater',
  lounge: 'Lounge',
  other: 'Other',
}

export const VENUE_TYPE_ORDER: VenueType[] = ['bar', 'club', 'festival', 'theater', 'lounge', 'other']

export type OutreachStatus =
  | 'not_contacted'
  | 'reached_out'
  | 'in_discussion'
  | 'agreement_sent'
  | 'booked'
  | 'performed'
  | 'post_follow_up'
  | 'rebooking'
  | 'closed_won'
  | 'closed_lost'
  | 'rejected'
  | 'archived'

export const OUTREACH_STATUS_LABELS: Record<OutreachStatus, string> = {
  not_contacted: 'Not Contacted',
  reached_out: 'Reached Out',
  in_discussion: 'In Discussion',
  agreement_sent: 'Agreement Sent',
  booked: 'Booked',
  performed: 'Performed',
  post_follow_up: 'Post Follow-Up',
  rebooking: 'Rebooking',
  closed_won: 'Closed - Won',
  closed_lost: 'Closed - Lost',
  rejected: 'Rejected',
  archived: 'Archived',
}

export const OUTREACH_STATUS_ORDER: OutreachStatus[] = [
  'not_contacted',
  'reached_out',
  'in_discussion',
  'agreement_sent',
  'booked',
  'performed',
  'post_follow_up',
  'rebooking',
  'closed_won',
  'closed_lost',
  'rejected',
  'archived',
]

export type TemplateType = 'agreement' | 'invoice'

export type CommissionTier = 'new_doors' | 'kept_doors' | 'bigger_doors'

export type PaymentMethod = 'cash' | 'paypal' | 'zelle' | 'apple_pay' | 'venmo' | 'check' | 'other'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  paypal: 'PayPal',
  zelle: 'Zelle',
  apple_pay: 'Apple Pay',
  venmo: 'Venmo',
  check: 'Check',
  other: 'Other',
}

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

export type TemplateSectionKind = 'header' | 'body' | 'footer'

export interface TemplateSection {
  id: string
  label: string
  content: string
  /** Layout region for PDF/HTML. Omit on legacy templates (all sections treated as body). */
  section_kind?: TemplateSectionKind
  /** Optional logo URL for header sections (https only); used instead of the default site logo when set. */
  header_logo_url?: string | null
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
  /** Promoter / venue company for merge fields */
  company: string | null
  created_at: string
}

export interface OutreachNote {
  id: string
  user_id: string
  venue_id: string
  note: string
  category: string | null
  created_at: string
}

export const ACTIVITY_CATEGORY_LABELS: Record<string, string> = {
  call: 'Phone call',
  email_sent: 'Email sent',
  email_received: 'Email received',
  contract_sent: 'Contract sent',
  meeting: 'Meeting',
  voicemail: 'Left voicemail',
  no_response: 'No response',
  other: 'Other',
}

export const ACTIVITY_CATEGORIES = Object.keys(ACTIVITY_CATEGORY_LABELS) as string[]

export interface Template {
  id: string
  user_id: string
  name: string
  type: TemplateType
  sections: TemplateSection[]
  created_at: string
  updated_at: string
}

export type GeneratedFileOutputFormat = 'text' | 'pdf'

export interface GeneratedFile {
  id: string
  user_id: string
  name: string
  template_id: string | null
  venue_id: string | null
  deal_id: string | null
  content: string
  output_format: GeneratedFileOutputFormat
  pdf_storage_path: string | null
  pdf_public_url: string | null
  /** Set when using first-party /agreements/{slug} links; null for legacy rows. */
  pdf_share_slug: string | null
  created_at: string
  venue?: Pick<Venue, 'id' | 'name'> | null
  template?: Pick<Template, 'id' | 'name'> | null
}

export interface ArtistProfile {
  user_id: string
  artist_name: string
  artist_email: string
  manager_name: string | null
  manager_email: string | null
  from_email: string
  company_name: string | null
  website: string | null
  phone: string | null
  social_handle: string | null
  tagline: string | null
  reply_to_email: string | null
  /** Minutes after queue before cron auto-sends; 5|10|15|20|30 (default 10 if column missing pre-migration) */
  email_queue_buffer_minutes?: number
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
  payments?: MonthlyFeePayment[]
}

export interface MonthlyFeePayment {
  id: string
  fee_id: string
  user_id: string
  amount: number
  paid_date: string
  payment_method: PaymentMethod
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
  email_type: string | null
  /** Optional PDF for agreement_ready / custom venue merges; overrides deal agreement file for this step. */
  generated_file_id: string | null
  created_at: string
  venue?: Pick<Venue, 'id' | 'name'> | null
  deal?: Pick<Deal, 'id' | 'description'> | null
  agreement_file?: Pick<GeneratedFile, 'id' | 'name'> | null
}

export interface TaskTemplateItem {
  id: string
  template_id: string
  title: string
  notes: string | null
  days_offset: number
  priority: TaskPriority
  recurrence: TaskRecurrence
  sort_order: number
  email_type: string | null
  generated_file_id: string | null
  created_at: string
}

export interface TaskTemplate {
  id: string
  user_id: string
  name: string
  description: string | null
  trigger_status: string | null
  created_at: string
  items?: TaskTemplateItem[]
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
  payment_due_date: string | null
  agreement_url: string | null
  /** Canonical agreement PDF in Files; resolved to share URL with {@link resolveAgreementUrl}. */
  agreement_generated_file_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  venue?: Pick<Venue, 'id' | 'name'> | null
}

export type VenueEmailType =
  | 'booking_confirmation'
  | 'payment_receipt'
  | 'payment_reminder'
  | 'agreement_ready'
  | 'booking_confirmed'
  | 'follow_up'
  | 'rebooking_inquiry'

export type ArtistEmailType = 'management_report' | 'retainer_reminder' | 'performance_report_request'

export type AnyEmailType = VenueEmailType | ArtistEmailType

export type VenueEmailStatus = 'pending' | 'sent' | 'failed'

export const VENUE_EMAIL_TYPE_LABELS: Record<VenueEmailType, string> = {
  booking_confirmation: 'Booking Confirmation',
  payment_receipt: 'Payment Receipt',
  payment_reminder: 'Payment Reminder',
  agreement_ready: 'Agreement Ready',
  booking_confirmed: 'Booking Confirmed',
  follow_up: 'Follow-Up',
  rebooking_inquiry: 'Rebooking Inquiry',
}

export const ARTIST_EMAIL_TYPE_LABELS: Record<ArtistEmailType, string> = {
  management_report: 'Management Report',
  retainer_reminder: 'Retainer Reminder',
  performance_report_request: 'Performance Report Request',
}

export interface EmailTemplate {
  id: string
  user_id: string
  email_type: AnyEmailType
  custom_subject: string | null
  custom_intro: string | null
  layout?: import('@/lib/emailLayout').EmailTemplateLayoutV1 | null
  layout_version?: number
  created_at: string
  updated_at: string
}

export interface PerformanceReport {
  id: string
  user_id: string
  venue_id: string
  deal_id: string | null
  token: string
  token_used: boolean
  event_happened: 'yes' | 'no' | 'postponed' | null
  event_rating: number | null
  attendance: number | null
  artist_paid_status: 'yes' | 'no' | 'partial' | null
  payment_amount: number | null
  venue_interest: 'yes' | 'no' | 'unsure' | null
  relationship_quality: 'good' | 'neutral' | 'poor' | null
  notes: string | null
  media_links: string | null
  commission_flagged: boolean
  submitted: boolean
  submitted_at: string | null
  created_at: string
  venue?: Pick<Venue, 'id' | 'name'> | null
  deal?: Pick<Deal, 'id' | 'description' | 'event_date'> | null
}

export interface VenueEmail {
  id: string
  user_id: string
  venue_id: string | null
  deal_id: string | null
  contact_id: string | null
  email_type: string
  recipient_email: string
  subject: string
  status: VenueEmailStatus
  sent_at: string | null
  notes: string | null
  created_at: string
  venue?: Pick<Venue, 'id' | 'name' | 'city' | 'location'> | null
  deal?: Pick<Deal, 'id' | 'description' | 'event_date' | 'gross_amount' | 'agreement_url' | 'agreement_generated_file_id' | 'notes' | 'payment_due_date' | 'artist_paid'> | null
  contact?: Pick<Contact, 'id' | 'name' | 'email'> | null
}
