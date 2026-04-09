/** Builtin artist emails that queue like artist custom (null venue, buffer 0). Netlify must not import this via `@/`-only modules. */
export function isQueuedBuiltinArtistEmailType(emailType: string): boolean {
  return emailType === 'management_report'
    || emailType === 'retainer_reminder'
    || emailType === 'retainer_received'
    || emailType === 'performance_report_received'
    || emailType === 'gig_week_reminder'
    || emailType === 'gig_calendar_digest_weekly'
    || emailType === 'gig_reminder_24h'
    || emailType === 'gig_booked_ics'
    || emailType === 'gig_day_summary_manual'
}

/** Pending rows that should send on the next cron tick (same as artist-custom buffer). */
export function isQueueBufferZeroEmailType(emailType: string): boolean {
  return isQueuedBuiltinArtistEmailType(emailType) || emailType === 'performance_report_request'
}
