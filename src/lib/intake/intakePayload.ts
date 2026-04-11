import type { CommissionTier, OutreachStatus, OutreachTrack, VenueType } from '@/types'
import { SHOW_REPORT_PRESETS } from '@/lib/showReportCatalog'

export const INTAKE_SCHEMA_VERSION = 1

export type IntakeContactDraft = {
  name: string
  role: string
  email: string
  phone: string
  company: string
}

export type VenueIntakeFields = {
  /** Client / booker first name (opener + closer). */
  call_contact_name: string
  name: string
  location: string
  city: string
  address_line2: string
  region: string
  postal_code: string
  country: string
  venue_type: VenueType
  priority: number
  status: OutreachStatus
  outreach_track: OutreachTrack
  follow_up_date: string | null
  capacity: string | null
}

export type ShowPricingDraft = {
  baseMode: 'package' | 'hourly'
  packageId: string | null
  serviceId: string | null
  overtimeServiceId: string | null
  performanceHours: number
  addonQuantities: Record<string, number>
  surchargeIds: string[]
  discountIds: string[]
}

export type ShowIntakeFields = {
  description: string
  event_date: string
  event_start_time: string
  event_end_time: string
  gross_amount: string
  commission_tier: CommissionTier
  payment_due_date: string
  notes: string
  performance_genre: string
  performance_start_time: string
  performance_end_time: string
  venue_capacity: string
  pricing: ShowPricingDraft
  promisePresets: Record<string, boolean>
}

export type VenueIntakeBundle = {
  fields: VenueIntakeFields
  checklist: Record<string, boolean>
  /** Per-question scratch notes when no dedicated field exists */
  freeText: Record<string, string>
  contacts: IntakeContactDraft[]
}

export type ShowIntakeBundle = {
  fields: ShowIntakeFields
  checklist: Record<string, boolean>
  freeText: Record<string, string>
}

function defaultPromisePresets(): Record<string, boolean> {
  return Object.fromEntries(SHOW_REPORT_PRESETS.map(p => [p.id, true])) as Record<string, boolean>
}

export function emptyVenueFields(): VenueIntakeFields {
  return {
    call_contact_name: '',
    name: '',
    location: '',
    city: '',
    address_line2: '',
    region: '',
    postal_code: '',
    country: '',
    venue_type: 'other',
    priority: 3,
    status: 'not_contacted',
    outreach_track: 'pipeline',
    follow_up_date: null,
    capacity: null,
  }
}

export function emptyShowFields(): ShowIntakeFields {
  return {
    description: '',
    event_date: '',
    event_start_time: '20:00',
    event_end_time: '23:00',
    gross_amount: '',
    commission_tier: 'new_doors',
    payment_due_date: '',
    notes: '',
    performance_genre: '',
    performance_start_time: '',
    performance_end_time: '',
    venue_capacity: '',
    pricing: {
      baseMode: 'hourly',
      packageId: null,
      serviceId: null,
      overtimeServiceId: null,
      performanceHours: 4,
      addonQuantities: {},
      surchargeIds: [],
      discountIds: [],
    },
    promisePresets: defaultPromisePresets(),
  }
}

export function emptyVenueBundle(): VenueIntakeBundle {
  return {
    fields: emptyVenueFields(),
    checklist: {},
    freeText: {},
    contacts: [],
  }
}

export function emptyShowBundle(): ShowIntakeBundle {
  return {
    fields: emptyShowFields(),
    checklist: {},
    freeText: {},
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

export function parseVenueBundle(raw: unknown): VenueIntakeBundle {
  const base = emptyVenueBundle()
  if (!isPlainObject(raw)) return base
  const fieldsIn = raw.fields
  if (isPlainObject(fieldsIn)) {
    const f = fieldsIn as Partial<VenueIntakeFields>
    base.fields = {
      ...base.fields,
      ...f,
      venue_type: (f.venue_type as VenueType) ?? base.fields.venue_type,
      status: (f.status as OutreachStatus) ?? base.fields.status,
      outreach_track: (f.outreach_track as OutreachTrack) ?? base.fields.outreach_track,
    }
  }
  const cl = raw.checklist
  if (isPlainObject(cl)) base.checklist = { ...cl } as Record<string, boolean>
  const ft = raw.freeText
  if (isPlainObject(ft)) base.freeText = { ...ft } as Record<string, string>
  const c = raw.contacts
  if (Array.isArray(c)) {
    base.contacts = c
      .filter(isPlainObject)
      .map(x => ({
        name: String(x.name ?? ''),
        role: String(x.role ?? ''),
        email: String(x.email ?? ''),
        phone: String(x.phone ?? ''),
        company: String(x.company ?? ''),
      }))
  }
  return base
}

export function parseShowBundle(raw: unknown): ShowIntakeBundle {
  const base = emptyShowBundle()
  if (!isPlainObject(raw)) return base
  const fieldsIn = raw.fields
  if (isPlainObject(fieldsIn)) {
    const f = fieldsIn as Partial<ShowIntakeFields>
    const pr = f.pricing
    const pricing: ShowPricingDraft = {
      ...emptyShowFields().pricing,
      ...(isPlainObject(pr) ? (pr as ShowPricingDraft) : {}),
    }
    const promisePresets = isPlainObject(f.promisePresets)
      ? { ...defaultPromisePresets(), ...(f.promisePresets as Record<string, boolean>) }
      : defaultPromisePresets()
    base.fields = {
      ...emptyShowFields(),
      ...f,
      commission_tier: (f.commission_tier as CommissionTier) ?? emptyShowFields().commission_tier,
      pricing,
      promisePresets,
    }
  }
  const cl = raw.checklist
  if (isPlainObject(cl)) base.checklist = { ...cl } as Record<string, boolean>
  const ft = raw.freeText
  if (isPlainObject(ft)) base.freeText = { ...ft } as Record<string, string>
  return base
}
