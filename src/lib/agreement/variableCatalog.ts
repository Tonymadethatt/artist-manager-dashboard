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
  { key: 'location', label: 'Location / address', group: 'venue' },
  { key: 'venue_type', label: 'Venue type (slug)', group: 'venue' },
  { key: 'venue_type_label', label: 'Venue type (label)', group: 'venue' },
  { key: 'event_date', label: 'Event date (venue terms or deal)', group: 'venue' },
  { key: 'artist_pay', label: 'Artist pay', group: 'venue' },
  { key: 'artist_pay_display', label: 'Artist pay (currency)', group: 'venue' },
  { key: 'set_length', label: 'Set length', group: 'venue' },
  { key: 'load_in_time', label: 'Load-in time', group: 'venue' },
  { key: 'notes', label: 'Notes (venue terms)', group: 'venue' },

  { key: 'deal_description', label: 'Deal description', group: 'deal' },
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

  { key: 'contact_name', label: 'Contact name', group: 'contact' },
  { key: 'contact_role', label: 'Contact role', group: 'contact' },
  { key: 'contact_email', label: 'Contact email', group: 'contact' },
  { key: 'contact_phone', label: 'Contact phone', group: 'contact' },
  { key: 'contact_company', label: 'Contact company', group: 'contact' },

  { key: 'artist_name', label: 'Artist name', group: 'artist' },
  { key: 'company_name', label: 'Company name (Settings; else contact company)', group: 'artist' },
  { key: 'tagline', label: 'Tagline', group: 'artist' },
  { key: 'website', label: 'Website', group: 'artist' },
  { key: 'phone', label: 'Phone', group: 'artist' },
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
