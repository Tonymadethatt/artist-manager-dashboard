export type VariableGroup = 'venue' | 'deal' | 'contact' | 'artist'

export interface VariableCatalogEntry {
  key: string
  label: string
  group: VariableGroup
}

/** Canonical list for slash-menu and docs; keys match {{snake_case}} tokens. */
export const AGREEMENT_VARIABLE_CATALOG: VariableCatalogEntry[] = [
  { key: 'venue_name', label: 'Venue name', group: 'venue' },
  { key: 'city', label: 'City', group: 'venue' },
  { key: 'location', label: 'Street address (line 1)', group: 'venue' },
  { key: 'venue_type', label: 'Venue type (slug)', group: 'venue' },
  { key: 'venue_type_label', label: 'Venue type (label)', group: 'venue' },
  { key: 'event_date', label: 'Event date (venue terms or deal)', group: 'venue' },
  { key: 'artist_pay', label: 'Artist pay', group: 'venue' },
  { key: 'artist_pay_display', label: 'Artist pay (currency)', group: 'venue' },
  { key: 'set_length', label: 'Set length', group: 'venue' },
  { key: 'load_in_time', label: 'Load-in time', group: 'venue' },
  { key: 'notes', label: 'Notes (venue terms)', group: 'venue' },
  { key: 'venue_capacity', label: 'Venue capacity', group: 'venue' },

  { key: 'deal_description', label: 'Deal description', group: 'deal' },
  { key: 'event_name', label: 'Event name (same as deal description)', group: 'deal' },
  { key: 'event_start_time', label: 'Event start time (Pacific)', group: 'deal' },
  { key: 'event_end_time', label: 'Event end time (Pacific)', group: 'deal' },
  { key: 'event_date_display', label: 'Event date display (Pacific)', group: 'deal' },
  { key: 'event_window_display', label: 'Event window (date + times)', group: 'deal' },
  { key: 'performance_genre', label: 'Performance / set genre', group: 'deal' },
  { key: 'performance_start_time', label: 'Performance set start (Pacific)', group: 'deal' },
  { key: 'performance_end_time', label: 'Performance set end (Pacific)', group: 'deal' },
  { key: 'performance_date_display', label: 'Performance date (Pacific)', group: 'deal' },
  { key: 'performance_window_display', label: 'Performance window (date + times)', group: 'deal' },
  { key: 'set_start_time', label: 'Set start (performance, else event; Pacific 24h)', group: 'deal' },
  { key: 'set_end_time', label: 'Set end (performance, else event; Pacific 24h)', group: 'deal' },
  { key: 'set_duration', label: 'Set duration (computed or venue set_length)', group: 'deal' },
  { key: 'balance_amount', label: 'Balance due (gross − deposit paid)', group: 'deal' },
  { key: 'balance_amount_display', label: 'Balance due (currency)', group: 'deal' },
  { key: 'remaining_balance', label: 'Same as balance_amount (alias)', group: 'deal' },
  { key: 'remaining_balance_display', label: 'Same as balance_amount_display (alias)', group: 'deal' },
  { key: 'onsite_contact_name', label: 'On-site contact name', group: 'deal' },
  { key: 'onsite_contact_role', label: 'On-site contact role', group: 'deal' },
  { key: 'onsite_contact_email', label: 'On-site contact email', group: 'deal' },
  { key: 'onsite_contact_phone', label: 'On-site contact phone', group: 'deal' },
  { key: 'onsite_contact_phone_display', label: 'On-site contact phone (formatted)', group: 'deal' },
  { key: 'onsite_contact_company', label: 'On-site contact company', group: 'deal' },
  { key: 'deal_event_date', label: 'Deal event date', group: 'deal' },
  { key: 'gross_amount', label: 'Gross amount', group: 'deal' },
  { key: 'gross_amount_display', label: 'Gross amount (currency)', group: 'deal' },
  { key: 'commission_rate', label: 'Commission rate (percent, matches Earnings)', group: 'deal' },
  { key: 'commission_rate_fraction', label: 'Commission rate (decimal, e.g. 0.2)', group: 'deal' },
  { key: 'commission_amount', label: 'Commission amount', group: 'deal' },
  { key: 'commission_amount_display', label: 'Commission amount (currency)', group: 'deal' },
  { key: 'commission_tier', label: 'Commission tier (includes Artist network = no booking commission)', group: 'deal' },
  { key: 'payment_due_date', label: 'Payment due date', group: 'deal' },
  { key: 'agreement_url', label: 'Agreement URL', group: 'deal' },
  { key: 'deal_notes', label: 'Deal notes', group: 'deal' },
  {
    key: 'pricing_summary_text',
    label: 'Pricing summary (from deal calculator; empty if no snapshot)',
    group: 'deal',
  },
  {
    key: 'pricing_total_display',
    label: 'Pricing total — currency (from snapshot)',
    group: 'deal',
  },
  {
    key: 'pricing_deposit_display',
    label: 'Pricing deposit — currency (from snapshot)',
    group: 'deal',
  },

  { key: 'contact_name', label: 'Contact name', group: 'contact' },
  { key: 'contact_role', label: 'Contact role', group: 'contact' },
  { key: 'contact_email', label: 'Contact email', group: 'contact' },
  { key: 'contact_phone', label: 'Contact phone', group: 'contact' },
  { key: 'contact_phone_display', label: 'Contact phone (formatted)', group: 'contact' },
  { key: 'contact_company', label: 'Contact company', group: 'contact' },
  { key: 'client_name', label: 'Client / counterparty name (alias)', group: 'contact' },
  { key: 'client_role', label: 'Client role (alias)', group: 'contact' },
  { key: 'client_email', label: 'Client email (alias)', group: 'contact' },
  { key: 'client_phone', label: 'Client phone (alias)', group: 'contact' },
  { key: 'client_phone_display', label: 'Client phone formatted (alias)', group: 'contact' },
  { key: 'client_company', label: 'Client company (alias)', group: 'contact' },

  { key: 'artist_name', label: 'Artist name', group: 'artist' },
  { key: 'company_name', label: 'Company name (Settings; else contact company)', group: 'artist' },
  { key: 'tagline', label: 'Tagline', group: 'artist' },
  { key: 'website', label: 'Website', group: 'artist' },
  { key: 'phone', label: 'Phone (raw from Settings)', group: 'artist' },
  { key: 'phone_display', label: 'Phone (formatted for documents)', group: 'artist' },
  { key: 'social_handle', label: 'Social handle', group: 'artist' },
  { key: 'reply_to_email', label: 'Reply-to email', group: 'artist' },
  { key: 'artist_email', label: 'Artist email', group: 'artist' },
  { key: 'manager_name', label: 'Manager name', group: 'artist' },
  { key: 'manager_email', label: 'Manager email', group: 'artist' },
  { key: 'from_email', label: 'From email', group: 'artist' },
]

export function catalogKeysUnion(templateExtraKeys: string[]): string[] {
  const fromCatalog = AGREEMENT_VARIABLE_CATALOG.map(e => e.key)
  return [...new Set([...fromCatalog, ...templateExtraKeys])].sort((a, b) =>
    a.localeCompare(b)
  )
}
