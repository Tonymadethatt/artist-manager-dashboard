# Template master checklist

Use this file to **systematically customize every template** the app can send or attach—without ping-ponging between screens. Check items off as you go.

**Source of truth in code** (if the product adds a new type, these files update first):

- Email type unions + labels: `src/types/index.ts` (`VenueEmailType`, `ArtistEmailType`)
- Default & backfill **task template packs** (names, trigger status, items, `email_type`): `src/hooks/useTaskTemplates.ts`
- Where task completion queues mail: `src/lib/queueEmailOnTaskComplete.ts`
- Document template JSON spec: `docs/reference/document-template-v1-import-spec.md`

**Where you edit in the app**

- **Venue + built-in artist copy:** Settings area → **Email templates** (per email type: subject, intro, layout blocks; plus **custom** venue/artist templates).
- **Task sequences:** **Tasks** → **Templates** (`/pipeline/templates`) — packs keyed by venue **Outreach status**.
- **PDFs / merge documents:** **Documents** (`/templates`) — agreement & invoice patterns; generated files can be linked on **deals** or **task template items** (`generated_file_id`).

---

## How to work efficiently (recommended order)

Work **one audience at a time**, then wire **tasks** so you are not re-opening the same email type five times.

1. **Venue (client) built-in emails** — For each row in §2, open **Email templates**, customize copy, send yourself a **test** from the same screen if available. Do **payment / agreement / invoice** types in a batch so tone stays consistent.
2. **Artist built-in emails** — Same for §3; calendar-related types (gig booked, 24h reminder, weekly digest) share “ops” tone—do them back-to-back.
3. **Custom email templates** — Add any **new** types you need (§5), then add **task items** that reference them (`email_type` = custom id in the picker).
4. **Task templates by status** — In **Templates**, walk **Outreach statuses** in pipeline order (§4). For each pack: rename tasks to your language, adjust offsets, and ensure every item that should send mail points at the **email type** you already polished in steps 1–3.
5. **Document templates** — For each **agreement** and **invoice** you actually use, finalize the JSON in **Documents**, generate a real PDF, attach to a test deal, and confirm **agreement_ready** / **invoice_sent** / task attachment behavior.

---

## 2. Venue (client) email types — customize in Email templates

Every **builtin** key below has a row in `email_templates` (or will on first send). Customize **subject**, **intro**, optional **layout**, and **footer** so they match your voice.

| ID (`email_type`) | UI label | Typical use | Task automation hint |
|-------------------|----------|-------------|----------------------|
| `first_outreach` | First outreach | Cold / first touch | Default pack: *New venue outreach* |
| `follow_up` | Follow-Up | Soft ping | Often manual or custom task |
| `agreement_ready` | Agreement Ready | Send agreement PDF/link | After doc exists on deal |
| `agreement_followup` | Agreement follow-up | Signature nudge | Default pack: *Agreement sent* |
| `booking_confirmation` | Booking Confirmation | Confirmed date/fee | Default pack: *Booked venue* |
| `pre_event_checkin` | Pre-event check-in | Logistics before show | Default pack: *Booked venue* |
| `post_show_thanks` | Post-show thank-you | Thanks after show | *Post-Performance Pack* |
| `rebooking_inquiry` | Rebooking Inquiry | Ask for next date | Default pack: *Rebooking push* |
| `payment_reminder` | Payment Reminder | Balance due | Add to task packs if you use |
| `payment_receipt` | Payment Receipt | Paid / thank you | Often after payment logged |
| `invoice_sent` | Invoice sent | Billing / PDF | Pair with **generated file** on task or deal |
| `show_cancelled_or_postponed` | Show cancelled or postponed | Date change / cancel | Add tasks for your SOP |
| `pass_for_now` | Pass for now (close) | Polite close | Good for *closed_lost* / *rejected* packs |

**Checkbox track (venue builtins):**

- [ ] `first_outreach`
- [ ] `follow_up`
- [ ] `agreement_ready`
- [ ] `agreement_followup`
- [ ] `booking_confirmation`
- [ ] `pre_event_checkin`
- [ ] `post_show_thanks`
- [ ] `rebooking_inquiry`
- [ ] `payment_reminder`
- [ ] `payment_receipt`
- [ ] `invoice_sent`
- [ ] `show_cancelled_or_postponed`
- [ ] `pass_for_now`

---

## 3. Artist email types — customize in Email templates

| ID (`email_type`) | UI label | When it fires |
|-------------------|----------|----------------|
| `management_report` | Management Report | Task-driven / reporting workflows |
| `retainer_reminder` | Retainer Reminder | Task-driven |
| `retainer_received` | Retainer payment received | Task-driven |
| `performance_report_request` | Performance Report Request | *Post-Performance Pack* (and related UI) |
| `performance_report_received` | Performance report received | After artist submits report |
| `gig_calendar_digest_weekly` | Weekly gig digest | Scheduled calendar email |
| `gig_reminder_24h` | Gig reminder — 24h | Calendar automation |
| `gig_booked_ics` | Gig booked — confirmation (calendar) | When gig hits calendar workflow |
| `gig_day_summary_manual` | Gig schedule — day summary | Manual / queue from calendar |

**Checkbox track (artist builtins):**

- [ ] `management_report`
- [ ] `retainer_reminder`
- [ ] `retainer_received`
- [ ] `performance_report_request`
- [ ] `performance_report_received`
- [ ] `gig_calendar_digest_weekly`
- [ ] `gig_reminder_24h`
- [ ] `gig_booked_ics`
- [ ] `gig_day_summary_manual`

---

## 4. Task templates ↔ outreach status ↔ emails

Venue **outreach statuses** (order):  
`not_contacted` → `reached_out` → `in_discussion` → `agreement_sent` → `booked` → `performed` → `post_follow_up` → `rebooking` → `closed_won` | `closed_lost` | `rejected` | `archived`

### 4.1 Packs the app seeds for you (verify / rename in UI)

| Trigger status | Default pack name (in code) | Task items that queue **venue** email (`email_type`) |
|----------------|----------------------------|------------------------------------------------------|
| `not_contacted` | Before first outreach | *(none — prep only)* |
| `reached_out` | New venue outreach | `first_outreach`, `agreement_ready` |
| `in_discussion` | In discussion — contract path | `agreement_ready` |
| `agreement_sent` | Agreement sent — close the loop | `agreement_followup` |
| `booked` | Booked venue | `booking_confirmation`, `pre_event_checkin` |
| `performed` | Post-Performance Pack | `performance_report_request` (**artist**), `post_show_thanks` (**venue**) |
| `post_follow_up` | Post follow-up housekeeping | *(none in seed)* |
| `rebooking` | Rebooking push | `rebooking_inquiry` |

**Your checklist:** For each row, open the pack in **Templates** and confirm titles, offsets, priorities, and email bindings match your SOP.

- [ ] `not_contacted` — *Before first outreach*
- [ ] `reached_out` — *New venue outreach*
- [ ] `in_discussion` — *In discussion — contract path*
- [ ] `agreement_sent` — *Agreement sent — close the loop*
- [ ] `booked` — *Booked venue*
- [ ] `performed` — *Post-Performance Pack*
- [ ] `post_follow_up` — *Post follow-up housekeeping*
- [ ] `rebooking` — *Rebooking push*

### 4.2 Statuses with **no** seeded pack (create tasks + emails deliberately)

These are **gaps** in the default library—add **Templates** packs when you want automation:

| Status | Suggested focus | Email types to consider |
|--------|-----------------|-------------------------|
| `closed_won` | Internal win log / thank-you / referral | `post_show_thanks` (if not already), custom “welcome back” |
| `closed_lost` | Polite close, door open | `pass_for_now`, `follow_up` (long horizon) |
| `rejected` | Short, professional close | `pass_for_now` |
| `archived` | No send — housekeeping only | *(optional: none)* |

- [ ] `closed_won` — *create pack: …*
- [ ] `closed_lost` — *create pack: …*
- [ ] `rejected` — *create pack: …*
- [ ] `archived` — *create pack (optional): …*

### 4.3 Task item → document (PDF) pairing

When a task should send a **specific** generated PDF (not only the deal’s default agreement):

- Set **Generated file** on the **task template item** (or on the task when ad hoc).  
- Relevant venue emails: especially `agreement_ready`, `invoice_sent`, and **custom** templates with attachments.

**Checkbox:**

- [ ] Agreement PDF template(s) finalized in **Documents** and linked on deals or task items
- [ ] Invoice PDF template(s) finalized and wired for `invoice_sent` tasks

---

## 5. Custom email templates (not in the builtin lists)

Created under **Email templates** → **New custom template**. Each becomes an **`email_type`** string (custom id) usable on **task template items**.

**Ideas to add (fill in your own):**

- [ ] *Custom venue:* _________________________________
- [ ] *Custom venue:* _________________________________
- [ ] *Custom artist:* _________________________________
- [ ] *Custom artist:* _________________________________

After creating each: add or adjust a **task** that references it so it actually ships in workflow.

---

## 6. Document templates (agreement / invoice)

| Kind | Where | Linked from |
|------|--------|-------------|
| Agreement pattern | **Documents** | Deal `agreement` / `agreement_generated_file_id`; tasks with `generated_file_id` |
| Invoice pattern | **Documents** | Tasks + `invoice_sent` email flow |

- [ ] Agreement v1 — name: ________________
- [ ] Invoice v1 — name: ________________
- [ ] Any secondary variants (riders, hold harmless, etc.)

---

## 7. Quick association map (what to edit together)

| You touch… | Also touch… |
|------------|-------------|
| Task item with `email_type: first_outreach` | Email template `first_outreach` |
| Task item with `email_type: agreement_ready` | Email `agreement_ready` + agreement **PDF** on deal/item |
| Task item with `email_type: performance_report_request` | Email `performance_report_request` (artist) |
| Task item with `email_type: post_show_thanks` | Email `post_show_thanks` |
| Calendar / gig lifecycle | Emails `gig_booked_ics`, `gig_reminder_24h`, `gig_calendar_digest_weekly`, `gig_day_summary_manual` |
| Retainer / management reporting tasks | `management_report`, `retainer_reminder`, `retainer_received` |

---

## 8. Revision log (optional)

| Date | What changed |
|------|----------------|
| | |

---

*Generated for the Artist Manager dashboard codebase. Update §2–3 when new `VenueEmailType` / `ArtistEmailType` values are added in `src/types/index.ts`.*
