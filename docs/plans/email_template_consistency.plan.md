---
name: Email template consistency
overview: "COMPLETE — Phase A (M1–M4) + Phase B (M5): artist transactional shell aligned with canonical header/footer, internal-only performance copy, {firstName} defaults and preview greetings."
todos:
  - id: client-cta-design
    content: "Define primary CTA HTML for venue emails (gradient pill + black text); per-template label using profile.artist_name where applicable"
    status: completed
  - id: renderVenueEmail-ctas
    content: "Inject primary body CTA in renderVenueEmail when captureUrl set; template preview must pass mock captureUrl for types with capture kinds"
    status: completed
  - id: capture-kinds-payment-receipt
    content: "payment_receipt capture: new EmailCaptureKind + migration (kind check) + kinds.ts sweep + validatePayload + EmailCaptureForm + side effects"
    status: completed
  - id: post-show-rating
    content: "Extend post_show_thanks: payload + submit validatePayload + UI + side effects + dashboard; coordinate null/consumed idempotency"
    status: completed
  - id: invoice-attachment
    content: "Invoice email: PDF attached via Resend when file exists; server-side fetch; size limits; HTML above fold"
    status: completed
  - id: booking-form-pipeline
    content: "v1: booking_requests table (RLS+MCP); list under pipeline/deals UX; owner-only; manual delete submission; hooks from captures"
    status: completed
  - id: automation-hooks
    content: "Tasks for rebook/payment-receipt/post-show only (v1); auto follow-up client emails per stakeholder mapping table; idempotency"
    status: completed
  - id: custom-template-capture
    content: "Custom venue emails: same capture as built-ins; sender picks form/type in send UI; renderCustomEmail + mint path"
    status: completed
  - id: artist-shell
    content: Align artistTransactionalEmailDocument header/footer with canonical artist shell; extend send-artist-transactional inputs
    status: completed
  - id: perf-copy
    content: Rewrite performance_report_received defaults for internal-only notes + first-name voice
    status: completed
  - id: dj-defaults
    content: Replace generic DJ in ARTIST_DEFAULT_SUBJECTS / previews with profile-driven placeholders
    status: completed
  - id: venue-audit-chrome
    content: Header/footer drift audit for venue + custom venue (minor chrome parity only)
    status: completed
  - id: verify
    content: "npx tsc -p tsconfig.app.json --noEmit; spot-check artist previews + queue test sends"
    status: completed
isProject: false
---

# Email templates and client capture ecosystem

**Handoff rule:** This markdown plan is the **single living spec** for the next implementer. **After each Q&A round, update this file** so decisions are not scattered across chat.

## Implementation status

- **Phase A (M1–M4):** **Complete** (venue capture CTAs, forms, validation/side effects, PDF invoices, `booking_requests` / automation scope per plan, custom template capture, pipeline booking UX, etc.).
- **Phase B (M5):** **Complete** — `artistTransactionalEmailDocument` uses canonical **header** (Front Office + Brand Growth) + **footer** (manager name, tagline, profile links); **performance_report_received** copy states notes are **not** auto-sent to venue; **`artistTransactionalGreetingFirstName`** + `{firstName}` in default subjects and previews (`buildArtistEmailHtml`, `EmailTemplates`, `EmailQueue`, `send-artist-transactional`).
- **Verify:** `npx tsc -p tsconfig.app.json --noEmit` passing on latest changes.

## Priority

1. **Client (venue) templates + capture + forms + dashboard/automation** — every template that should drive a response must surface a **prominent in-body primary CTA** that routes to the **public** `/email-capture/:token` flow, with payload persisted and **side effects** aligned to the pipeline.
2. **Artist transactional polish** — **done** (M5): header/footer, performance-report copy, first-name defaults.

## Stakeholder Q&A (plain English — what to build)

| Topic | What they want | Build note |
|--------|----------------|------------|
| **Form layout** | Short forms = one page; longer / heavier flows = step-by-step | Implement **hybrid:** simple kinds stay single scroll; complex kinds use a **wizard** (Next/Back). |
| **Saving half-done forms** | They're okay finishing in one go | **No draft save / resume later** for v1; keep current **one link, one submit** model. |
| **Post-show star rating / comments** | Only staff should see it, not the DJ; they **must** pick a rating | Store with capture; **5 stars, required** before submit; show in **manager dashboard only**; do **not** surface in artist-facing UI or artist reports. |
| **Invoice in email** | Send the actual PDF with the email when possible | **Primary:** Resend **PDF attachment** from server; handle "file missing" gracefully. |
| **Custom client emails + button** | Those emails should get the same style button/form as built-in ones | Wire **`captureUrl`** into custom HTML path; **mint token** on send. |
| **Which form for a custom email?** | The person sending picks | **Send UI:** when sending a custom venue email with capture on, **dropdown (or similar) to pick form type** — sets `EmailCaptureKind` on the token. |
| **After form submit — to-dos** | Auto to-dos mainly for rebook-ish paths, payment receipt replies, post-show | **v1 auto-task scope:** rebook-related captures, **payment receipt** capture, **post-show** capture; **not** "every status change." |
| **After form submit — more client emails** | Some answers should trigger the next email automatically | Build a **mapping config** (kind + answer — queue **which** venue template); stakeholder fills rows during implementation. **Guard:** don't double-send. |
| **"We want to book" data** | They want a real list in the app, not only pasted notes | **v1:** dedicated **booking requests** table + **RLS** + dashboard screen. |
| **They said "payment is sent" from a reminder** | Don't assume money is there — verify first | **`payment_reminder_ack`:** create a **bank check / reconcile** task; **do not** auto-fire **payment receipt** email from that alone (unless later they change this rule). |
| **Dead or used links** | Keep it simple | **Static "this link expired or was already used"** page; **no** "request a new link" portal in v1. |
| **Booking confirmation** | Confirm in one flow with room for notes | **Form-first** (already captured earlier). |
| **Hire / follow-up button wording** | Uses the artist's real name | Build labels from **`profile.artist_name`** (not a fixed nickname). |
| **Rebook / "book again" forms** | What must they fill in? | **Required:** when they're thinking of having you + **a short note** + **rough budget or fee**. |
| **Auto follow-up emails — timing** | Want them sent quickly | **Don't sit on the queue** without good reason; still **no double-sends**. |
| **Auto follow-up emails — clashes** | If several are waiting, what order? | **First in line goes first (FIFO)** — even if something else feels "hotter"; **revisit later** if needed. |
| **Saved answers OK, your follow-on steps failed** | Venue should not think it worked | **Show a clear error** — try again or email you. **Build-critical:** avoid marking the link "used" **before** follow-on steps finish, or offer **staff replay / one retry** so they aren't stuck. |
| **When a client submits — you get told** | How you learn about it | **In the app only** for v1 (badge, list, or similar) — **no** separate "alert email" to you unless you change this later. |
| **After submit — what they see** | Thank-you screen | **Thank-you + a brand line / logo** so it feels **finished** and professional. |
| **Bots / junk** | Worried about garbage submissions | **Secret link in the email is enough** for v1; **no** captcha required in v1. |
| **Booking requests list — who sees it** | Privacy | **Account owner / you only** (same as other private data). |
| **Booking requests list — where** | Where it lives in the app | **Near pipeline / deals** (booking world), **not** a separate top-level menu for v1. |
| **Language on public forms** | — | **English only** in v1. |
| **Auto-sent client emails — replies** | If they hit Reply | **Reply-To** should go to the **manager's** reply email (**always**), not vary per edge case in v1. |
| **How long to keep their answers** | Records | **Keep** submissions **unless you delete** them; you want the ability to **manually delete** a submission later. |

## Existing foundation (leverage, don't reinvent)

- **Token + public form:** table `email_capture_tokens` ([`028_email_capture_tokens.sql`](supabase/migrations/028_email_capture_tokens.sql)) with **CHECK constraint on `kind`** listing allowed values; owner RLS + service-role writes via [`get-email-capture.ts`](netlify/functions/get-email-capture.ts), [`submit-email-capture.ts`](netlify/functions/submit-email-capture.ts), [`EmailCaptureForm.tsx`](src/pages/public/EmailCaptureForm.tsx); route in [`App.tsx`](src/App.tsx) `/email-capture/:token`.
- **Minting on send/queue:** [`ensureQueueCaptureUrl`](src/lib/emailCapture/ensureQueueCaptureUrl.ts); `capture_url` passed into [`buildVenueEmailDocument`](src/lib/email/renderVenueEmail.ts).
- **Post-submit:** [`applyEmailCaptureSideEffects`](src/lib/emailCapture/submitSideEffects.ts); **request validation** duplicated in [`submit-email-capture.ts` `validatePayload`](netlify/functions/submit-email-capture.ts) — **every new field/kind must update both** TS union + DB CHECK + this validator + form UI.
- **Historical gaps (before Phase A):** weak in-body CTAs, `payment_receipt` capture mapping, preview `captureUrl`, custom `renderCustomEmail` capture, post-show depth, invoice PDF, booking pipeline — **treated as done for M1–M4**; treat this bullet as archive unless something regressed in code.

## Client primary CTA (visual + placement)

- **Email HTML only:** implement as inline-styled markup in [`renderVenueEmail.ts`](src/lib/email/renderVenueEmail.ts) (and any extended custom path). Do **not** reuse dashboard React tokens so venue marketing CTA does not rewrite app chrome rules.
- **Prominent in-body block** when `captureUrl` present: **yellow-orange gradient pill**, **black text**; copy per kind; **hire/follow-up style labels** use **`profile.artist_name`** (your decision).
- Footer **mailto** remains secondary.

## Per-template requirements (client)

| Template | Your requirement | Capture / form direction | Dashboard & automation (directional) |
|----------|------------------|---------------------------|----------------------------------------|
| **First outreach** | Prominent body CTA | `first_outreach`; mint + labels + body CTA | Existing — `venues.status`, `outreach_notes` |
| **Follow-up** | "Hire [artist] / interested" style | `follow_up`; dynamic label from `artist_name` | Existing follow-up side effects |
| **Booking confirmation** | **Form first:** confirm + notes together (your decision) | `booking_confirmation`; **no one-tap-only path required**; align copy/matrix with form-first | Extend tasks/triggers only when spec'd |
| **Agreement ready** | No change | — | — |
| **Pre-event check-in** | Body CTA — logistics form | `pre_event_checkin`; verify fields vs product | Deal/venue notes today |
| **Payment reminder** | Configurable confirm payment | `payment_reminder_ack`; body CTA | Side effects optional extension |
| **Payment receipt** | Rebook + booking data | **New capture `kind`** (not in DB CHECK today) mapping from venue type `payment_receipt` **or** extend CHECK + full sweep | Pipeline notes / future `booking_requests` |
| **Invoice sent** | Real invoice + pay instructions | **PDF attachment** primary (stakeholder); fallback copy if file missing + optional `invoice_sent` capture | Align with queue `invoiceUrl` / storage |
| **Post-show thanks** | Rating + feedback + rebook | Extend `post_show_thanks` payload + **validatePayload** rules + UI | Notes / optional sentiment |
| **Rebooking inquiry** | Body CTA + richer form | `rebooking_inquiry`; expand fields | Tasks/automation phased |
| **Show cancelled / postponed** | Rebook or feedback | `show_cancelled_or_postponed` | Notes/tasks |
| **Pass for now** | No change | — | — |

## Technical workstreams

### A. Email HTML ([`renderVenueEmail.ts`](src/lib/email/renderVenueEmail.ts))

- Add **primary** capture CTA block (gradient); reconcile/replace current "Quick response" so layout is not redundant.
- **Dynamic CTA text:** pass `profile.artist_name` into label helpers where applicable (separate from [`captureLinkLabel`](src/lib/emailCapture/kinds.ts) if that stays generic).

### B. Kinds, DB, validation, forms

- **Adding or renaming `EmailCaptureKind` is a multi-step change:** (1) new migration altering `email_capture_tokens_kind_check`; (2) [`kinds.ts`](src/lib/emailCapture/kinds.ts) union + `CAPTURE_KIND_SET` + `EMAIL_CAPTURE_KIND_LABELS` + `captureLinkLabel` + `venueEmailTypeToCaptureKind`; (3) [`submit-email-capture.ts`](netlify/functions/submit-email-capture.ts) `validatePayload`; (4) [`EmailCaptureForm.tsx`](src/pages/public/EmailCaptureForm.tsx); (5) [`applyEmailCaptureSideEffects`](src/lib/emailCapture/submitSideEffects.ts); (6) sync generated [`database.ts`](src/types/database.ts) types if repo expects it.

### C. Side effects ([`submitSideEffects.ts`](src/lib/emailCapture/submitSideEffects.ts))

- **Verified repo behavior (critical):** [`submit-email-capture.ts`](netlify/functions/submit-email-capture.ts) currently **writes `consumed_at` before** `applyEmailCaptureSideEffects`, and **always returns `{ ok: true }`** after a successful update even if side effects **throw** (caught + logged). That **conflicts** with stakeholder "**show a clear error** if follow-on steps fail" and strands venues on a **used link**. **v1 implementer must** reorder (e.g. side effects first with idempotency), **or** return **error** without consuming on failure, **or** add **staff replay** — until then, DoD is **not** met for that requirement.

### D. Invoice as artifact

- **Stakeholder default:** **PDF attached** to the email when the file exists. Resend attachment limits apply; fetch file **server-side** in Netlify; fallback behavior if missing file should be explicit (e.g. body copy + manager alert), not a broken button.

### E. Template preview ([`EmailTemplates.tsx`](src/pages/EmailTemplates.tsx))

- When `venueEmailTypeToCaptureKind(selectedType) != null`, pass a **non-empty placeholder** `captureUrl` (and invoice preview URL for `invoice_sent` where applicable) into `buildVenueEmailHtml` so managers see the same CTAs as sends.

### F. Custom venue emails ([`renderCustomEmail.ts`](src/lib/email/renderCustomEmail.ts))

- **Stakeholder decision:** treat like built-ins: **include capture CTA + token.** **Sender picks which form type** in the send UI when sending a custom venue email (maps to `EmailCaptureKind`). Implementer must persist that choice on the send payload / queue row so the minted token uses the right kind.

### G. Booking pipeline (net new)

- **Stakeholder decision:** **v1 includes a real table** (e.g. `booking_requests`) + **RLS** + apply via user-supabase MCP + `list_migrations` on **artist-manager-dashboard**, plus UI **near pipeline/deals**.
- **Policies:** owner **select/insert/update** as needed; include **owner `delete`** (or soft-delete) for **manual remove** of a row.

### H. Automation

- **v1 auto-task scope:** rebook-related captures, **payment receipt** capture, **post-show** capture; **not** "every status change."
- **FIFO:** verify actual drain order in [`process-email-queue.ts`](netlify/functions/process-email-queue.ts) matches FIFO intent.
- **`payment_reminder_ack` when they say payment is coming/sent:** create a **"check the bank / reconcile"** task.

### I. Artist templates (Phase B — **M5 shipped**)

- **Done:** [`artistTransactionalEmailDocument.ts`](src/lib/email/artistTransactionalEmailDocument.ts) header/footer parity + [`send-artist-transactional.ts`](netlify/functions/send-artist-transactional.ts) profile footer fields; `performance_report_received` internal-only copy; **`artistTransactionalGreetingFirstName`**; [`ARTIST_DEFAULT_SUBJECTS`](src/pages/EmailTemplates.tsx) / [`buildArtistEmailHtml.ts`](src/lib/buildArtistEmailHtml.ts) first-name previews.

## Decisions (from you)

- **Hire / follow-up CTA labels:** **dynamic** from `profile.artist_name`.
- **Booking confirmation:** **form first** (confirm + notes together).
- **Full Q&A table** above subsumes capture/automation/booking/invoice UX defaults for v1.
