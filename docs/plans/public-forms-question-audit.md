# Public forms question audit

**Last reviewed:** 2026-04-08

This document is an exhaustive maintenance reference for all fifteen public/token forms: fourteen `EmailCaptureKind` flows in `EmailCaptureForm.tsx` and the show report wizard in `ShowReportWizard.tsx`. Any change to copy, options, or payload shape in those files (or the listed Netlify handlers) should update this document in the same change.

## Index: form → sources

| Form | Primary UI source | Submit / side-effect source |
|------|-------------------|-----------------------------|
| `pre_event_checkin` | `src/pages/public/EmailCaptureForm.tsx` (`PreEventForm`) | `netlify/functions/submit-email-capture.ts` → `src/lib/emailCapture/submitSideEffects.ts` |
| `first_outreach` | `EmailCaptureForm.tsx` (`FirstOutreachForm`) | same |
| `follow_up` | `EmailCaptureForm.tsx` (`FollowUpForm`) | same |
| `show_cancelled_or_postponed` | `EmailCaptureForm.tsx` (`CancelledForm`) | same |
| `agreement_followup` | `EmailCaptureForm.tsx` (`AgreementFollowupForm`) | same |
| `agreement_ready` | `EmailCaptureForm.tsx` (`AgreementReadyForm`) | same |
| `booking_confirmation` | `EmailCaptureForm.tsx` (`BookingConfirmForm`) | same |
| `booking_confirmed` | `EmailCaptureForm.tsx` (`BookingConfirmForm`) | same |
| `invoice_sent` | `EmailCaptureForm.tsx` (`InvoiceForm`) | same |
| `post_show_thanks` | `EmailCaptureForm.tsx` (`PostShowForm`) | same |
| `pass_for_now` | `EmailCaptureForm.tsx` (`PassAckForm`) | same |
| `rebooking_inquiry` | `EmailCaptureForm.tsx` (`RebookingForm`) | same |
| `payment_reminder_ack` | `EmailCaptureForm.tsx` (`PaymentAckForm`) | same |
| `payment_receipt` | `EmailCaptureForm.tsx` (`PaymentReceiptForm`) | same |
| Show report (15th) | `src/components/performance/ShowReportWizard.tsx` | `netlify/functions/submit-performance-report.ts` |

## Persistence (short)

- **Email capture:** `POST /.netlify/functions/submit-email-capture` with `{ token, payload }`. On success, `email_capture_tokens` rows are updated with `consumed_at` and `response` (JSON payload). `applyEmailCaptureSideEffects` then mutates `deals`, `venues`, `outreach_notes`, `tasks`, and `booking_requests` as documented per kind below.
- **Show report:** `POST /.netlify/functions/submit-performance-report` updates `performance_reports` (submission flags, answers, friction tags, etc.) and runs venue status, metrics, deal payment flags/notes, tasks, `venue_emails`, and `outreach_notes` as documented in §15.
- **Dashboard visibility:** captured email responses surface in the Email Queue area labeled **Recent venue form responses** (`src/pages/EmailQueue.tsx`).

### Shell states (email capture only)

These strings are not “questions” but part of the public capture UX:

- **Loading:** layout title `Loading…`; centered spinner (`Loader2`).
- **Invalid / expired token:** full-page `This link is invalid or has expired. If you need help, reply to the email you received.`
- **Already submitted:** layout title `Thank you`; body `Your response was received` plus optional ` for {venueName}`. `You can close this page.`
- **Submit errors (client):** `Could not save. Try again.` (non-OK response); `Network error. Try again.` (fetch error).

Layout title for in-progress capture: `EMAIL_CAPTURE_KIND_FORM_TITLES[kind]` from `src/lib/emailCapture/kinds.ts`.

---

## 1. `pre_event_checkin`

**Public form title:** Pre-event details

**Ordered steps**

### Step 1 of 7

- **Exact wording:** Intro paragraph: `Share load-in, settlement, and day-of contact details — one question at a time.` Label: `Load-in / soundcheck window`
- **Control type:** Single-line text input
- **Placeholder:** `e.g. 5pm load-in, 8pm soundcheck`
- **Payload key(s):** (collected on final submit) `loadInOrSoundcheck`
- **Validation:** Server requires at least one of `loadInOrSoundcheck` or `settlementMethod` trimmed nonempty; otherwise `Add load-in or settlement details`
- **Rationale:** Captures the venue’s load-in / soundcheck window for day-of planning.
- **Ecosystem effects:** If `deal_id`: appends a block to `deals.notes` starting with ``[Venue logistics {today}]`` and lines for load-in, settlement, day-of contact, parking, rider URL when present. Else if `venue_id`: inserts `outreach_notes` with `category: 'email_capture'` and the same block.

### Step 2 of 7

- **Exact wording:** Label: `Settlement method`
- **Control type:** Single-line text input
- **Placeholder:** `Check, wire, night-of cash…`
- **Payload key(s):** `settlementMethod`
- **Validation:** Same as step 1 (pair requirement with load-in)
- **Rationale:** Records how the venue pays or settles so finance and day-of ops align.
- **Ecosystem effects:** Same note block as step 1.

### Step 3 of 7

- **Exact wording:** Label: `Day-of contact name`
- **Control type:** Single-line text input
- **Placeholder:** (none)
- **Payload key(s):** `dayOfContactName`
- **Validation:** None beyond the pair rule for load-in/settlement
- **Rationale:** Names the primary day-of contact at the venue.
- **Ecosystem effects:** Included in the logistics note line `Day-of contact: …` when any of name/phone/email exist.

### Step 4 of 7

- **Exact wording:** Label: `Day-of phone`
- **Control type:** Single-line text input
- **Placeholder:** (none)
- **Payload key(s):** `dayOfContactPhone`
- **Validation:** None beyond the pair rule
- **Rationale:** Direct phone for load-in or emergencies.
- **Ecosystem effects:** Same contact line in the note block.

### Step 5 of 7

- **Exact wording:** Label: `Day-of email`
- **Control type:** Single-line text input
- **Placeholder:** (none)
- **Payload key(s):** `dayOfContactEmail`
- **Validation:** None beyond the pair rule
- **Rationale:** Written contact for confirmations and follow-up.
- **Ecosystem effects:** Same contact line in the note block.

### Step 6 of 7

- **Exact wording:** Label: `Parking / load-in notes`
- **Control type:** Textarea (3 rows)
- **Placeholder:** (none)
- **Payload key(s):** `parkingNotes`
- **Validation:** None beyond the pair rule
- **Rationale:** Freeform constraints for parking and load-in.
- **Ecosystem effects:** Note line `Parking: …` when nonempty.

### Step 7 of 7

- **Exact wording:** Label: `Rider or tech info (link)`; primary control: **Submit** (footer); disabled until load-in or settlement nonempty (`SubmitBar` `disabled={!canSubmit}` where `canSubmit = loadInOrSoundcheck.trim() || settlementMethod.trim()`)
- **Control type:** Single-line text input in a `<form>`
- **Placeholder:** `https://…`
- **Payload key(s):** `riderOrTechUrl` plus all prior keys (trimmed strings in one submit)
- **Validation:** `Add load-in or settlement details` if both load-in and settlement empty
- **Rationale:** Link to rider or technical info completes the logistics package.
- **Ecosystem effects:** `Rider / tech link:` line when nonempty; **Submit** shows loading spinner while submitting.

**Between steps 1–6:** Footer button **Continue** (not part of a `<form>` until step 7).

---

## 2. `first_outreach`

**Public form title:** Your reply

### Step 1 of 3

- **Exact wording:** `Where should we take this?`
- **Control type:** Three full-width choice buttons (`ChoiceRow`)
- **Options (value → visible label):**
  - `interested` → `Interested — let's explore a date`
  - `not_now` → `Not for us right now`
  - `wrong_person` → `Wrong contact — point me to the right person`
- **Placeholder:** n/a
- **Payload key(s):** `intent` (set before final submit)
- **Validation:** `Choose a response` if `intent` not one of those three strings
- **Rationale:** Routes the venue into the correct pipeline status and captures intent.
- **Ecosystem effects:** Updates `venues.status` when `venue_id`: `interested` → `in_discussion`; `not_now` → `archived`; `wrong_person` → `reached_out`. Inserts `outreach_notes` with `category: 'email_capture'`, body starting ``[First outreach reply {today}]``, lines `Intent: {intent}`, optional `Note:`, optional `Alternate contact:`.

### Step 2 of 3

- **Exact wording:** Label: `Note (optional)`
- **Control type:** Textarea (3 rows)
- **Placeholder:** (none)
- **Payload key(s):** `note`
- **Validation:** (none for note)
- **Rationale:** Optional context on top of the intent choice.
- **Ecosystem effects:** Note line in `outreach_notes` as above.

### Step 3 of 3

- **Exact wording:** Label: `Alternate email (optional)`; **Submit**
- **Control type:** Single-line input in `<form>`
- **Placeholder:** (none)
- **Payload keys:** `intent`, `note`, `alternateEmail`
- **Validation:** `Choose a response` if intent missing
- **Rationale:** Captures a corrected contact when they are the wrong person or prefer another inbox.
- **Ecosystem effects:** `Alternate contact:` line in the same `outreach_notes` row.

**Step 2 footer:** **Continue** (disabled until intent selected).

---

## 3. `follow_up`

**Public form title:** Follow-up

### Step 1 of 2

- **Exact wording:** `Quick check-in`
- **Control type:** Three `ChoiceRow` buttons
- **Options:**
  - `interested` → `Still interested`
  - `need_info` → `Need more info`
  - `pass` → `Passing for now`
- **Payload key(s):** `status`
- **Validation:** `Choose a status`
- **Rationale:** Updates engagement state after a follow-up outreach.
- **Ecosystem effects:** `venues.status`: `interested` or `need_info` → `in_discussion`; `pass` → `closed_lost`. `outreach_notes` `category: 'email_capture'`, ``[Follow-up reply {today}]``, `Status: …`, optional note.

### Step 2 of 2

- **Exact wording:** Label: `Note (optional)`; **Submit**
- **Control type:** Textarea in `<form>`
- **Payload keys:** `status`, `note`
- **Validation:** `Choose a status` if status missing
- **Rationale:** Freeform detail for the manager.
- **Ecosystem effects:** As above.

---

## 4. `show_cancelled_or_postponed`

**Public form title:** Show update

### Step 1 (branching)

- **Exact wording:** `What should we know?`
- **Control type:** Four `ChoiceRow` buttons
- **Options:**
  - `new_date` → `New date`
  - `refund` → `Refund path`
  - `release` → `Mutual release`
  - `other` → `Other`
- **Payload key(s):** `resolution` (on submit)
- **Validation:** `Choose a resolution`
- **Rationale:** Classifies what happened so legal and scheduling can follow the right playbook.
- **Ecosystem effects:** Appends ``[Show schedule update {today}]`` to `deals.notes` (or `outreach_notes` if no deal) with `Resolution: …`, optional `New date:`, optional `Note:`. If `resolution === 'new_date'` and `newEventDate` nonempty, updates `deals.event_date` to that string.

### Branch A — Step 2 (only if `new_date`)

- **Exact wording:** Label: `New event date`
- **Control type:** Single-line text
- **Placeholder:** `YYYY-MM-DD`
- **Payload key(s):** `newEventDate`
- **Validation:** (server does not require date format beyond resolution enum)
- **Rationale:** Captures the rescheduled date for the deal row update.
- **Ecosystem effects:** `deals.event_date` updated when resolution is `new_date` and date nonempty.

### Final step — Branch A step 3 / Branch B step 2 (refund, release, other)

- **Exact wording:** Label: `Notes`; **Submit**
- **Control type:** Textarea
- **Placeholder:** (none)
- **Payload keys:** `resolution`, `newEventDate`, `note`
- **Validation:** `Choose a resolution`
- **Rationale:** Freeform detail for accounting, legal, or relationship handling.
- **Ecosystem effects:** Included in the schedule-update block.

**Branch A intermediate footer:** **Continue** after date field.

---

## 5. `agreement_followup`

**Public form title:** Agreement follow-up

### Step 1 of 3

- **Exact wording:** `Agreement status`
- **Control type:** Three `ChoiceRow` buttons
- **Options:**
  - `signed` → `Signed`
  - `in_review` → `In review`
  - `needs_changes` → `Needs changes`
- **Payload key(s):** `status`
- **Validation:** `Choose agreement status`
- **Rationale:** Tracks contract state for the deal file.
- **Ecosystem effects:** Appends to `deals.notes` or `outreach_notes`: ``[Agreement follow-up {today}]``, `Status:`, optional `Link:`, optional `Note:`.

### Step 2 of 3

- **Exact wording:** Label: `Note (optional)`
- **Control type:** Textarea
- **Footer:** **Continue**

### Step 3 of 3

- **Exact wording:** Label: `Document link (optional)`; **Submit**
- **Control type:** Single-line in `<form>`
- **Payload keys:** `status`, `note`, `documentUrl`
- **Validation:** `Choose agreement status`
- **Rationale:** Optional executed agreement URL for records.
- **Ecosystem effects:** `Link:` line when `documentUrl` nonempty.

---

## 6. `agreement_ready`

**Public form title:** Agreement ready

### Step 1 of 2

- **Exact wording:** Single full-width button — primary line: `I have reviewed the agreement`; secondary line: `Including the link shared by email`
- **Control type:** Button (sets internal `ack` true and advances); not a traditional “option list”
- **Payload key(s):** (on submit) `acknowledged` must be `true`
- **Validation:** `Confirm you have reviewed the agreement` if `acknowledged !== true`
- **Rationale:** Explicit acknowledgment before optional comments.
- **Ecosystem effects:** Block ``[Agreement ready {today}]`` with `Status: acknowledged`, optional `Note:` (no `documentUrl` in this form).

### Step 2 of 2

- **Exact wording:** Label: `Questions or comments (optional)`; **Submit** (disabled until acknowledgment step completed)
- **Control type:** Textarea
- **Payload keys:** `acknowledged`, `note`
- **Validation:** `Confirm you have reviewed`
- **Rationale:** Captures questions after review without blocking on text.
- **Ecosystem effects:** Note lines on `deals` or `outreach_notes` as in agreement block.

---

## 7. `booking_confirmation`

**Public form title:** Confirm booking

Same UI and payload shape as §8 (`BookingConfirmForm`). **Kind-specific title only.**

### Step 1 of 2

- **Exact wording:** `Do the details match?`
- **Options:**
  - Selecting **Details look correct** — `aligned: true`: **submits immediately** via `onSubmit({ aligned: true, corrections: '' })` with no **Submit** button and no second step.
  - **Something needs a correction** — sets `aligned` false, advances to step 2.
- **Validation:** `Confirm whether details are correct` if `aligned` is not boolean
- **Rationale:** Fast path when the booking email matches the deal; correction path when not.
- **Ecosystem effects:** `deals.notes` append ``[Booking confirmation {today}]``, `Aligned: yes` or `Aligned: no`, optional `Corrections:` when not aligned.

### Step 2 of 2 (corrections only)

- **Exact wording:** Label: `What should change?`; **Submit** (disabled when corrections empty)
- **Control type:** Textarea
- **Payload keys:** `aligned: false`, `corrections`
- **Validation:** Same boolean rule; UI requires nonempty trimmed corrections
- **Rationale:** Structured correction text for the manager to edit the deal.
- **Ecosystem effects:** `Corrections:` line in the booking note block.

---

## 8. `booking_confirmed`

**Public form title:** Booking confirmed

Identical flow, controls, validation, and side effects as §7; only the **public layout title** differs (`EMAIL_CAPTURE_KIND_FORM_TITLES.booking_confirmed`).

---

## 9. `invoice_sent`

**Public form title:** Invoice details

### Step 1 of 2

- **Exact wording:** `Invoice status`
- **Options:**
  - `Received in AP / accounting` → sets `receivedInAp: true`
  - `Not yet / issue` → sets `receivedInAp: false`
- **Payload key(s):** (final) `receivedInAp`
- **Validation:** `Select AP status`
- **Rationale:** Tells finance whether the invoice is in the payer’s system.
- **Ecosystem effects:** `deals.notes` append ``[Invoice {today}]``, `Received in AP: yes|no`, optional `Note:`.

### Step 2 of 2

- **Exact wording:** Label: `Note (optional)`; **Submit**
- **Control type:** Textarea
- **Payload keys:** `receivedInAp`, `note`
- **Validation:** `Select AP status`
- **Rationale:** Explains delays or AP issues.
- **Ecosystem effects:** As above.

---

## 10. `post_show_thanks`

**Public form title:** Post-show feedback

### Step 1 of 4 (or 5 depending on branch)

- **Exact wording:** `How was the show?` with visible red `*` and screen-reader `(required)` (not parenthesized on screen)
- **Control type:** Star row `StarRating`: five buttons with `aria-label` `1 star`, `2 stars`, `3 stars`, `4 stars`, `5 stars`; glyph ★
- **Dynamic hint line** (shown after a star is chosen): `Excellent` (5), `Great` (4), `Good` (3), `Fair` (2), `Poor` (1)
- **Payload key(s):** `rating` (integer 1–5 on submit)
- **Validation:** `Select a star rating` if not integer 1–5; `Select whether anything is pending`; if pending false path requires `detail` trimmed when `nothingPending === false` then `Describe what is pending`
- **Rationale:** Quantifies show quality for relationship and future booking decisions.
- **Ecosystem effects:** `deals.notes` ``[Post-show {today}]``, `Rating:` line with ★/☆ visualization, optional `Comments:`, `Nothing pending: yes|no`, optional `Open items:`. If `nothingPending === false` and `detail` nonempty and `user_id`: inserts `tasks` with title ``Venue follow-up: {first 80 chars of detail}…`` (ellipsis if truncated), `priority: 'medium'`, `due_date: today`, `recurrence: 'none'`, `completed: false`, optional `venue_id`, `deal_id`.

### Step 2

- **Exact wording:** Label: `Comments (optional)`
- **Control type:** Textarea
- **Placeholder:** `Anything you'd like us to know about the night...`
- **Footer:** **Continue** (disabled if `rating === 0`)
- **Payload key(s):** `comments`
- **Rationale:** Qualitative color on the numeric rating.
- **Ecosystem effects:** `Comments:` in deal note.

### Step 3

- **Exact wording:** `Anything still open?`
- **Options:**
  - `Nothing pending on our side` → sets `nothingPending` true, jumps to step 4 (confirmation form)
  - `Something is still open` → sets `nothingPending` false, goes to step 3b (detail form)
- **Payload:** `nothingPending` boolean
- **Rationale:** Triggers task creation when something still needs manager action.
- **Ecosystem effects:** See task insert when false with detail.

### Step 3b (long path only)

- **Exact wording:** Label: `What's open?` (**Submit**; disabled unless `detail` trimmed nonempty)
- **Control type:** Textarea
- **Payload key(s):** `detail`
- **Validation:** Server `Describe what is pending` when `nothingPending === false` and detail empty

### Step 4 (short path only)

- **Exact wording:** `Thanks — send your feedback?` (**Submit**; disabled unless `nothing === true` and rating set)
- **Control type:** Confirmation-only form
- **Payload:** full object `{ rating, nothingPending: true, detail: '', comments }`
- **Rationale:** Explicit confirm before submit on the happy path.
- **Ecosystem effects:** No task when nothing pending.

---

## 11. `pass_for_now`

**Public form title:** Thanks for letting us know

### Step 1 of 1

- **Exact wording:** `One tap to acknowledge — nothing else required.`; **Submit**
- **Control type:** Empty payload submit `onSubmit({})`
- **Placeholder:** n/a
- **Payload key(s):** (empty object; no keys)
- **Validation:** (none — `pass_for_now` returns null in `validatePayload`)
- **Rationale:** Closes the loop when the venue passes without forcing more fields.
- **Ecosystem effects:** `venues.status` → `archived` for `venue_id`; `outreach_notes` ``[Pass acknowledged {today}]`` with `category: 'email_capture'`.

---

## 12. `rebooking_inquiry`

**Public form title:** Rebooking

### Step 1 of 1

- **Exact wording:** Label: `Availability, preferred months, or holds`
- **Control type:** Textarea (default rows from `Field` — 3 when textarea)
- **Placeholder:** (none)
- **Payload key(s):** `availability` (trimmed)
- **Validation:** `Add availability notes` if empty after trim
- **Rationale:** Collects timing the manager can turn into holds or outreach.
- **Ecosystem effects:** If `deal_id`: append ``[Rebooking availability {today}]\n{availability}`` to `deals.notes`. Else if `venue_id`: `outreach_notes` with that block, `category: 'email_capture'`. If `availability` nonempty: `booking_requests.insert` with `source_kind: 'rebooking_inquiry'`, `note: availability`, `raw_payload: payload`, `capture_token_id`, ids; `tasks.insert` title **`Rebook follow-up — venue responded`**, `priority: 'medium'`, `due_date: today`, `recurrence: 'none'`, `completed: false`, optional `venue_id`, `deal_id`.

---

## 13. `payment_reminder_ack`

**Public form title:** Payment status

### Step 1 of 2

- **Exact wording:** `Payment status`
- **Options:**
  - `Payment has been sent` → `submittedPayment: true`
  - `Not sent yet` → `submittedPayment: false`
- **Validation:** `Select payment status`
- **Rationale:** Confirms whether the venue believes payment is out the door.
- **Ecosystem effects:** `deals.notes` ``[Payment reminder reply {today}]``, `Reports payment sent: yes|no`, optional `Reference:`. If `submittedPayment === true` and `user_id`: `tasks.insert` title **`Verify payment ({reference})`** when reference nonempty, else **`Verify venue payment reported`**; `priority: 'high'`, `due_date: today`, `recurrence: 'none'`, `completed: false`, optional `venue_id`, `deal_id`.

### Step 2 of 2

- **Exact wording:** Label: `Reference # (optional)`; **Submit**
- **Control type:** Single-line
- **Payload keys:** `submittedPayment`, `reference`
- **Validation:** `Select payment status`
- **Rationale:** Gives AP a trace ID when payment was sent.
- **Ecosystem effects:** Reference line in deal note; task title uses reference when present.

---

## 14. `payment_receipt`

**Public form title:** Payment receipt

### Step 1

- **Exact wording:** `Are you interested in booking again?`
- **Options:**
  - `yes` → `Yes — let's plan the next one`
  - `maybe` → `Maybe — open to it`
  - `no` → `Not right now` (skips to final step index 3)
- **Validation:** `Select rebooking interest`
- **Rationale:** Drives rebooking pipeline and optional `booking_requests`.
- **Ecosystem effects:** Always append ``[Payment receipt — rebook interest {today}]`` to `deals.notes` or `outreach_notes` with `Interest:`, optional `Preferred dates:`, `Budget note:`, `Note:`. If interest `yes` or `maybe`: `booking_requests.insert` `source_kind: 'payment_receipt'`, `rebook_interest`, `preferred_dates`, `budget_note`, `note`, `raw_payload`; `tasks.insert` title **`Rebook follow-up`** or **`Rebook follow-up — {dates}`** when `preferredDates` nonempty (exact concatenation in code).

### Step 2 (yes/maybe only)

- **Exact wording:** Label: `Preferred dates or months (optional)`
- **Placeholder:** `e.g. June or July 2026`
- **Footer:** **Continue**

### Step 3 (yes/maybe only)

- **Exact wording:** Label: `Rough budget or fee range (optional)`
- **Placeholder:** `e.g. same as last time, $500–$800`
- **Footer:** **Continue**

### Final step (all branches)

- **Exact wording:** Label: `Anything else to add? (optional)`; **Submit**
- **Control type:** Textarea
- **Payload keys:** `rebookInterest`, `preferredDates`, `budgetNote`, `note`
- **Validation:** `Select rebooking interest` if `rebookInterest` missing
- **Rationale:** Freeform context on top of structured rebook signals.
- **Ecosystem effects:** As in step 1.

---

## 15. Show report wizard (`ShowReportWizard`)

**Header titles**

- **Artist public link** (`submittedBy === 'artist_link'`): layout title **`Show report`**
- **Manager dashboard manual entry** (`submittedBy === 'manager_dashboard'`): **`Manual show report`**

**Other non-question shell copy**

- **Loading:** title `Loading` (no ellipsis); centered spinner.
- **Invalid token:** heading `Link no longer valid`; body `This link has expired or is no longer active. Ask your manager to send you an updated one.`
- **Success — artist:** title `Thank you`; body `Your show report has been received.`
- **Success — manager:** title `Report saved`; body `Submitted with the same automations as the artist link (tasks, venue status, notes).`; optional button `Back to Show Reports`
- **Success — preview:** title `Preview complete`; body `Nothing was saved. Pick another form in the dashboard to keep testing.`
- **Cancel control (when `onCancel` passed):** `← Cancel`

**Step model**

- **Top-level steps:** `totalSteps` is 3 when `eventHappened === 'yes'`, else 2.
- **`showEventSections`:** `true` only when `eventHappened === 'yes'` (phase 1 — rating through production/friction — runs only on that branch).

---

### Path A — Event happened (`eventHappened === 'yes'`)

After choosing **Yes, it happened** on step 0, `step` becomes `1` and **`showEventSections` is true**.

**Phase 1 — guided sub-steps (`phase1`)** — user advances one screen at a time inside step 1:

1. **Rating (`RatingField`)**  
   - Label: `How did it go overall?` suffix ` (optional)` in lighter weight.  
   - Rows (numeric buttons, value = `n`, sub-label **hint**):  
     - Row 1: `1` / `Rough`, `2` / `Okay`, `3` / `Decent`  
     - Row 2: `4` / `Great`, `5` / `Amazing`  
   - **Skip for now** control (advances to attendance without setting a numeric rating).  
   - Stored in answers as `eventRating` (`number | null`).  
   - **Server payload:** `eventRating` passed when played; can be null if skipped.

2. **Attendance (`ChipGrid`)**  
   - Label: `About how many people attended?` suffix ` (optional)` in lighter weight.  
   - Options (value → label):  
     - `under_50` → `Under 50`  
     - `50_150` → `50 – 150`  
     - `150_300` → `150 – 300`  
     - `300_500` → `300 – 500`  
     - `over_500` → `500+`  
     - `skip` → `Rather not say`  
   - Selection triggers `onPick` → advances to paid. Must tap one chip to proceed (no separate Continue).  
   - Payload: `attendance` is a number from `ATTENDANCE_BAND_TO_NUMBER` in `src/lib/performanceReportV1.ts` except `skip` maps to `0` and then omitted from metric logic server-side when not `> 0`.

3. **Payment status (`SelectField`)**  
   - Label: `Did you receive payment from the venue?` **required** (`*` + sr-only `(required)`).  
   - Options:  
     - `yes` → `Yes, full payment` → next sub-phase: **dispute** (skips partial and chase).  
     - `partial` → `Partial payment` → next: **partial** sub-phase.  
     - `no` → `Not yet / no` → next: **chase** (after partial if partial was chosen — see below).  
   - Payload: `artistPaidStatus`; when `yes`, `chasePaymentFollowup` is forced to `'no'` in the JSON body.

4. **Partial amount (only if `partial`)**  
   - Label: `About how much did you receive? ($)`  
   - Presets (`PARTIAL_PAYMENT_PRESETS` value → label):  
     - `100` → `Around $100`  
     - `250` → `Around $250`  
     - `500` → `Around $500`  
     - `1000` → `Around $1,000`  
     - `other` → `Other amount (enter below)`  
   - When `other`: number input **placeholder** `Enter amount`; attributes `min={0}` `step="0.01"` `inputMode="decimal"`.  
   - **Continue** button (full width). Inline errors before advancing:  
     - `Pick about how much you received (or Other).`  
     - `Enter the partial payment amount.` (when Other selected and amount empty)  
   - Client `validateStep` on submit path may also show:  
     - `Enter the partial payment amount (or pick a preset above).`  
     - `Pick about how much you received (or Other).`  
   - Payload: `paymentAmount` resolved from preset `amount` or parsed float from `paymentAmount` field.

5. **Chase payment (`SelectField`, only if `artistPaidStatus` is `partial` or `no`)**  
   - Label: `Should your manager help chase payment from the venue?` **required**  
   - Options:  
     - `no` → `No, I will handle it`  
     - `unsure` → `Not sure yet`  
     - `yes` → `Yes, please follow up`  
   - Payload: `chasePaymentFollowup` (or `'no'` when full payment).

6. **Payment dispute (`SelectField`)**  
   - Label: `Is the amount the venue owes still what you agreed to?` **required**  
   - Options (value vs wording note):  
     - `no` → `Yes — matches the deal`  
     - `yes` → `No — there is a disagreement`  
   - Payload: `paymentDispute`

7. **Production (`SelectField`)**  
   - Label: `Production, sound, and safety overall` **required**  
   - Options:  
     - `none` → `Smooth — no real issues` — clears friction tags and **immediately** finishes phase 1 to venue step (no friction screen).  
     - `minor` → `Minor annoyances only` → goes to **friction** sub-phase.  
     - `serious` → `Serious problem — manager should know` → goes to **friction** sub-phase.  
   - Payload: `productionIssueLevel`; `productionFrictionTags` empty when level is `none` or not played.

8. **Friction (`MultiFrictionField` + **Continue**) — only when production is `minor` or `serious`**  
   - Label: `What was a friction point?` suffix ` (tap any that apply)`  
   - Multi-select toggles; each option **id** → **visible label** (`PRODUCTION_FRICTION_OPTIONS`):  
     - `sound` → `Sound / audio`  
     - `load_in` → `Load-in & parking`  
     - `staff` → `Staff & hospitality`  
     - `stage` → `Stage & lights`  
     - `crowd` → `Crowd / room energy`  
   - **Continue** (full width) → validates phase 1 and moves `step` to `2`.

**Phase 2 — venue / notes / media (`step === 2`, `phaseVenue`)** — same sequence for Path A as for Path B below (venue_int → … → done), using **`showEventSections === true`** labels.

**Submit bar (Path A):** Shown when `step > 0`, not on the event-payment step (`step === 1` with phase1), and when **not** in the middle of venue sub-steps — i.e. when `phaseVenue === 'done'` on the last step, or appropriate per `showFooterBar` logic: back + submit appear for final confirmation. Buttons: **Back** (if `step > 0`), **Submit report** / loading **`Sending…`** with spinner.

**Client validation messages** (`validateStep`) relevant to Path A:

- Step 0: `Choose whether the event happened.`; `Pick what best describes why the show did not happen as planned.` (Path B).  
- Step 1: `Select your payment status from the venue.`; partial amount messages above; `Let your manager know if they should help chase payment.`; `Is the amount owed still correct?`; `How were production and safety overall?`  
- Step 2 (venue): see Path B list below.  
- Generic fallback when `validateStep` fails on submit: `Please finish required fields.`; when rewinding steps: `Missing answers on an earlier step.`; partial inline: `Finish this section first.`

---

### Path B — Cancelled or postponed (`eventHappened` is `no` or `postponed`)

**Step 0a — event question (`phase0 === 'event'`)**  
- **SelectField** label: `Did the event happen as planned?` **required**  
- Options:  
  - `yes` → `Yes, it happened` (this is Path A; not Path B)  
  - `no` → `No, it was cancelled` → stays on step 0, switches `phase0` to cancellation  
  - `postponed` → `It was postponed` → same as `no` (cancellation sub-flow)

**Step 0b — cancellation reason (`phase0 === 'cancellation'`)**  
- **SelectField** label: `What best describes the situation?` **required**  
- Options from `CANCELLATION_REASON_LABELS` (value → label):  
  - `venue_cancelled` → `Venue cancelled or pulled the show`  
  - `weather` → `Weather / safety`  
  - `low_turnout` → `Low turnout / ticket sales`  
  - `illness` → `Illness or emergency`  
  - `logistics` → `Travel or logistics`  
  - `other` → `Something else`  
- On select: advances to `step === 1`, **`showEventSections` false** (no rating/payment/attendance).

**Step 1 — venue block only** — `phaseVenue` starts at `venue_int`. **`showEventSections` is false** → different copy for two questions:

- **`venueInterestLabel` (false):** `Does this venue still seem interested in working with you in the future?`
- **`relationshipLabel` (false):** `Overall, how was your relationship with the venue contact (before the change of plans)?`

Remaining `phaseVenue` screens and controls **match Path A** (same option values/labels for `SelectField`s, notes, media, done). Attendance, rating, and payment **do not** appear; server stores `event_rating`, `attendance`, `artist_paid_status`, `payment_amount`, `chase_payment_followup`, `payment_dispute`, `production_issue_level`, `production_friction_tags` as null / empty when not played.

---

### Venue / notes / media / done (both paths)

**`venueInterestLabel` when `showEventSections === true`:** `Did the venue express interest in booking you again?`

**`relationshipLabel` when `showEventSections === true`:** `How was your relationship with the venue contact?`

**Venue interest (`SelectField`)** — **required**  
- Options:  
  - `yes` → `Yes`  
  - `unsure` → `Not sure yet`  
  - `no` → `No / not interested`  
- If not `yes`, clears `rebookingTimeline` and `wantsBookingCall` in state.  
- On select → `phaseVenue` → `rel`.

**Relationship (`SelectField`)** — **required**  
- Options:  
  - `good` → `Good — solid connection`  
  - `neutral` → `Neutral — professional`  
  - `poor` → `Poor — difficult`  
- Next: if `venueInterest === 'yes'` → `timeline`; else → `play` (skips timeline and booking call).

**Rebooking timeline** — only when `venueInterest === 'yes'`  
- Label: `When did they hint at booking you again?` **required**  
- Options:  
  - `this_month` → `Soon — this month`  
  - `this_quarter` → `This season / few months`  
  - `later` → `Later / no rush`  
  - `not_discussed` → `We did not really discuss timing`

**Booking call** — only when `venueInterest === 'yes'`  
- Label: `Should your manager schedule the next booking conversation?` **required**  
- Options:  
  - `yes` → `Yes — loop my manager in`  
  - `no` → `No — I'll handle it`

**Play again**  
- Label: `Would you play this venue again?` **required**  
- Options: `yes` → `Yes`; `maybe` → `Maybe`; `no` → `No`

**Manager contact**  
- Label: `Should your manager contact the venue on your behalf?` **required**  
- Options: `no` → `No`; `yes` → `Yes`

**Referral**  
- Label: `Did anyone else at the show express interest in booking you?` **required**  
- Options: `no` → `No`; `yes` → `Yes — possible referral`

**Notes phase**  
- Section label: `Quick notes for your manager` suffix ` (optional)`  
- Helper paragraph: `Tap shortcuts or add a line below — no need to type unless you want.`  
- Chip buttons (toggle multi-select) — **visible label** / stored line (`line` appended to composed notes when chip id selected):  
  - id `payment` / label `Follow up payment` / line `Follow up on payment.`  
  - id `production` / label `Production / tech` / line `Production or technical notes for the manager.`  
  - id `contract` / label `Contract / paperwork` / line `Contract or paperwork follow-up.`  
  - id `great` / label `Great night` / line `Great night — want more shows like this.`  
- Textarea **placeholder:** `Anything else (optional)...` rows `2`  
- **Continue**

**Media phase**  
- Section label: `Photos, videos, or posts from the show?`  
- Choices:  
  - `No media to share` (sets `mediaChoice` `none`, clears links, goes to `done`)  
  - `I will paste link(s) below` (sets `mediaChoice` `links`)  
- If links: textarea **placeholder** `Instagram, Drive, etc.`; **Continue**; empty-link errors:  
  - `Paste at least one link, or choose “No media”.` (curly quotes around **No media** in source)  
- `validateStep` for submit also: `Tap “No media” or add links below.` (straight quotes in source on **No media**)

**Done phase**  
- Line: `You're all set — submit your report below.`

**Submit row**  
- **Back** (when `step > 0`)  
- **Submit report** / **Sending…** (disabled when on last step but `phaseVenue !== 'done'`)

**Footer when `!preview`**  
- `submittedBy === 'manager_dashboard'`: `Same automations apply as when the artist submits the public link.`  
- Else: `One-time link. Your answers go to your manager only.`

**JSON body keys** (non-preview POST): `token`, `eventHappened`, `eventRating`, `attendance`, `artistPaidStatus`, `paymentAmount`, `venueInterest`, `relationshipQuality`, `notes` (composed from chips + extra), `mediaLinks`, `chasePaymentFollowup`, `paymentDispute`, `productionIssueLevel`, `productionFrictionTags`, `rebookingTimeline`, `wantsBookingCall`, `wantsManagerVenueContact`, `wouldPlayAgain`, `cancellationReason`, `referralLead`, `submittedBy`.

### Show report — server effects (`submit-performance-report.ts`)

Verbatim triggers and outcomes (templates use `{venueName}` as the resolved `venues.name`, default string `venue` if lookup fails):

- **Always (valid unsubmitted row):** `performance_reports` update sets `submitted: true`, `token_used: true`, `submitted_at` (ISO), `event_happened`, `event_rating` (null if not played), `attendance`, `artist_paid_status`, `payment_amount`, `venue_interest`, `relationship_quality`, `notes`, `media_links`, `chase_payment_followup`, `payment_dispute`, `production_issue_level`, `production_friction_tags` (normalized to known friction ids only), `rebooking_timeline`, `wants_booking_call`, `wants_manager_venue_contact`, `would_play_again`, `cancellation_reason` (when not played), `referral_lead`, `submitted_by` (`artist_link` default).

- **Venue status:** `venues.update` → `status` from `venueStatusForReport`: if `venueInterest === 'yes'` → `rebooking`; else if **played** and `relationshipQuality === 'poor'` and `venueInterest === 'no'` → `closed_lost`; else `post_follow_up`.

- **Metrics:** If `attendance` **truthy and** `> 0`: `metrics.insert` with `category: 'event_attendance'`, `title:` **`Event attendance: {venueName}`**, `numeric_value: attendance`, `description:` **`Reported via performance form for {venueName}`**.

- **Deal full payment:** If **played** and `artistPaidStatus === 'yes'` and `deal_id`: `deals.update` `artist_paid: true`, `artist_paid_date:` today (ISO date string).

- **Deal partial payment note:** If **played** and `artistPaidStatus === 'partial'` and `deal_id`: appends to `deals.notes` either  
  - **`{today}: Partial payment of ${paymentAmount ?? '?'} recorded by manager via performance form.`** or  
  - **`{today}: Partial payment of ${paymentAmount ?? '?'} reported by artist via performance form.`**  
  depending on `submittedBy`.

- **Commission flag:** If `venues.outreach_track` resolves to **pipeline** (non-community) and `artistPaidStatus` is `yes` or `partial`: `performance_reports.update` `commission_flagged: true`.

- **When `venueInterest === 'yes'`:**  
  - If a `contacts` row with email exists for `venue_id`: `venue_emails.insert` with `email_type: 'rebooking_inquiry'`, `subject:` **`Rebooking Inquiry - {venueName}`**, `status: 'pending'`, `notes: 'Auto-queued from performance report submission.'`  
  - Else: `tasks.insert` title **`Find contact email and send rebooking inquiry to {venueName}`**, `priority: 'high'`, `due_date: today`, `recurrence: 'none'`, `completed: false`, `venue_id` set.  
  - Additionally: `tasks.insert` title **`Re-engage {venueName} for rebooking`**, `priority: 'high'`, `due_date:` today + **reengage days** from `timelineToReengageDays(rebookingTimeline)` (7 / 21 / 45 / 3), `recurrence: 'none'`, `completed: false`, `venue_id`, optional `deal_id`.

- **When `wantsBookingCall === 'yes'`:** `tasks.insert` title **`Schedule rebooking call — {venueName}`**, `priority: 'high'`, `due_date:` today + 2 days, `recurrence: 'none'`, `completed: false`, `venue_id`, optional `deal_id`.

- **When played and `chasePaymentFollowup === 'yes'`:**  
  - `tasks.insert` title **`Chase payment — {venueName}`**, `priority: 'high'`, `due_date: today`, `recurrence: 'none'`, `completed: false`, `venue_id`, optional `deal_id`.  
  - If `deal_id` and a chase contact email exists: `venue_emails.insert` `email_type: 'payment_reminder'`, `subject:` **`Payment Reminder — {venueName}`**, `status: 'pending'`, `notes: 'Auto-queued from performance report (chase payment).'`

- **When played and `paymentDispute === 'yes'`:** `tasks.insert` title **`Payment discrepancy — {venueName}`**, `priority: 'medium'`, `due_date: today`, `recurrence: 'none'`, `completed: false`, `venue_id`, optional `deal_id`.

- **When played and `productionIssueLevel === 'serious'`:** `tasks.insert` title **`Production / safety follow-up — {venueName}`**, `priority: 'high'`, `due_date: today`, `recurrence: 'none'`, `completed: false`, `venue_id`, optional `deal_id`.

- **When `wantsManagerVenueContact === 'yes'`:** `tasks.insert` title **`Artist asked you to contact {venueName}`**, `priority: 'medium'`, `due_date:` today + 3 days, `recurrence: 'none'`, `completed: false`, `venue_id`, optional `deal_id`.

- **When `referralLead === 'yes'`:** `tasks.insert` title **`Capture referral lead — {venueName}`**, `priority: 'medium'`, `due_date:` today + 5 days, `recurrence: 'none'`, `completed: false`, `venue_id`, optional `deal_id`.

- **`outreach_notes.insert`:** `category: 'other'`, `note` a single assembled paragraph starting **`Performance report submitted ({today}).`** plus many conditional clauses (including cancellation reason label mapping matching `venue_cancelled` → `Venue cancelled`, `weather` → `Weather`, `low_turnout` → `Low turnout`, `illness` → `Illness/emergency`, `logistics` → `Logistics`, `other` → `Other`), rating/attendance/payment/friction/rebooking/relationship lines, `Friction areas:` with `formatFrictionTagsForNote`, and optionally **`Submitted by manager from dashboard (on behalf of artist).`**

- **Artist acknowledgment email:** If `artist_profile.artist_email` exists: `venue_emails.insert` `email_type: 'performance_report_received'`, `subject:` **`Got it — thanks for the update · {venueName}`**, `status: 'pending'`, `notes` from `serializeArtistTxnQueueNotes` payload.

- **When `venueInterest !== 'yes'`:** `tasks.insert` title **`Performance report follow-up: {venueName}`**, `priority: 'medium'`, `due_date:` today + **7** days when **played**, **+3** days when the event did **not** happen as planned (`eventHappened` is `no` or `postponed`), `recurrence: 'none'`, `completed: false`, `venue_id`, optional `deal_id`.

---

## Maintenance

- Any copy, option, branching, or payload field change in **`src/pages/public/EmailCaptureForm.tsx`**, **`src/components/performance/ShowReportWizard.tsx`**, **`netlify/functions/submit-email-capture.ts`**, **`src/lib/emailCapture/submitSideEffects.ts`**, **`netlify/functions/submit-performance-report.ts`**, or shared constants (e.g. **`src/lib/performanceReportV1.ts`**, **`src/lib/emailCapture/kinds.ts`**) that affects public forms should update **this file in the same change** so the audit stays authoritative.
- Secondary automation reference: the comment block at the top of **`src/lib/performanceReportV1.ts`** (answer → automation matrix for v1 performance reports).