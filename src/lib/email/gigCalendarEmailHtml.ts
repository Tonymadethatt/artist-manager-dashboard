function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildGigReminderHtml(args: {
  introHtml: string | null
  venueName: string
  dealDescription: string
  whenLine: string
}): string {
  const intro = args.introHtml?.trim()
    ? `<div style="margin:16px 0;color:#e5e5e5;font-size:15px;line-height:1.5">${args.introHtml}</div>`
    : ''
  return `<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a;font-family:system-ui,sans-serif;color:#fafafa;padding:24px;">
  <div style="max-width:560px;margin:0 auto;">
    <p style="font-size:15px;color:#a3a3a3;margin:0 0 8px">24-hour reminder</p>
    <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(args.dealDescription)}</h1>
    <p style="margin:0 0 4px;color:#d4d4d4">${escapeHtml(args.venueName)}</p>
    <p style="margin:0 0 16px;font-weight:600">${escapeHtml(args.whenLine)}</p>
    ${intro}
    <p style="font-size:12px;color:#737373;margin-top:24px">Sent by your management team.</p>
  </div></body></html>`
}

export function buildDigestHtml(args: {
  introHtml: string | null
  rows: { when: string; title: string; venue: string }[]
}): string {
  const intro = args.introHtml?.trim()
    ? `<div style="margin:0 0 16px;color:#e5e5e5;font-size:15px;line-height:1.5">${args.introHtml}</div>`
    : ''
  const bodyRows = args.rows.length
    ? args.rows.map(r => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #262626;color:#fafafa;vertical-align:top">${escapeHtml(r.when)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #262626;color:#fafafa">${escapeHtml(r.title)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #262626;color:#a3a3a3">${escapeHtml(r.venue)}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" style="padding:16px;color:#737373">No booked shows in this window.</td></tr>`
  return `<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a;font-family:system-ui,sans-serif;color:#fafafa;padding:24px;">
  <div style="max-width:640px;margin:0 auto;">
    <h1 style="font-size:20px;margin:0 0 8px">Upcoming gigs (2 weeks)</h1>
    <p style="color:#a3a3a3;font-size:14px;margin:0 0 16px">Pacific times</p>
    ${intro}
    <table style="width:100%;border-collapse:collapse;font-size:14px">${bodyRows}</table>
    <p style="font-size:12px;color:#737373;margin-top:24px">Sent by your management team.</p>
  </div></body></html>`
}

export function buildIcsInviteHtml(args: {
  introHtml: string | null
  dealDescription: string
  venueLine: string
}): string {
  const intro = args.introHtml?.trim()
    ? `<div style="margin:16px 0;color:#e5e5e5;font-size:15px;line-height:1.5">${args.introHtml}</div>`
    : ''
  return `<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a;font-family:system-ui,sans-serif;color:#fafafa;padding:24px;">
  <div style="max-width:560px;margin:0 auto;">
    <h1 style="font-size:20px;margin:0 0 8px">You’re booked</h1>
    <p style="margin:0 0 4px;font-weight:600">${escapeHtml(args.dealDescription)}</p>
    <p style="margin:0 0 16px;color:#a3a3a3">${escapeHtml(args.venueLine)}</p>
    <p style="margin:0 0 8px;color:#fafafa">A calendar invite (.ics) is attached — tap to add to your calendar.</p>
    ${intro}
    <p style="font-size:12px;color:#737373;margin-top:24px">Sent by your management team.</p>
  </div></body></html>`
}
