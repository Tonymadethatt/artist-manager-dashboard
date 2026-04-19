import type { SupabaseClient } from '@supabase/supabase-js'
import { brandingFromArtistProfileRow, type PublicFormBranding } from '../../src/lib/publicFormBranding'
import {
  resolveVenuePromiseLinesForDeal,
  resolveArtistPromiseLinesForDeal,
  type DealPromiseLine,
} from '../../src/lib/showReportCatalog'

const ARTIST_PROFILE_SELECT =
  'company_name, artist_name, tagline, manager_name, manager_title, website, social_handle, phone, reply_to_email, from_email, manager_email'

async function brandingForUser(supabase: SupabaseClient, userId: string): Promise<PublicFormBranding> {
  const { data: row } = await supabase
    .from('artist_profile')
    .select(ARTIST_PROFILE_SELECT)
    .eq('user_id', userId)
    .maybeSingle()
  return brandingFromArtistProfileRow(row)
}

/** Row payload for `get-performance-report` JSON (without `valid`). */
export type PerformanceReportPublicLoaded = {
  submitted: boolean
  venueName: string | null
  eventDate: string | null
  dealDescription: string | null
  dealGrossAmount: number | null
  promiseLines: DealPromiseLine[]
  venuePromiseLines: DealPromiseLine[]
  artistPromiseLines: DealPromiseLine[]
  branding: PublicFormBranding
}

export async function loadPerformanceReportPublicForToken(
  supabase: SupabaseClient,
  token: string,
): Promise<PerformanceReportPublicLoaded | null> {
  const { data, error } = await supabase
    .from('performance_reports')
    .select(
      'id, token, submitted, user_id, venues(name), deals(description, event_date, gross_amount, promise_lines)',
    )
    .eq('token', token)
    .single()

  if (error || !data) return null

  const venue = data.venues as { name: string } | null
  const deal = data.deals as {
    description: string
    event_date: string | null
    gross_amount: number | null
    promise_lines: unknown
  } | null
  const userId = data.user_id as string
  const branding = await brandingForUser(supabase, userId)
  const venuePromiseLines = resolveVenuePromiseLinesForDeal(deal?.promise_lines ?? null)
  const artistPromiseLines = resolveArtistPromiseLinesForDeal(deal?.promise_lines ?? null)

  return {
    submitted: data.submitted,
    venueName: venue?.name ?? null,
    eventDate: deal?.event_date ?? null,
    dealDescription: deal?.description ?? null,
    dealGrossAmount:
      deal?.gross_amount != null && Number.isFinite(Number(deal.gross_amount))
        ? Number(deal.gross_amount)
        : null,
    promiseLines: venuePromiseLines,
    venuePromiseLines,
    artistPromiseLines,
    branding,
  }
}
