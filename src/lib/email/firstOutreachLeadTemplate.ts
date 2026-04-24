import type { CustomEmailBlocksDoc } from './customEmailBlocks'

/**
 * Hrefs for the lead CTA row (Website, Press kit, Instagram).
 * `profile.website` / `profile.social_handle` override website and Instagram when set in Settings;
 * press kit uses this Drive link when no `press_kit_url` exists on the profile.
 */
export const DEFAULT_LEAD_CTA_PILL_HREFS = {
  website: 'https://djluijay.com/',
  instagram: 'https://www.instagram.com/djluijay/',
  pressKit: 'https://drive.google.com/drive/folders/1a70eWFJ0uC67J0wWQWADNvJBylHFKuFB?usp=sharing',
} as const

export const FIRST_OUTREACH_LEAD_NAME = 'First Outreach'

/** Used when `lead.event_name` is empty. */
export const FIRST_OUTREACH_SUBJECT_DEFAULT = '{{profile.artist_name}} — {{lead.venue_name}}'

/** Merged for subject when `lead.event_name` is non-empty (see `CustomEmailBlocksDoc.leadSubjectIfEventName`). */
export const FIRST_OUTREACH_SUBJECT_WHEN_EVENT = '{{profile.artist_name}} — {{lead.event_name}}'

/**
 * Whether to skip the “Reply by email” mailto block for this lead template document.
 * Explicit `hideReplyMailto` wins; for rows saved before that flag exists, we match the default
 * `leadSubjectIfEventName` used by First Outreach.
 */
export function leadCustomDocOmitReplyMailto(
  doc: Pick<CustomEmailBlocksDoc, 'hideReplyMailto' | 'leadSubjectIfEventName'>,
): boolean {
  if (doc.hideReplyMailto === true) return true
  if (doc.hideReplyMailto === false) return false
  return doc.leadSubjectIfEventName?.trim() === FIRST_OUTREACH_SUBJECT_WHEN_EVENT
}

/** First Leads custom template: blocks + conditional event subject, fully editable in Email Templates. */
export function firstOutreachLeadBlocks(): CustomEmailBlocksDoc {
  return {
    version: 1,
    greeting: 'Hi {{recipient.firstName}},',
    leadSubjectIfEventName: FIRST_OUTREACH_SUBJECT_WHEN_EVENT,
    /** No prefilled “Reply by email” mailto; no Website / Press / Instagram pill row in default copy. */
    hideReplyMailto: true,
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
