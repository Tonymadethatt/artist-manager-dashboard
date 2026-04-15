import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { PerformanceReport, ArtistProfile } from '@/types'
import { ARTIST_EMAIL_TYPE_LABELS } from '@/types'
import { recordOutboundEmail } from '@/lib/email/recordOutboundEmail'

export function usePerformanceReports() {
  const [reports, setReports] = useState<PerformanceReport[]>([])
  const [loading, setLoading] = useState(true)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('performance_reports')
      .select('*, venue:venues(id, name), deal:deals(id, description, event_date, gross_amount, promise_lines)')
      .order('created_at', { ascending: false })
    setReports((data ?? []) as PerformanceReport[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  /**
   * Creates a new performance report row and sends the form email to the artist.
   * Loads `performance_report_request` overrides from email_templates when present.
   */
  const createReport = async (
    venueId: string,
    dealId: string | null,
    profile: Pick<
      ArtistProfile,
      | 'artist_name'
      | 'artist_email'
      | 'from_email'
      | 'reply_to_email'
      | 'manager_name'
      | 'manager_title'
      | 'website'
      | 'social_handle'
      | 'phone'
    >,
    venueName: string,
    eventDate: string | null,
  ): Promise<{ report?: PerformanceReport; formUrl?: string; error?: string }> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // Insert row via authenticated client
    const { data: row, error: insertError } = await supabase
      .from('performance_reports')
      .insert({ user_id: user.id, venue_id: venueId, deal_id: dealId, creation_source: 'artist_email' })
      .select('*, venue:venues(id, name), deal:deals(id, description, event_date, gross_amount, promise_lines)')
      .single()

    if (insertError || !row) {
      return { error: insertError?.message ?? 'Failed to create report' }
    }

    const report = row as PerformanceReport
    setReports(prev => [report, ...prev])

    const { data: perfTmpl } = await supabase
      .from('email_templates')
      .select('custom_subject, custom_intro, layout')
      .eq('user_id', user.id)
      .eq('email_type', 'performance_report_request')
      .maybeSingle()

    // Call function to send email (only needs RESEND_API_KEY)
    const siteUrl = window.location.origin
    const formUrl = `${siteUrl}/performance-report/${report.token}`

    try {
      const res = await fetch('/.netlify/functions/send-performance-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: report.token,
          venueName,
          eventDate,
          artistName: profile.artist_name,
          artistEmail: profile.artist_email,
          fromEmail: profile.from_email,
          replyToEmail: profile.reply_to_email || profile.from_email,
          managerName: profile.manager_name || 'Your Manager',
          managerTitle: profile.manager_title ?? null,
          website: profile.website ?? null,
          social_handle: profile.social_handle ?? null,
          phone: profile.phone ?? null,
          custom_subject: perfTmpl?.custom_subject ?? null,
          custom_intro: perfTmpl?.custom_intro ?? null,
          layout: perfTmpl?.layout ?? null,
          user_id: user.id,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[usePerformanceReports] Email send failed:', err)
        // Return the report and formUrl even if email fails — manager can copy link manually
        return { report, formUrl, error: 'Report created but email failed to send. Use copy link.' }
      }
      const label = ARTIST_EMAIL_TYPE_LABELS.performance_report_request
      const subj = (perfTmpl?.custom_subject as string | null)?.trim() || `${label} · ${venueName}`
      await recordOutboundEmail(supabase, {
        user_id: user.id,
        venue_id: venueId,
        deal_id: dealId,
        email_type: 'performance_report_request',
        recipient_email: profile.artist_email,
        subject: subj,
        status: 'sent',
        source: 'performance_form',
        detail: venueName,
      })
    } catch (e) {
      console.error('[usePerformanceReports] Email send error:', e)
      return { report, formUrl, error: 'Report created but email failed to send. Use copy link.' }
    }

    return { report, formUrl }
  }

  /**
   * Creates a pending report row **without** emailing the artist (manager completes manually or copies link later).
   */
  const createReportWithoutEmail = async (
    venueId: string,
    dealId: string | null,
  ): Promise<{ report?: PerformanceReport; error?: string }> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data: row, error: insertError } = await supabase
      .from('performance_reports')
      .insert({
        user_id: user.id,
        venue_id: venueId,
        deal_id: dealId,
        creation_source: 'manager_dashboard',
      })
      .select('*, venue:venues(id, name), deal:deals(id, description, event_date, gross_amount, promise_lines)')
      .single()

    if (insertError || !row) {
      return { error: insertError?.message ?? 'Failed to create report' }
    }

    const report = row as PerformanceReport
    setReports(prev => [report, ...prev])
    return { report }
  }

  /**
   * Resets an existing pending report with a new token and re-sends the email.
   * Old link becomes invalid. New link is sent to the artist.
   */
  const resendReport = async (
    reportId: string,
    profile: Pick<
      ArtistProfile,
      | 'artist_name'
      | 'artist_email'
      | 'from_email'
      | 'reply_to_email'
      | 'manager_name'
      | 'manager_title'
      | 'website'
      | 'social_handle'
      | 'phone'
    >,
  ): Promise<{ formUrl?: string; error?: string }> => {
    const { data: { user: resendUser } } = await supabase.auth.getUser()
    if (!resendUser) return { error: 'Not authenticated' }

    // Generate a new UUID token using crypto API
    const newToken = crypto.randomUUID()

    const { data: updated, error: updateError } = await supabase
      .from('performance_reports')
      .update({
        token: newToken,
        token_used: false,
        submitted: false,
        submitted_at: null,
        event_happened: null,
        event_rating: null,
        attendance: null,
        artist_paid_status: null,
        payment_amount: null,
        venue_interest: null,
        relationship_quality: null,
        notes: null,
        media_links: null,
        commission_flagged: false,
        chase_payment_followup: null,
        payment_dispute: null,
        production_issue_level: null,
        production_friction_tags: [],
        rebooking_timeline: null,
        wants_booking_call: null,
        wants_manager_venue_contact: null,
        would_play_again: null,
        cancellation_reason: null,
        referral_lead: null,
        submitted_by: null,
        creation_source: 'artist_email',
        fee_total: null,
        amount_received: null,
        payment_dispute_claimed_amount: null,
        promise_results: null,
        night_mood: null,
        rescheduled_to_date: null,
        rebooking_specific_date: null,
        cancellation_freeform: null,
      })
      .eq('id', reportId)
      .select('*, venue:venues(id, name), deal:deals(id, description, event_date, gross_amount, promise_lines)')
      .single()

    if (updateError || !updated) {
      return { error: updateError?.message ?? 'Failed to reset report' }
    }

    const report = updated as PerformanceReport
    setReports(prev => prev.map(r => r.id === reportId ? report : r))

    const { data: perfTmpl } = await supabase
      .from('email_templates')
      .select('custom_subject, custom_intro, layout')
      .eq('user_id', resendUser.id)
      .eq('email_type', 'performance_report_request')
      .maybeSingle()

    const siteUrl = window.location.origin
    const formUrl = `${siteUrl}/performance-report/${newToken}`
    const venueName = report.venue?.name ?? 'venue'
    const eventDate = report.deal?.event_date ?? null

    try {
      const res = await fetch('/.netlify/functions/send-performance-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: newToken,
          venueName,
          eventDate,
          artistName: profile.artist_name,
          artistEmail: profile.artist_email,
          fromEmail: profile.from_email,
          replyToEmail: profile.reply_to_email || profile.from_email,
          managerName: profile.manager_name || 'Your Manager',
          managerTitle: profile.manager_title ?? null,
          website: profile.website ?? null,
          social_handle: profile.social_handle ?? null,
          phone: profile.phone ?? null,
          custom_subject: perfTmpl?.custom_subject ?? null,
          custom_intro: perfTmpl?.custom_intro ?? null,
          layout: perfTmpl?.layout ?? null,
          user_id: resendUser.id,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[usePerformanceReports] Resend email failed:', err)
        return { formUrl, error: 'Token reset but email failed. Use copy link.' }
      }
      const label = ARTIST_EMAIL_TYPE_LABELS.performance_report_request
      const subj = (perfTmpl?.custom_subject as string | null)?.trim() || `${label} · ${venueName}`
      await recordOutboundEmail(supabase, {
        user_id: resendUser.id,
        venue_id: report.venue_id,
        deal_id: report.deal_id,
        email_type: 'performance_report_request',
        recipient_email: profile.artist_email,
        subject: subj,
        status: 'sent',
        source: 'performance_form',
        detail: `${venueName} (resend)`,
      })
    } catch (e) {
      console.error('[usePerformanceReports] Resend error:', e)
      return { formUrl, error: 'Token reset but email failed. Use copy link.' }
    }

    return { formUrl }
  }

  const deleteReport = async (reportId: string): Promise<{ error?: string }> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('performance_reports')
      .delete()
      .eq('id', reportId)
      .eq('user_id', user.id)

    if (error) return { error: error.message }
    setReports(prev => prev.filter(r => r.id !== reportId))
    return {}
  }

  return {
    reports,
    loading,
    refetch: fetchReports,
    createReport,
    createReportWithoutEmail,
    resendReport,
    deleteReport,
  }
}
