import type { CustomEmailBlocksDoc } from './customEmailBlocks'

export const FIRST_OUTREACH_LEAD_NAME = 'First Outreach'

/** Used when `lead.event_name` is empty. */
export const FIRST_OUTREACH_SUBJECT_DEFAULT = '{{profile.artist_name}} — {{lead.venue_name}}'

/** Merged for subject when `lead.event_name` is non-empty (see `CustomEmailBlocksDoc.leadSubjectIfEventName`). */
export const FIRST_OUTREACH_SUBJECT_WHEN_EVENT = '{{profile.artist_name}} — {{lead.event_name}}'

/** First Leads custom template: blocks + conditional event subject, fully editable in Email Templates. */
export function firstOutreachLeadBlocks(): CustomEmailBlocksDoc {
  return {
    version: 1,
    greeting: 'Hi {{recipient.firstName}},',
    leadSubjectIfEventName: FIRST_OUTREACH_SUBJECT_WHEN_EVENT,
    blocks: [
      {
        kind: 'prose',
        title: null,
        showIfKey: 'lead.event_name',
        body:
          '<p>Noticed {{lead.event_name}} on your calendar and wanted to reach out. The direction you\'re taking at {{lead.venue_name}} — {{lead.genre}} — is right in line with the kind of events we work with.</p>',
      },
      {
        kind: 'prose',
        title: null,
        showIfKeyEmpty: 'lead.event_name',
        body:
          '<p>Came across {{lead.venue_name}} through @{{lead.instagram_handle}} and wanted to reach out. The {{lead.genre}} direction you\'re running is right in line with the kind of events we work with.</p>',
      },
      {
        kind: 'prose',
        title: null,
        body:
          "<p>He's been on LA radio long enough that your crowd probably knows his name already — <strong>Power 106, Cali 93.9, KDay 93.5</strong>. Currently on air <strong>every night at 8pm</strong> on Cali 93.9.</p>",
      },
      {
        kind: 'prose',
        title: null,
        showIfKey: 'lead.resident_dj',
        body:
          "<p>We noticed {{lead.resident_dj}} is part of your rotation. The crowd you've built around nights like that would respond well to having {{profile.artist_name}} headline one of them.</p>",
      },
      {
        kind: 'prose',
        title: null,
        body:
          "<p>{{profile.artist_name}} is an LA native, <strong>DJing since 2002</strong>. He's shared stages with <strong>Pitbull, Kendrick Lamar, and Jennifer Lopez</strong>. He gets on the mic, works the room, and keeps people there longer than they planned to stay — which is good for your bar.</p>",
      },
      {
        kind: 'prose',
        title: null,
        body: '<p>Everything you need is right here —</p>',
      },
      { kind: 'lead_cta_pills' },
      {
        kind: 'prose',
        title: null,
        body: "<p>We're based in LA and work throughout California.</p>",
      },
      {
        kind: 'prose',
        title: null,
        body: '<p>If you have a date coming up, open to a call if it makes sense.</p>',
      },
    ],
  }
}
