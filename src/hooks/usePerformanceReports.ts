import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { PerformanceReport, ArtistProfile } from '@/types'

export function usePerformanceReports() {
  const [reports, setReports] = useState<PerformanceReport[]>([])
  const [loading, setLoading] = useState(true)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('performance_reports')
      .select('*, venue:venues(id, name), deal:deals(id, description, event_date)')
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
    profile: Pick<ArtistProfile, 'artist_name' | 'artist_email' | 'from_email' | 'reply_to_email' | 'manager_name'>,
    venueName: string,
    eventDate: string | null,
  ): Promise<{ report?: PerformanceReport; formUrl?: string; error?: string }> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // Insert row via authenticated client
    const { data: row, error: insertError } = await supabase
      .from('performance_reports')
      .insert({ user_id: user.id, venue_id: venueId, deal_id: dealId })
      .select('*, venue:venues(id, name), deal:deals(id, description, event_date)')
      .single()

    if (insertError || !row) {
      return { error: insertError?.message ?? 'Failed to create report' }
    }

    const report = row as PerformanceReport
    setReports(prev => [report, ...prev])

    const { data: perfTmpl } = await supabase
      .from('email_templates')
      .select('custom_subject, custom_intro')
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
          custom_subject: perfTmpl?.custom_subject ?? null,
          custom_intro: perfTmpl?.custom_intro ?? null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[usePerformanceReports] Email send failed:', err)
        // Return the report and formUrl even if email fails — manager can copy link manually
        return { report, formUrl, error: 'Report created but email failed to send. Use copy link.' }
      }
    } catch (e) {
      console.error('[usePerformanceReports] Email send error:', e)
      return { report, formUrl, error: 'Report created but email failed to send. Use copy link.' }
    }

    return { report, formUrl }
  }

  /**
   * Resets an existing pending report with a new token and re-sends the email.
   * Old link becomes invalid. New link is sent to the artist.
   */
  const resendReport = async (
    reportId: string,
    profile: Pick<ArtistProfile, 'artist_name' | 'artist_email' | 'from_email' | 'reply_to_email' | 'manager_name'>,
  ): Promise<{ formUrl?: string; error?: string }> => {
    const { data: { user: resendUser } } = await supabase.auth.getUser()
    if (!resendUser) return { error: 'Not authenticated' }

    // Generate a new UUID token using crypto API
    const newToken = crypto.randomUUID()

    const { data: updated, error: updateError } = await supabase
      .from('performance_reports')
      .update({ token: newToken, token_used: false, submitted: false, submitted_at: null })
      .eq('id', reportId)
      .select('*, venue:venues(id, name), deal:deals(id, description, event_date)')
      .single()

    if (updateError || !updated) {
      return { error: updateError?.message ?? 'Failed to reset report' }
    }

    const report = updated as PerformanceReport
    setReports(prev => prev.map(r => r.id === reportId ? report : r))

    const { data: perfTmpl } = await supabase
      .from('email_templates')
      .select('custom_subject, custom_intro')
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
          custom_subject: perfTmpl?.custom_subject ?? null,
          custom_intro: perfTmpl?.custom_intro ?? null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[usePerformanceReports] Resend email failed:', err)
        return { formUrl, error: 'Token reset but email failed. Use copy link.' }
      }
    } catch (e) {
      console.error('[usePerformanceReports] Resend error:', e)
      return { formUrl, error: 'Token reset but email failed. Use copy link.' }
    }

    return { formUrl }
  }

  return { reports, loading, refetch: fetchReports, createReport, resendReport }
}
