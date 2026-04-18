/** Physical venues, event spaces, and partner / org categories (stored on `venues.venue_type`). */
export type VenueType =
  | 'bar'
  | 'club'
  | 'festival'
  | 'theater'
  | 'lounge'
  | 'arena'
  | 'stadium'
  | 'outdoor_space'
  | 'restaurant'
  | 'hotel'
  | 'resort'
  | 'casino'
  | 'convention_center'
  | 'gallery'
  | 'museum'
  | 'brewery'
  | 'winery'
  | 'cafe'
  | 'warehouse'
  | 'rooftop'
  | 'country_club'
  | 'yacht_boat'
  | 'private_estate'
  | 'retail_popup'
  | 'park_public_space'
  | 'university'
  | 'office_coworking'
  | 'sponsor_brand'
  | 'promoter'
  | 'talent_buyer'
  | 'booking_agency'
  | 'management_company'
  | 'record_label'
  | 'pr_agency'
  | 'media_outlet'
  | 'nonprofit'
  | 'corporate_client'
  | 'streaming_platform'
  | 'production_company'
  | 'other'

export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  bar: 'Bar',
  club: 'Club',
  festival: 'Festival',
  theater: 'Theater / performance hall',
  lounge: 'Lounge',
  arena: 'Arena',
  stadium: 'Stadium',
  outdoor_space: 'Outdoor space / grounds',
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  resort: 'Resort',
  casino: 'Casino',
  convention_center: 'Convention / conference center',
  gallery: 'Gallery',
  museum: 'Museum',
  brewery: 'Brewery / taproom',
  winery: 'Winery',
  cafe: 'Café / coffee shop',
  warehouse: 'Warehouse / industrial venue',
  rooftop: 'Rooftop / terrace',
  country_club: 'Country / golf club',
  yacht_boat: 'Boat / yacht',
  private_estate: 'Private estate / residence',
  retail_popup: 'Retail / pop-up space',
  park_public_space: 'Park / public outdoor',
  university: 'School / university venue',
  office_coworking: 'Office / coworking event space',
  sponsor_brand: 'Brand / sponsor',
  promoter: 'Promoter / presenter',
  talent_buyer: 'Talent buyer / booker',
  booking_agency: 'Booking agency',
  management_company: 'Management company',
  record_label: 'Label / publisher',
  pr_agency: 'PR / marketing agency',
  media_outlet: 'Media / podcast / broadcast',
  nonprofit: 'Nonprofit / community org',
  corporate_client: 'Corporate client',
  streaming_platform: 'Streaming / platform partner',
  production_company: 'Production / promoter company',
  other: 'Other',
}

/** Default option order in searchable entity-type controls. */
export const VENUE_TYPE_ORDER: VenueType[] = [
  'bar',
  'club',
  'lounge',
  'theater',
  'festival',
  'arena',
  'stadium',
  'outdoor_space',
  'restaurant',
  'hotel',
  'resort',
  'cafe',
  'brewery',
  'winery',
  'casino',
  'convention_center',
  'country_club',
  'gallery',
  'museum',
  'warehouse',
  'rooftop',
  'retail_popup',
  'park_public_space',
  'private_estate',
  'yacht_boat',
  'university',
  'office_coworking',
  'sponsor_brand',
  'promoter',
  'talent_buyer',
  'booking_agency',
  'management_company',
  'record_label',
  'pr_agency',
  'media_outlet',
  'nonprofit',
  'corporate_client',
  'streaming_platform',
  'production_company',
  'other',
]

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

export type OutreachTrack = 'pipeline' | 'community'

export const OUTREACH_TRACK_LABELS: Record<OutreachTrack, string> = {
  pipeline: 'Pipeline',
  community: 'Community',
}

export const OUTREACH_TRACK_ORDER: OutreachTrack[] = ['pipeline', 'community']

export type TemplateType = 'agreement' | 'invoice'

export type CommissionTier = 'new_doors' | 'kept_doors' | 'bigger_doors' | 'artist_network'

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
  /** Community / artist existing network — gross tracked, no manager booking commission */
  artist_network: 'Artist network',
}

export const COMMISSION_TIER_RATES: Record<CommissionTier, number> = {
  new_doors: 0.20,
  kept_doors: 0.20,
  bigger_doors: 0.10,
  artist_network: 0,
}

export interface DealTerms {
  event_date?: string
  pay?: number
  set_length?: string
  load_in_time?: string
  notes?: string
}

/** Catalog service day-type for auto-picking rate from event date (weekend = Fri–Sun). */
export type PricingDayType = 'weekday' | 'weekend' | 'any'

export interface PricingPackage {
  id: string
  name: string
  /** Whole dollars */
  price: number
  hoursIncluded: number
  bullets: string[]
}

export interface PricingService {
  id: string
  name: string
  category?: string
  /** Whole dollars; hourly or flat per handoff */
  price: number
  priceType: 'per_hour' | 'flat_rate'
  dayType: PricingDayType
}

export type PricingAddonPriceType =
  | 'flat_fee'
  | 'per_event'
  | 'per_artist'
  | 'per_sq_ft'
  | 'per_effect'
  | 'per_setup'

export interface PricingAddon {
  id: string
  name: string
  category?: string
  price: number
  priceType: PricingAddonPriceType
  /** Shown in UI only (e.g. “sq ft”) */
  unitLabel?: string
}

export interface PricingDiscount {
  id: string
  name: string
  clientType?: string
  /** Whole percent e.g. 10 = 10% */
  percent: number
}

export interface PricingSurcharge {
  id: string
  name: string
  /** Multiplier e.g. 1.35 for +35% */
  multiplier: number
}

export interface PricingPolicies {
  defaultDepositPercent: number
  salesTaxPercent: number
  minimumBillableHours: number
}

/** Stored in `user_pricing_catalog.doc` */
export interface PricingCatalogDoc {
  v: 1
  packages: PricingPackage[]
  services: PricingService[]
  addons: PricingAddon[]
  discounts: PricingDiscount[]
  surcharges: PricingSurcharge[]
  policies: PricingPolicies
}

export function emptyPricingCatalogDoc(): PricingCatalogDoc {
  return {
    v: 1,
    packages: [],
    services: [],
    addons: [],
    discounts: [],
    surcharges: [],
    policies: {
      defaultDepositPercent: 50,
      salesTaxPercent: 0,
      minimumBillableHours: 0,
    },
  }
}

export function normalizePricingCatalogDoc(raw: unknown): PricingCatalogDoc {
  const e = emptyPricingCatalogDoc()
  if (!raw || typeof raw !== 'object') return e
  const o = raw as Record<string, unknown>
  if (o.v !== 1) return e
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  return {
    v: 1,
    packages: arr(o.packages),
    services: arr(o.services),
    addons: arr(o.addons),
    discounts: arr(o.discounts),
    surcharges: arr(o.surcharges),
    policies: {
      defaultDepositPercent: typeof o.policies === 'object' && o.policies && 'defaultDepositPercent' in o.policies
        ? Number((o.policies as PricingPolicies).defaultDepositPercent) || e.policies.defaultDepositPercent
        : e.policies.defaultDepositPercent,
      salesTaxPercent: typeof o.policies === 'object' && o.policies && 'salesTaxPercent' in o.policies
        ? Number((o.policies as PricingPolicies).salesTaxPercent) || 0
        : e.policies.salesTaxPercent,
      minimumBillableHours: typeof o.policies === 'object' && o.policies && 'minimumBillableHours' in o.policies
        ? Number((o.policies as PricingPolicies).minimumBillableHours) || 0
        : e.policies.minimumBillableHours,
    },
  }
}

export type DealPricingFinalSource = 'calculated' | 'manual'

/** Persisted on `deals.pricing_snapshot` */
export interface DealPricingSnapshot {
  v: 1
  finalSource: DealPricingFinalSource
  subtotalBeforeTax: number
  taxAmount: number
  total: number
  depositDue: number
  baseMode: 'package' | 'hourly'
  packageId: string | null
  serviceId: string | null
  /** Hourly service used for overtime when base is package */
  overtimeServiceId: string | null
  performanceHours: number
  addonQuantities: Record<string, number>
  surchargeIds: string[]
  discountIds: string[]
  lastCalculatedTotal: number | null
  computedAt: string
  /** Deposit % used for `depositDue` (intake Phase 5 or catalog default or prior save). */
  depositPercentApplied?: number
}

export function isDealPricingSnapshot(x: unknown): x is DealPricingSnapshot {
  return !!x && typeof x === 'object' && (x as DealPricingSnapshot).v === 1
}

export type TemplateSectionKind = 'header' | 'body' | 'footer' | 'signatures'

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
  /** Street address line 1 (number + street). Used first in Google Calendar location. */
  location: string | null
  city: string | null
  /** Unit, suite, floor, or building (optional). */
  address_line2: string | null
  /** State, province, or region (e.g. FL, ON). */
  region: string | null
  postal_code: string | null
  country: string | null
  venue_type: VenueType
  priority: number
  status: OutreachStatus
  /** pipeline = manager-sourced (commission); community = artist existing network (nurture) */
  outreach_track: OutreachTrack
  follow_up_date: string | null
  deal_terms: DealTerms | null
  /** Capacity for agreements (flexible text). */
  capacity: string | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  user_id: string
  venue_id: string
  name: string
  /** Canonical title key from app catalog; when set, `role` should be null. */
  title_key: string | null
  /** Legacy free-text title until migrated to `title_key`. */
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
  intake: 'Booking intake',
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

export type GeneratedFileSource = 'generated' | 'upload'

export interface GeneratedFile {
  id: string
  user_id: string
  name: string
  template_id: string | null
  venue_id: string | null
  deal_id: string | null
  content: string
  output_format: GeneratedFileOutputFormat
  /** `generated` = File Builder; `upload` = user upload in Files. */
  file_source?: GeneratedFileSource
  pdf_storage_path: string | null
  pdf_public_url: string | null
  /** Set when using first-party /agreements/{slug} links; null for legacy rows. */
  pdf_share_slug: string | null
  /** User uploads stored in `email-assets` bucket (see upload_public_url). */
  upload_storage_path?: string | null
  upload_public_url?: string | null
  upload_mime_type?: string | null
  created_at: string
  venue?: Pick<Venue, 'id' | 'name'> | null
  template?: Pick<Template, 'id' | 'name'> | null
}

export interface ArtistProfile {
  user_id: string
  artist_name: string
  artist_email: string
  manager_name: string | null
  /** Shown under manager name in email footers (e.g. Artist Manager). */
  manager_title: string | null
  manager_email: string | null
  /** Manager phone for agreements and correspondence. */
  manager_phone: string | null
  from_email: string
  company_name: string | null
  website: string | null
  phone: string | null
  social_handle: string | null
  tagline: string | null
  reply_to_email: string | null
  /** Minutes after queue before cron auto-sends; 5|10|15|20|30 (default 10 if column missing pre-migration) */
  email_queue_buffer_minutes?: number
  /** Added to Email Queue “today” usage (Pacific); use with Resend dashboard baseline. */
  email_usage_day_offset?: number
  /** Added to Email Queue “this month” usage (Pacific). */
  email_usage_month_offset?: number
  /** When set (≥1), Email Queue daily cap; otherwise `VITE_RESEND_DAILY_EMAIL_CAP` or app default (100). */
  resend_daily_email_cap?: number | null
  /** When set (≥1), Email Queue monthly cap; otherwise env or default (3000). */
  resend_monthly_email_cap?: number | null
  /** When true, Netlify send functions replace To with test inboxes (see Settings). */
  email_test_mode?: boolean
  email_test_artist_inbox?: string | null
  email_test_client_inbox?: string | null
  created_at: string
  updated_at: string
}

/** Keys in `profile_field_preset.field_key` — keep in sync with migration 048 CHECK constraint. */
export type ProfileFieldPresetKey =
  | 'artist_name'
  | 'artist_email'
  | 'manager_name'
  | 'manager_title'
  | 'manager_email'
  | 'manager_phone'
  | 'from_email'
  | 'company_name'
  | 'website'
  | 'phone'
  | 'social_handle'
  | 'tagline'
  | 'reply_to_email'

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
  /** Show start/end (timestamptz ISO). Prefer over event_date when both set. */
  event_start_at: string | null
  event_end_at: string | null
  /** When set, show is off the calendar (cancelled) but deal row kept for earnings history. */
  event_cancelled_at: string | null
  /** Google Calendar event id on the shared DJ calendar (server-written). */
  google_shared_calendar_event_id: string | null
  /** Etag for Calendar API conditional patch. */
  google_shared_calendar_event_etag: string | null
  /** Set when the deal first becomes calendar-eligible; drives sidebar Calendar badge vs nav_badges.seen_at. */
  calendar_first_listed_at: string | null
  ics_invite_sent_at: string | null
  reminder_24h_queued_at: string | null
  performance_genre: string | null
  /** DJ/performance set window (UTC ISO); separate from event_start_at/event_end_at. */
  performance_start_at: string | null
  performance_end_at: string | null
  onsite_contact_id: string | null
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
  /** Show report recap lines (`DealPromiseLinesDoc` in `showReportCatalog`). */
  promise_lines?: unknown | null
  /** Deal Terms calculator snapshot; null until saved with calculator or legacy deals. */
  pricing_snapshot?: unknown | null
  deposit_due_amount?: number | null
  deposit_paid_amount?: number
  /** Payments toward contract remainder (after deposit leg). */
  balance_paid_amount?: number
  notes: string | null
  created_at: string
  updated_at: string
  venue?: Pick<Venue, 'id' | 'name' | 'outreach_track' | 'status' | 'capacity' | 'deal_terms'> | null
}

export type VenueEmailType =
  | 'booking_confirmation'
  | 'payment_receipt'
  | 'payment_reminder'
  | 'agreement_ready'
  | 'follow_up'
  | 'rebooking_inquiry'
  | 'first_outreach'
  | 'pre_event_checkin'
  | 'post_show_thanks'
  | 'agreement_followup'
  | 'invoice_sent'
  | 'show_cancelled_or_postponed'
  | 'pass_for_now'

export type ArtistEmailType =
  | 'management_report'
  | 'retainer_reminder'
  | 'retainer_received'
  | 'performance_report_request'
  | 'performance_report_received'
  | 'gig_calendar_digest_weekly'
  | 'gig_reminder_24h'
  /** Per-show reminder queued from gig detail modal; same creative as 24h reminder, no day-before gate. */
  | 'gig_reminder_manual'
  | 'gig_booked_ics'
  /** Queued from gig calendar: one-day schedule to artist (buffer 0). */
  | 'gig_day_summary_manual'

export type AnyEmailType = VenueEmailType | ArtistEmailType

export type VenueEmailStatus = 'pending' | 'sending' | 'sent' | 'failed'

export const VENUE_EMAIL_TYPE_LABELS: Record<VenueEmailType, string> = {
  booking_confirmation: 'Booking Confirmation',
  payment_receipt: 'Payment Receipt',
  payment_reminder: 'Payment Reminder',
  agreement_ready: 'Agreement Ready',
  follow_up: 'Follow-Up',
  rebooking_inquiry: 'Rebooking Inquiry',
  first_outreach: 'First outreach',
  pre_event_checkin: 'Pre-event check-in',
  post_show_thanks: 'Post-show thank-you',
  agreement_followup: 'Agreement follow-up',
  invoice_sent: 'Invoice sent',
  show_cancelled_or_postponed: 'Show cancelled or postponed',
  pass_for_now: 'Pass for now (close)',
}

export const ARTIST_EMAIL_TYPE_LABELS: Record<ArtistEmailType, string> = {
  management_report: 'Management Report',
  retainer_reminder: 'Retainer Reminder',
  retainer_received: 'Retainer payment received',
  performance_report_request: 'Performance Report Request',
  performance_report_received: 'Performance report received',
  gig_calendar_digest_weekly: 'Weekly (Sundays, PT) — next 2 weeks of gigs',
  gig_reminder_24h: 'Gig reminder — day before show (morning PT)',
  gig_reminder_manual: 'Gig reminder — manual (from calendar)',
  gig_booked_ics: 'Gig booked — confirmation email (calendar synced)',
  gig_day_summary_manual: 'Gig schedule — day summary (manual)',
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
  fee_total: number | null
  amount_received: number | null
  payment_dispute_claimed_amount: number | null
  venue_interest: 'yes' | 'no' | 'unsure' | null
  relationship_quality: 'good' | 'neutral' | 'poor' | null
  notes: string | null
  media_links: string | null
  commission_flagged: boolean
  submitted: boolean
  submitted_at: string | null
  created_at: string
  /** V1 extended answers — see `performanceReportV1.ts` for automation mapping */
  chase_payment_followup: 'no' | 'unsure' | 'yes' | null
  payment_dispute: 'no' | 'yes' | null
  production_issue_level: 'none' | 'minor' | 'serious' | null
  production_friction_tags: string[] | null
  rebooking_timeline: import('@/lib/performanceReportV1').RebookingTimeline | null
  wants_booking_call: 'no' | 'yes' | null
  wants_manager_venue_contact: 'no' | 'yes' | null
  would_play_again: 'yes' | 'maybe' | 'no' | null
  cancellation_reason:
    | 'venue_cancelled'
    | 'weather'
    | 'low_turnout'
    | 'illness'
    | 'logistics'
    | 'other'
    | null
  referral_lead: 'no' | 'yes' | null
  /**
   * Legacy: flat venue-only `{ id, met }[]`.
   * V2: `{ v: 2, venue, artist }` when the deal has artist recap lines — see `showReportCatalog.ts`.
   */
  promise_results?:
    | { id: string; met: boolean }[]
    | import('@/lib/showReportCatalog').StoredPromiseResultsV2
    | null
  night_mood?: string | null
  rescheduled_to_date?: string | null
  rebooking_specific_date?: string | null
  cancellation_freeform?: string | null
  creation_source: 'task_automation' | 'artist_email' | 'manager_dashboard' | null
  submitted_by: 'artist_link' | 'manager_dashboard' | null
  venue?: Pick<Venue, 'id' | 'name'> | null
  deal?: Pick<Deal, 'id' | 'description' | 'event_date' | 'gross_amount' | 'promise_lines'> | null
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
  /** Set when Resend API accepted the send (usage meter counts only these). */
  resend_message_id?: string | null
  /** When set, row is not eligible to send until this time (24h reminders, etc.). */
  scheduled_send_at: string | null
  /** Set while process-email-queue holds an exclusive send lock (status=sending). */
  processing_started_at?: string | null
  notes: string | null
  created_at: string
  venue?: Pick<Venue, 'id' | 'name' | 'city' | 'location'> | null
  deal?: Pick<Deal, 'id' | 'description' | 'event_date' | 'gross_amount' | 'agreement_url' | 'agreement_generated_file_id' | 'notes' | 'payment_due_date' | 'artist_paid'> | null
  contact?: Pick<Contact, 'id' | 'name' | 'email'> | null
}
