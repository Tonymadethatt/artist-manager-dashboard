import type { VenueType } from '@/types'

/** Grouped for searchable entity-type UI (order within a group follows VENUE_TYPE_ORDER). */
export const VENUE_TYPE_GROUPS: { label: string; types: VenueType[] }[] = [
  {
    label: 'Nightlife & shows',
    types: ['bar', 'club', 'lounge', 'theater', 'festival', 'arena', 'stadium', 'outdoor_space'],
  },
  {
    label: 'Hospitality & dining',
    types: ['restaurant', 'hotel', 'resort', 'cafe', 'brewery', 'winery', 'casino', 'convention_center', 'country_club'],
  },
  {
    label: 'Spaces & venues',
    types: [
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
    ],
  },
  {
    label: 'Partners & organizations',
    types: [
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
    ],
  },
  { label: 'Other', types: ['other'] },
]
