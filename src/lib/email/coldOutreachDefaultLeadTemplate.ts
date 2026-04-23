import type { CustomEmailBlocksDoc } from '@/lib/email/customEmailBlocks'

/** Canonical first-run cold outreach structure for Lead Intake (editable in Email Templates). */
export const COLD_OUTREACH_DEFAULT_SUBJECT = 'Quick intro — {{lead.venue_name}} · {{profile.artist_name}}'

export function coldOutreachDefaultLeadBlocks(): CustomEmailBlocksDoc {
  return {
    version: 1,
    greeting: 'Hi {{recipient.firstName}},',
    blocks: [
      {
        kind: 'prose',
        title: null,
        body:
          '<p>I’m {{profile.artist_name}} — I came across {{lead.venue_name}} in {{lead.city}} and wanted to reach out personally. We play <strong>{{lead.genre}}</strong> and love rooms that fit {{lead.crowd_type}}.</p>',
      },
      {
        kind: 'prose',
        title: null,
        body: '<p>If you’re booking {{lead.event_name}}, I’d love to share availability and a sample of our live set.</p>',
        showIfKey: 'lead.event_name',
      },
      { kind: 'lead_cta_pills' },
      {
        kind: 'prose',
        title: null,
        body: '<p>{{lead.research_notes}}</p>',
        showIfKey: 'lead.research_notes',
      },
    ],
  }
}
