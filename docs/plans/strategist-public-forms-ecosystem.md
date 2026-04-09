# Dashboard ecosystem brief — for public forms & automation strategy

**Audience:** Strategist redesigning the 14 `EmailCapture` public forms + `ShowReportWizard`.  
**Scope:** Data the product already stores, automations that consume it, gaps, and constraints. Source of truth: `supabase/migrations/*.sql`, `src/types/database.ts`, `src/types/index.ts`, Netlify functions, and client hooks noted inline.

---

## 1. Complete data model — what the dashboard already stores

Types below mirror the app’s generated **`Database`** interface and migrations. Postgres enum names snake_case; TypeScript uses the mapped names in `src/types/index.ts`.

### `deals`

| Column | Type (app) | Description |
|--------|------------|-------------|
| `id` | `string` (uuid) | Primary key. |
| `user_id` | `string` | Owner (Supabase auth user). |
| `description` | `string` | Deal title / short label (required). |
| `venue_id` | `string \| null` | Linked venue; null = unlinked deal. |
| `event_date`           | `string \| null` (date) | Show date. **Forms:** `show_cancelled_or_postponed` can update this when `resolution === 'new_date'` and `newEventDate` provided. |
| `gross_amount`         | `number` | Contract gross / fee (numeric 10,2 in DB). |
| `commission_tier`    | `CommissionTier` | `new_doors` \| `kept_doors` \| `bigger_doors` \| `artist_network`. |
| `commission_rate`    | `number` | Snapshot rate. |
| `commission_amount`  | `number` | Earned commission on deal. |
| `artist_paid`        | `boolean` | Artist received fee. **Forms:** set `true` + `artist_paid_date` when show report says full payment (`submit-performance-report.ts`). |
| `artist_paid_date`   | `string \| null` | Date marked paid to artist. |
| `manager_paid`       | `boolean` | Manager received their commission. |
| `manager_paid_date`  | `string \| null` | |
| `payment_due_date`   | `string \| null` | Optional AP deadline (manual / workflow). **Rarely from forms.** |
| `agreement_url`      | `string \| null` | Legacy / external agreement link. |
| `agreement_generated_file_id` | `string \| null` | Canonical PDF in `generated_files`. **Not from public forms.** |
| `notes`              | `string \| null` | Appended timestamped blocks from captures, booking confirm, invoice, post-show, partial payment notes, etc. |
| `created_at` / `updated_at` | `string` | Timestamps. |

**Gap flags:** `payment_due_date`, `manager_paid*`, `agreement_*` are essentially never set by the 15 public forms. `commission_tier` / rates are not updated by forms.

### `venues`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK. |
| `user_id` | uuid | Owner. |
| `name` | text | Venue name. |
| `location` | text \| null | Address / region string. |
| `city` | text \| null | |
| `venue_type` | enum `venue_type` | `bar` \| `club` \| `festival` \| `theater` \| `lounge` \| `other`. |
| `priority` | int | 1–5 (default 3). **Not from forms.** |
| `status` | `outreach_status` / `OutreachStatus` | Full lifecycle enum (see §5). **Updated by forms:** email capture (`first_outreach`, `follow_up`, `pass_for_now`); show report (`submit-performance-report.ts` via `venueStatusForReport`). |
| `outreach_track` | `pipeline` \| `community` | Commission vs nurture semantics; affects `commission_flagged` on performance reports. **Not set by forms.** |
| `follow_up_date` | date \| null | Manual / pipeline UI. **Not from public forms.** |
| `deal_terms` | `jsonb` / `DealTerms \| null` | Optional: `event_date?`, `pay?`, `set_length?`, `load_in_time?`, `notes?`. **Not written by capture/report handlers today.** |
| `created_at` / `updated_at` | timestamptz | |

**Gap flags:** No columns for capacity, genre, demographics, response metrics, payment reliability score, production history, etc. Relationship “health” is only indirectly `status` + notes + performance report rows.

### `contacts`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK. |
| `user_id` | uuid | Owner. |
| `venue_id` | uuid | FK venues. |
| `name` | text | Required display name. |
| `role` | text \| null | |
| `email` | text \| null | Used for queued `venue_emails` recipient. |
|                  `phone` | text \| null | |
| `company` | text \| null | Merge field `{{contact_company}}`. **Not from forms.** |
| `created_at` | timestamptz | |

**Gap flags:** Public forms do not create/update contacts; `alternateEmail` on `first_outreach` only lands in `outreach_notes` text, not `contacts.email`.

### `outreach_notes`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK. |
| `user_id` | uuid | Owner. |
| `venue_id` | uuid | FK venues (required). |
| `note` | text | Free text body. |
| `category` | text \| null | Convention: `email_capture`, `call`, `email_sent`, activity types from UI, `other` (performance report summary uses **`other`**). Not an enforced enum in DB. |
| `created_at` | timestamptz | |

**Gap flags:** Heavy use as unstructured log; capture tokens tied to deals still often write to `deals.notes` instead when `deal_id` present.

### `booking_requests`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK. |
| `user_id` | uuid | Owner. |
| `venue_id` | uuid \| null | |
| `deal_id` | uuid \| null | |
| `capture_token_id` | uuid \| null | FK `email_capture_tokens`. |
| `source_kind` | text | App layer: mirrors capture kind, e.g. `rebooking_inquiry`, `payment_receipt`. |
| `rebook_interest` | text \| null | `'yes'` \| `'maybe'` \| `'no'` for `payment_receipt`; null for pure `rebooking_inquiry`. |
| `preferred_dates` | text \| null | |
| `budget_note` | text \| null | |
| `note` | text \| null | |
| `raw_payload` | jsonb | Full capture payload snapshot. |
| `created_at` / `updated_at` | timestamptz | |

**Note:** Table exists in DB; generated `database.ts` in repo may not list it—Supabase regenerate would add it.

### `tasks`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK. |
| `user_id` | uuid | Owner. **No `assignee` column—everything is owner-scoped.** |
| `title` | text | |
| `notes` | text \| null | |
| `due_date` | date \| null | |
| `completed` | boolean | |
| `completed_at` | timestamptz \| null | |
| `priority` | `task_priority` | `low` \| `medium` \| `high`. |
| `recurrence` | `task_recurrence` | `none` \| `daily` \| `weekly` \| `monthly`. |
| `venue_id` | uuid \| null | |
| `deal_id` | uuid \| null | |
| `email_type` | text \| null | When set, completing task can queue matching `venue_emails` (`queueEmailOnTaskComplete.ts`). |
| `generated_file_id` | uuid \| null | Optional attachment for agreement/invoice emails. |
| `created_at` | timestamptz | |

### `venue_emails`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK. |
| `user_id` | uuid | Owner. |
| `venue_id` | uuid \| null | |
| `deal_id` | uuid \| null | |
| `contact_id` | uuid \| null | |
| `email_type` | text | Built-in `VenueEmailType`, `ArtistEmailType`, or `custom:<uuid>`. |
| `recipient_email` | text | |
| `subject` | text | |
| `status` | `venue_email_status` | `pending` \| `sent` \| `failed`. |
| `sent_at` | timestamptz \| null | |
| `notes` | text \| null | Serialized payloads (invoice URL, capture token id, merge hints); cron reads these. |
| `created_at` | timestamptz | |

### `metrics`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | |
| `user_id` | uuid | |
| `date` | date | |
| `category` | `metric_category` | **`brand_partnership`** \| **`event_attendance`** \| **`press_mention`**. |
| `title` | text | |
| `numeric_value` | number \| null | Interpretation depends on category (e.g. attendance headcount). |
| `description` | text \| null | |
| `deal_id` | uuid \| null | Optional link. |
| `created_at` | timestamptz | |

**Forms:** Show report inserts **`event_attendance`** only when `attendance > 0` (derived from band midpoint).

### `performance_reports`

| Column | Type | Description |
|--------|------|-------------|
| Identity / linkage | | `id`, `user_id`, `venue_id`, `deal_id`, `token`, `token_used`, `created_at` |
| Submission | | `submitted`, `submitted_at`, `submitted_by` (`artist_link` \| `manager_dashboard`), `creation_source` (`task_automation` \| `artist_email` \| `manager_dashboard`) |
| Core answers | | `event_happened` (`yes`\|`no`\|`postponed`), `event_rating` 1–5, `attendance` int, `artist_paid_status`, `payment_amount`, `venue_interest`, `relationship_quality`, `notes`, `media_links` |
| Extensions | | `chase_payment_followup`, `payment_dispute`, `production_issue_level`, `production_friction_tags` (jsonb array in DB), `rebooking_timeline`, `wants_booking_call`, `wants_manager_venue_contact`, `would_play_again`, `cancellation_reason`, `referral_lead` |
| Ops | | `commission_flagged` boolean |

### `email_capture_tokens`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | |
| `user_id` | uuid | |
| `token` | uuid | Public URL segment. |
| `kind`       | text | Checked against 14 values incl. `payment_receipt` (see constraint in migration `030`). |
| `venue_id` / `deal_id` / `contact_id` | nullable FKs | |
| `venue_emails_id` | uuid \| null | Back-link when token created for queued email. |
| `expires_at` | timestamptz | |
| `consumed_at` | timestamptz \| null | Set on successful submit. |
| `response` | jsonb \| null | **Entire client `payload` object** stored wholesale. |
| `created_at` | timestamptz | |

### Other tables forms *might* touch indirectly (not form POSTs themselves)

- **`generated_files`** — PDFs for agreements/invoices; referenced by deals/tasks; not written by capture/report endpoints.
- **`templates`** — agreement/invoice templates; not form-driven.
- **`email_templates`** — per–`email_type` subject/intro/layout overrides; personalize outgoing *queued* copy, not fed by capture payload keys automatically unless you add merge logic.
- **`custom_email_templates`** — `custom:<id>` rows; optional capture kind in template metadata.
- **`task_templates` / `task_template_items`** — seed pipeline automation; not written by forms.
- **`monthly_fees` / `monthly_fee_payments`** — retainer billing; unrelated to venue forms.
- **`artist_profile`** — branding/from/reply-to; used when rendering emails and public form layout.
- **`profile_field_preset`** — arbitrary `field_key` / `value` strings per user; **no form writes today.**
- **`nav_badges`** — UI read state.

---

## 2. Automation map — what happens when data arrives

### A. Venue submits any of the 14 `EmailCapture` kinds

**Entry:** `POST /.netlify/functions/submit-email-capture` with `{ token, payload }`.

**Checks:** Token row in `email_capture_tokens` exists, unconsumed, unexpired, `kind` valid; `validatePayload(kind, payload)` **only enforces required fields per kind** (see §10)—extra keys are ignored for validation but **still saved** inside `response` jsonb.

**Updates:** `email_capture_tokens`: `consumed_at`, `response` = full payload.

**Side effects:** `applyEmailCaptureSideEffects` (`src/lib/emailCapture/submitSideEffects.ts`) — by kind:

| Kind | Branching / effects |
|------|---------------------|
| `pre_event_checkin` | If `deal_id` + note block nonempty → append `deals.notes`. Else if `venue_id` → `outreach_notes` `category: 'email_capture'`. |
| `first_outreach` | Requires `venue_id`. Sets `venues.status`: `interested`→`in_discussion`, `not_now`→`archived`, `wrong_person`→`reached_out`. Always inserts `outreach_notes` (email_capture). |
| `follow_up` | `venue_id` required for status. `interested`/`need_info`→`in_discussion`; `pass`→`closed_lost`. `outreach_notes`. |
| `show_cancelled_or_postponed` | Deal note or venue `outreach_notes`. If `resolution==='new_date'` and `newEventDate` → `deals.event_date` update. |
| `agreement_followup` / `agreement_ready` | Append deal note or outreach note; status line differs (`acknowledged` vs chosen status). |
| `booking_confirmation` / `booking_confirmed` | `deals.notes` only (aligned yes/no + corrections). **Does not change `venues.status`.** |
| `invoice_sent` | `deals.notes` only. |
| `post_show_thanks` | `deals.notes`; if `nothingPending===false` and `detail` nonempty → **`tasks` insert** “Venue follow-up: …”. |
| `pass_for_now` | `venues.status`→`archived`; `outreach_notes`. |
| `rebooking_inquiry` | Deal or venue note; if `availability` nonempty → **`booking_requests` insert** `source_kind: 'rebooking_inquiry'` + **`tasks`** “Rebook follow-up — venue responded”. |
| `payment_reminder_ack` | `deals.notes`; if `submittedPayment===true` → **task** “Verify payment (reference)” or “Verify venue payment reported”. |
| `payment_receipt` | Deal or venue note; if `rebookInterest` in `yes`,`maybe` → **`booking_requests`** (`source_kind: 'payment_receipt'`, structured fields + `raw_payload`) + **task** “Rebook follow-up” optionally suffixed with dates. |

**Emails:** None are queued directly from capture submit. Capture links are created when **pending** venue emails are prepared (`ensureQueueCaptureUrl`)—the form is the *response*, not a new email trigger.

### B. Artist submits a show report

**Entry:** `POST /.netlify/functions/submit-performance-report`.

**Guards:** Row exists, `submitted` false; otherwise returns faux success.

**Always:** `performance_reports` wide update (all answer columns + `submitted`, `submitted_at`, `production_friction_tags` normalized to known list, `submitted_by: 'artist_link'` default).

**Venue:** `venues.status` ← `venueStatusForReport`: `venueInterest==='yes'`→`rebooking`; else if played + `relationshipQuality==='poor'` + `venueInterest==='no'`→`closed_lost`; else→`post_follow_up`.

**Conditional inserts/updates:**

- **Metrics:** `event_attendance` row if `attendance > 0`.
- **Deal payment:** `artist_paid`/`artist_paid_date` if full; partial payment text appended to `deals.notes`.
- **`commission_flagged`:** pipeline venue + paid yes/partial.
- **`venueInterest==='yes'`:** `venue_emails` `rebooking_inquiry` **or** task “Find contact email…”; task “Re-engage {venue} for rebooking” due date from `timelineToReengageDays(rebookingTimeline)`.
- **`wantsBookingCall==='yes'`:** task “Schedule rebooking call — {venue}” + due +2d.
- **Played + chase yes:** task “Chase payment — {venue}” + optional `payment_reminder` email if contact email + `deal_id`.
- **Played + dispute yes:** task “Payment discrepancy — {venue}”.
- **Played + production serious:** task “Production / safety follow-up — {venue}”.
- **`wantsManagerVenueContact==='yes'`:** task “Artist asked you to contact {venue}” +3d.
- **`referralLead==='yes'`:** task “Capture referral lead — {venue}” +5d.
- **`outreach_notes`** long synthesis paragraph `category: 'other'`.
- **Artist ack:** `venue_emails` `performance_report_received` to `artist_profile.artist_email` when set.
- **`venueInterest !== 'yes'`:** task “Performance report follow-up: {venue}” due +7d if played, +3d if not.

### C. Manager submits show report from dashboard

Same handler; **`submittedBy === 'manager_dashboard'`** only changes: partial payment note wording, some clauses inside `outreach_notes` paragraph, and `performance_reports.submitted_by` column. Automation branches (tasks/emails/status) use the **same** predicate logic on body fields, not on `submittedBy`, except those text templates.

### D. `booking_requests` insert

Performed only from **`applyEmailCaptureSideEffects`** for `rebooking_inquiry` (nonempty availability) and `payment_receipt` (interest yes/maybe). **No server trigger** in repo—downstream is **dashboard visibility** (`useBookingRequests`) + tasks created alongside.

### E. Task auto-generated (non-template)

| Source | Condition | Task pattern |
|--------|-----------|--------------|
| `post_show_thanks` capture | `nothingPending===false` && `detail` | Title truncated from detail; **medium**; **due today**; optional `venue_id`/`deal_id`. |
| `rebooking_inquiry` | nonempty `availability` | “Rebook follow-up — venue responded”; medium; today. |
| `payment_reminder_ack` | `submittedPayment===true` | high; today; title uses `reference` if present. |
| `payment_receipt` | interest yes/maybe | “Rebook follow-up” ± dates; medium; today. |
| `submit-performance-report` | many (see B) | Titles/priorities/due dates **hard-coded** in function. |

**Template / manual tasks:** Completing a task with `email_type` fires `queueEmailAutomationForCompletedTask` (insert `venue_emails` pending + capture token note).

### F. `venue_email` queued

**Paths:** (1) Task completion automation, (2) manual send modal / immediate send (may `recordOutboundEmail` as `sent`), (3) cron `process-email-queue.ts` sends `pending` rows, (4) `submit-performance-report` inserts pending rows directly for rebooking inquiry / chase payment / artist ack.

**Buffer:** `artist_profile.email_queue_buffer_minutes` (5–30) for **venue-targeted** builtin templates; several **artist** types use **0** buffer (send next cron tick).

### G. Venue `status` changes

**From forms:** Email capture kinds above; show report `venueStatusForReport`.

**From UI:** Pipeline progress panel / venue detail—can set any `OutreachStatus`. On status change, **Pipeline.tsx** auto-applies **all `task_templates` whose `trigger_status` equals the new status** (`applyTemplate`), creating tasks (and optionally immediate emails via `queueImmediateEmailsForTemplate`).

**No DB trigger** documented for status—logic is app-side.

### H. Deal payment fields change

**Automated:** Show report submit sets `artist_paid` / `artist_paid_date` on full pay; appends partial note. **Capture forms** don’t flip booleans except indirectly via notes.

**Manual:** Earnings / deal editors toggle `artist_paid`, `manager_paid`, etc.

---

## 3. Venue intelligence — what the dashboard tracks over time

### Structured “intelligence” on `venues`

- **`status`** — pipeline stage (see §5).
- **`outreach_track`** — pipeline vs community (commission accounting).
- **`priority`** (1–5) — manual weighting.
- **`follow_up_date`** — next manual follow-up.
- **`venue_type`** — coarse category enum (not genre).
- **`deal_terms` jsonb** — rarely used structured snippet (`pay`, `set_length`, etc.); **not auto-filled from forms.**

There is **no** computed score column, **no** response-rate field, **no** revenue rollups on the venue row (revenue is aggregated from **`deals`** joined by `venue_id`).

### Ranking / scoring in the app

Reports page builds **`buildManagementReportData`** over **in-memory** collections: counts of venues touched, booked, in discussion, pipeline vs community splits, etc. **No** “venue leaderboard” or persisted rank. **No** native email open/click tracking—only `venue_emails.status` lifecycle.

### Auto vs manual on venue records

| Auto from forms/automation | Manual typical |
|----------------------------|----------------|
| `status` (capture + show report) | `name`, `location`, `city`, `venue_type`, `priority`, `outreach_track`, `follow_up_date`, `deal_terms` |
| Append-only narrative in notes / outreach_notes | Contact rows |

### Genre, capacity, crowd, DOW preference, seasonality, responsiveness, payment reliability, production history

- **Not** first-class columns on `venues` or `deals`.
- **Partial proxies:** `performance_reports` (rating, attendance int, payment fields, friction tags, relationship_quality, venue_interest); repeated `deals` per venue imply booking history; `artist_paid` timing could be derived in reports (not shipped as a dedicated metric).

**Without migration:** could stash extra key-value pairs in **`venues.deal_terms`** (jsonb) or **`deals.notes`** / **`outreach_notes`** (already used as catch-all). **`booking_requests.raw_payload`** and **`email_capture_tokens.response`** already hold arbitrary JSON for audit.

---

## 4. Email sequence intelligence

### `venue_emails.email_type` — built-in values (TypeScript)

**Venue-facing (`VenueEmailType`):**  
`booking_confirmation`, `payment_receipt`, `payment_reminder`, `agreement_ready`, `follow_up`, `rebooking_inquiry`, `first_outreach`, `pre_event_checkin`, `post_show_thanks`, `agreement_followup`, `invoice_sent`, `show_cancelled_or_postponed`, `pass_for_now`.

**Artist-facing (`ArtistEmailType` in same column):**  
`management_report`, `retainer_reminder`, `retainer_received`, `performance_report_request`, `performance_report_received`, `gig_week_reminder`.

**Custom:** `custom:<uuid>` referencing `custom_email_templates.id`.

**Not a queued venue template:** `payment_reminder_ack` is **capture kind only** (response to `payment_reminder` email)—it does not appear as a `VenueEmailType` for outgoing merges.

### What triggers each built-in type (high level)

| email_type | Typical trigger |
|------------|-----------------|
| `first_outreach`, `follow_up`, `agreement_ready`, `agreement_followup`, `booking_confirmation`, `pre_event_checkin`, `post_show_thanks`, `invoice_sent`, `show_cancelled_or_postponed`, `pass_for_now`, `rebooking_inquiry`, `payment_receipt` | Task template item with matching `email_type` completed → `queueEmailOnTaskComplete` OR manual queue from UI |
| `payment_reminder` | Performance report `chasePaymentFollowup==='yes'` automation OR manual |
| `rebooking_inquiry` (auto from report) | Performance report `venueInterest==='yes'` path |
| `performance_report_received` | After successful show report submit (artist inbox) |
| `performance_report_request` | **Not** inserted as pending venue row to venue—sent via `send-performance-form` to artist; logged with `recordOutboundEmail` |
| `management_report`, `retainer_*`, `gig_week_reminder` | Reports/Earnings/cron flows |

### Personalization / merge data

Queue builder loads **`venues`**, **`deals`**, **`contacts`**, agreement/invoice file resolution, and **`email_templates`** overrides. **Capture-specific merge:** capture URL is injected via `ensureQueueCaptureUrl` into email `notes` for supported builtin types. **Individual capture answers are not** auto-merged into Resend HTML unless template blocks reference standard merge keys—**they live in `email_capture_tokens.response` after submit.**

### Branching sequences on form answers

**No** declarative “if answer X then queue template Y” graph in the database. Branching is **coded**:

- `submitSideEffects` / `submit-performance-report` if-statements.
- `emailSuggestion.ts` suggests next template based on **`venue.status`** + history of sent types (UI hint only until user actions).

### New triggers (examples) — what you’d need

- **“Paid within 7 days” praise email:** compare `deals.artist_paid_date` vs `deals.event_date` or booking confirmation date; **needs scheduled job** or trigger on deal update (not in repo today).
- **“Third booking at venue” loyalty:** query count of `deals` by `venue_id`; **needs** either scheduled analytics or hook on deal insert—**no** hook today.

Data already available for future rules: `performance_reports.*`, `email_capture_tokens.response`, timestamps on `venue_emails`, `booking_requests`, `tasks`.

---

## 5. Deal & venue lifecycle — data by stage

**Correction / expansion vs strategist list:** the canonical **`OutreachStatus` values** are:

`not_contacted` → `reached_out` → `in_discussion` → `agreement_sent` → `booked` → `performed` → `post_follow_up` → `rebooking` (and terminal: `closed_won`, `closed_lost`, `rejected`, `archived`).

There is **no separate DB enum for “deal stage”**—**`deals` have no `status` column**; lifecycle is on **`venues.status`** plus deal financial flags.

### Stage-by-stage

**Outreach (`not_contacted` / `reached_out`)**  
- **Has:** venue row, contacts, optional templates applied on first transition.  
- **Automation:** task packs; first_outreach capture adjusts status to `in_discussion` / `archived` / `reached_out`.  
- **Missing in forms:** structured ICP (capacity, calendar blackouts); alternate contact only as free text note.

**Interested / in discussion (`in_discussion`)**  
- **Has:** tasks, emails, notes; follow_up capture bumps status.  
- **Missing:** explicit “stage reason” codes beyond note text.

**Agreement (`agreement_sent`)**  
- **Has:** deal row often created; agreement file/url on deal; `agreement_followup` + `agreement_ready` captures append notes only (no auto status flip from capture alone—manager usually moves status in UI).

**Booked (`booked`)**  
- **Has:** `deals` with gross, dates, commission; booking_confirmation capture → `deals.notes` only.  
- **Missing:** deposit %, cancellation policy, who holds insurance—only in notes if at all.

**Pre-event / event day**  
- **Has:** `pre_event_checkin` capture → logistics note or outreach_note; `deal_terms` could hold load-in but isn’t written by form.  
- **Missing:** structured run-of-show, tech rider file link beyond pre-event URL field landing in notes block.

**Post-show**  
- **Has:** `post_show_thanks` capture; `performance_reports`; optional `post_show_thanks` email task.  
- **Missing:** tip / merch revenue (no columns).

**Payment**  
- **Has:** `artist_paid`, `payment_due_date`, reminders, `payment_reminder_ack` capture, show report payment section.  
- **Missing:** method-level payment data on deal (enum exists only for **monthly_fee_payments**).

**Rebooking**  
- **Has:** `rebooking` status from report; `rebooking_inquiry` / `payment_receipt` captures → `booking_requests`; emails.  
- **Missing:** structured “next hold” dates beyond free text.

---

## 6. Reporting & metrics — what the product surfaces

### Surfaces

- **Reports page (`Reports.tsx`):** date range + **`buildManagementReportData`** → outreach counts, deal/commission aggregates, retainer snapshot, **manual** `metrics` categories, tasks completed, performance summary (`showsPerformed`, `rebookingLeads`, `avgRating`, `totalReportedAttendance`).
- **Metrics page (`Metrics.tsx`):** CRUD on `metrics` rows (three categories only).
- **Earnings:** deals + performance report flags + commission display.
- **Email Queue / History:** `venue_emails` + outbound notes formatting.
- **Performance Reports list:** row-level answers + provenance.
- **Pipeline / Outreach boards:** venue status, tasks, emails.

### Feed data

Aggregates read **`venues`**, **`deals`**, **`metrics`**, **`tasks`**, **`performance_reports`**, **`monthly_fees`** (+ payments join in hook).

### Example strategist questions vs data reality

| Question | Today |
|----------|--------|
| Avg days outreach → booking | **Derivable** from `venues.created_at`/`updated_at` vs first `deals.event_date` per venue **with custom query**—not a canned report. |
| Payment speed | **Partial:** `artist_paid_date` vs `event_date` exists; no dedicated widget. |
| Which venues rebook most | **Derivable:** count `deals` grouped by `venue_id`; or `venue_interest` on reports—not pre-built. |
| Day-of-week performance | **Needs** consistent `event_date` + optional attendance; no DOW chart shipped. |
| Seasonal revenue | **Derivable** from `deals.gross_amount` by month. |
| Avg deal value by `venue_type` | **Derivable** join deals↔venues. |
| Email response rate | **No** open/click tracking; only capture completion rate if you compare tokens created vs `consumed_at`. |

---

## 7. Task generation logic — auto vs manual

### Auto-create conditions (code paths enumerated above)

1. `post_show_thanks` — open items detail.  
2. `rebooking_inquiry` — availability text.  
3. `payment_reminder_ack` — payment sent yes.  
4. `payment_receipt` — rebook yes/maybe.  
5. Show report: rebooking path, booking call, chase payment, dispute, production serious, manager contact, referral, generic follow-up, find contact email.

### Fields determining title / priority / due / assignment

- **Title:** hard-coded string patterns + interpolations (`venueName`, `detail` slice, `dates`).  
- **Priority:** literal `'high'` / `'medium'` per branch.  
- **Due:** `today`, `today + 2`, `+3`, `+5`, `+reengageDays`, or `+7/+3` follow-up.  
- **Assignment:** **N/A—no assignee;** always `user_id` owner.

### Missing task types

Anything requiring **new predicates** (e.g. “deposit overdue”, “production issue minor”, “second no-show”)—schema may hold hints (`productionIssueLevel==='minor'`) but **no task** is created for minor today.

---

## 8. Underused or empty fields

- **`venues.deal_terms`** — often empty; forms don’t populate.  
- **`venues.priority` / `follow_up_date`** — manual.  
- **`deals.payment_due_date`, `manager_paid*`, `agreement_generated_file_id`** — workflow-dependent; not capture-driven.  
- **`tasks.email_type`** — null for many manual tasks.  
- **`metrics.deal_id`** — optional; often null.  
- **`booking_requests`** — only two capture kinds populate; table may be sparse.  
- **Notes blobs:** `deals.notes` and `outreach_notes.note` accumulate bracketed blocks—pattern suggests future structured columns (payment dispute boolean already exists on `performance_reports` but not historic aggregates per venue).

---

## 9. Form → dashboard gaps — high-value additions (examples)

Concrete ideas **mapping form → storage → consumer** (5–10):

1. **Structured alternate contact** on `first_outreach` / `follow_up` → write `contacts` row or `contacts.email` update + flag → better queue deliverability; feeds all email automations.  
2. **`payment_reminder_ack` → set `deals.notes` AND optional `artist_paid` suggestion** (today note only)—would unlock payment-speed reports without manual entry.  
3. **Capture expected payment date** on `invoice_sent` or new field → `deals.payment_due_date` → time-based `tasks` + reminder emails (requires small server change).  
4. **`pre_event_checkin` → populate `venues.deal_terms` json** for load-in/settlement instead of only notes → reusable merge fields in later emails.  
5. **Venue capacity / typical crowd** → new keys in capture payload → store in `venues.deal_terms` or dedicated columns (migration) → improves targeting and could drive attendance benchmarks.  
6. **Genre fit / preferred bill** on `first_outreach`** → `outreach_notes` category tagging or json → future filtering in pipeline.  
7. **`cancellation` capture → auto `venues.status`** (e.g. `post_follow_up`) today only deal note—optional status nudge would surface in boards without manual edit.  
8. **Show report “minor production” → optional low-priority task** (today no task unless serious)—feeds ops backlog.  
9. **`booking_confirmation` misaligned → spawn task** “Fix booking fields” (today user must infer from note).  
10. **Merch / bar minimum / actuals** post-show → requires **new columns** or json on `performance_reports` → margin reporting.

---

## 10. What could break — constraints

### Capture payload validation

- **`submit-email-capture`** only **validates required fields per kind**; it does **not** strip unknown keys. **Entire `payload` object** is persisted to **`email_capture_tokens.response`**.  
- **Side effects code** only **reads known keys**—new keys are safe for storage but **ignored** until `submitSideEffects` (or new automation) is extended.

### Show report payload

- Function expects typed body fields; unknown JSON keys are ignored by `JSON.parse` assignment to `SubmitBody` interface in TS—**not** stored elsewhere except columns explicitly mapped and **`outreach_notes`** narrative. Adding a new measured field **requires** `performance_reports` column (or encoding in `notes`) **and** handler update to persist it.

### Size / UX limits

- Netlify **function payload** limit (~6 MB default) — immaterial for forms.  
- **`email_capture_tokens.response` / `booking_requests.raw_payload`** are **jsonb** — practically large enough for rich forms.  
- **No** enforced max step count in UI—product constraint is UX only.

### Schema constraints needing migration

- New **top-level business facts** you want queryable in SQL (filters, reports) should be **real columns** or a documented **jsonb** shape with GIN index if you filter on keys.  
- **`performance_reports.production_friction_tags`** is **jsonb** in DB—with check normalization server-side.  
- **`venue_emails.email_type`** is **unconstrained text**—safe for new string literals if send pipeline handles them (otherwise only queue rows).  
- **`metrics.category`** is a **strict enum** in DB—new category ⇒ **migration** + TS `MetricCategory` + UI.

### Assignment / multi-user

- All automations scope to **`user_id`** of the account owner; **no per-team assignment** in schema.

---

**End of brief.** For exhaustive per-question wordings of the 15 current forms, see `docs/public-forms-question-audit.md`.
