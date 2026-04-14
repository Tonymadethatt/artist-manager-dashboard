/**
 * Official last-12-months list — inserted when the user has no rows yet.
 * `usePartnershipRoll` seeds from this only when the table is empty for that user.
 */
export type PartnershipRollSeedRow = {
  name: string
  cohort: 'recent'
  source: 'system'
  is_confirmed: boolean
  sort_order: number
}

export const PARTNERSHIP_ROLL_MOCK_SEED: PartnershipRollSeedRow[] = [
  { name: 'The Mayan', cohort: 'recent', source: 'system', is_confirmed: false, sort_order: 0 },
  { name: 'West Eight (West 8LA)', cohort: 'recent', source: 'system', is_confirmed: false, sort_order: 1 },
  { name: 'Vive Nightclub', cohort: 'recent', source: 'system', is_confirmed: false, sort_order: 2 },
  { name: 'Godfrey Hotel Hollywood', cohort: 'recent', source: 'system', is_confirmed: false, sort_order: 3 },
  { name: 'Reforma', cohort: 'recent', source: 'system', is_confirmed: false, sort_order: 4 },
  { name: 'Dickies Arena', cohort: 'recent', source: 'system', is_confirmed: false, sort_order: 5 },
  { name: 'Riyadh Season / Sela Arena', cohort: 'recent', source: 'system', is_confirmed: false, sort_order: 6 },
  { name: 'Rizo Corp Art Gallery', cohort: 'recent', source: 'system', is_confirmed: false, sort_order: 7 },
  { name: 'Sevilla Ultra Lounge OC', cohort: 'recent', source: 'system', is_confirmed: false, sort_order: 8 },
  { name: 'Andaz San Diego Hotel', cohort: 'recent', source: 'system', is_confirmed: false, sort_order: 9 },
  { name: 'Baja Sharkeez Newport Beach', cohort: 'recent', source: 'system', is_confirmed: false, sort_order: 10 },
  { name: 'El Cielo Boat Parties', cohort: 'recent', source: 'system', is_confirmed: false, sort_order: 11 },
  { name: 'Rumba Uptown', cohort: 'recent', source: 'system', is_confirmed: false, sort_order: 12 },
]
