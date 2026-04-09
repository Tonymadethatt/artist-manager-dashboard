# Calendar invites via email (`.ics` attachment)

Reference for a later implementation. This captures the approach we prototyped and validated: **recipient opens email on phone → taps the `.ics` → event imports with full fields** (tested with Google Calendar; one tap, no extra steps).

## Product goal

- Ship **real calendar events** as email attachments, not only text like “add this to your calendar.”
- **SUMMARY**, **LOCATION**, **DESCRIPTION** (including line breaks and links), and **start/end** should survive import and match what we intend on-device.

## What worked well (validation)

- `.ics` attached to a normal HTML email sent through **Resend**.
- On mobile, opening the attachment offered **Add to calendar**; after accepting, **all populated fields** appeared correctly in the calendar view.
- Requirement on the recipient side: a calendar app that handles ICS (e.g. **Google Calendar** on the phone—acceptable for our audience).

## ICS file (RFC 5545–friendly)

Build a minimal **VCALENDAR** / **VEVENT** string and attach it to the email.

| Concern | Recommendation |
|--------|------------------|
| Line endings | **CRLF** (`\r\n`) |
| Method | `METHOD:PUBLISH` on both `VCALENDAR` and `VEVENT` where applicable |
| Times | **UTC** with `Z` suffix (`DTSTART` / `DTEND` / `DTSTAMP`) to avoid first-version timezone bugs |
| UID | Stable-enough unique id (e.g. include booking id + domain) |
| TEXT fields | Escape `\`, `;`, `,`, and fold/escape **newlines** in `SUMMARY`, `LOCATION`, `DESCRIPTION` per RFC |
| Description | Rich **multi-line** `DESCRIPTION` + optional URL to confirm formatting in clients |

Keep duration and offsets explicit in UTC; revisit local-time / `TZID` only if product needs “wall clock at venue.”

## Email (Resend)

- **POST** `https://api.resend.com/emails` with HTML body + **`attachments`**.
- Attachment: **base64**-encoded file bytes (UTF-8), `filename` ending in `.ics`.
- Set **`content_type`** along the lines of:  
  `text/calendar; charset=UTF-8; method=PUBLISH`  
  (confirm field name and allowed values against [current Resend attachments docs](https://resend.com/docs) at implementation time.)
- **From** must be a **verified** Resend sender (e.g. profile `from_email`).
- **Reply-To** can follow existing transactional patterns (`reply_to` array).

## Optional server pattern (Netlify + Supabase)

Used during dev tooling; same ideas apply to production endpoints:

1. **POST** only; **`Authorization: Bearer <Supabase access_token>`**.
2. **Validate JWT**: `createClient(SUPABASE_URL, ANON_KEY).auth.getUser(jwt)` (functions need **anon** key in env, not only the service role).
3. **Load profile** (service role): e.g. `artist_profile` for **`from_email`**, **`manager_email`**, **`artist_email`** (fallback for “to”), **`artist_name`** for event title context.
4. Build ICS string → base64 → send via Resend; return JSON **`{ message }`** or clear errors (**400** for missing emails, **401** for bad session).

Rate limits and abuse: treat like any outbound email path (auth + profile gate at minimum).

## Environment / ops

- **Netlify Functions**: `SUPABASE_URL`, **`SUPABASE_ANON_KEY`** (or `VITE_SUPABASE_ANON_KEY` if shared), `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`.
- Client env vars alone do **not** populate function runtime; set keys in the Netlify UI for each context.

## Risks / follow-ups

- Some clients are picky about MIME; if a device mis-detects the attachment, adjust **`content_type`** / filename per Resend and retest **iOS Mail** and **Gmail**.
- **Apple Calendar** / Outlook should be spot-checked before claiming universal support.
- For **recurring** or **updated** events, UID + `SEQUENCE` / cancellation semantics become important—out of scope for v1 single-instance bookings.

## Relation to removed dev UI

A **developer-only** Overview FAB and Settings section previously called a **`send-dev-ics-test`** function; that code was **removed** after validation. This document is the **durable spec** to reintroduce ICS generation inside **real product flows** (e.g. booking confirmation, gig details email) without resurrecting the temporary controls.

---

*Last updated: session archival after successful mobile calendar import test.*
