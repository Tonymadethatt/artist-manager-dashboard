# Form Redesign v3 — New Questions & Data Capture
### For: Tony Carrasco / Front Office Dashboard
### Date: April 9, 2026

---

## How to Read This Document

Each new question specifies:
- **Form it lives on** and where in the step flow it goes
- **What the user sees** (label, options, placeholder)
- **Payload key** — what the frontend sends
- **Where it lands** — which table/column stores it
- **What it feeds** — which automation, report, or email benefits
- **Friction cost** — how much effort it asks of the user (tap / short text / skip-safe)
- **Server change needed** — whether the backend needs updating or if it passes through to existing jsonb

The golden rule: if a new question doesn't feed at least one automation, report, or future email — it doesn't belong here.

---

## 1. `first_outreach` — 3 new questions

### NEW: Preferred contact method (after Step 1 intent, before Note)
- **Label:** `What's the best way to reach you going forward?`
- **Options:** `Email` · `Phone / text` · `Either works`
- **Payload key:** `preferredContactMethod`
- **Lands:** `email_capture_tokens.response` (jsonb, no migration). Side effect should also write to `outreach_notes` as a tagged line: `Preferred contact: {value}`.
- **Feeds:** Every future email and call decision. If they say "phone," your outreach templates can reference it. Prevents sending 4 emails to someone who told you on day one they prefer a call.
- **Friction:** One tap. Zero typing.
- **Server change:** Add one line to `submitSideEffects` to include in the note block. No migration.

### NEW: How did you hear about us? (after Note, before Alternate Email)
- **Label:** `How'd you first hear about the artist? (optional)`
- **Options:** `Instagram` · `Referral` · `Saw them perform` · `Radio` · `Other`
- **Payload key:** `referralSource`
- **Lands:** `email_capture_tokens.response` jsonb. Side effect: `outreach_notes` line `Source: {value}`.
- **Feeds:** Attribution reporting. Over time you can answer "where do my best leads come from?" by cross-referencing `referralSource` on tokens that eventually became `deals`. Also helps Luijay know which channels are working.
- **Friction:** One tap. Optional. Skip-safe.
- **Server change:** One line in note block. No migration.

### NEW: Structured alternate contact (replaces current freeform on Step 3)
- **Label:** Keep existing: `If there's a better person to reach, drop their email here`
- **NEW addition below it:** Second field — `Their name (optional)` (single-line text, placeholder: `First and last`)
- **Payload keys:** `alternateEmail` (existing), `alternateContactName` (new)
- **Lands:** When both `alternateEmail` and `alternateContactName` are provided, side effect should **insert a `contacts` row** with `email` and `name` on the `venue_id` — not just dump it into notes text. This is the #1 gap flagged in the ecosystem brief.
- **Feeds:** Every future email automation. Right now alternate contacts vanish into a notes blob. With a real `contacts` row, the email queue can actually send to this person.
- **Friction:** One optional text field (they're already on this step).
- **Server change:** `submitSideEffects` needs a `contacts` upsert when both fields present + `venue_id`. Small but real change.

---

## 2. `follow_up` — 2 new questions

### NEW: What would make this work? (only when status = `need_info`)
- **Label:** `What info would help you decide?`
- **Options:** `Pricing / rate card` · `Song list or demo` · `Availability for specific dates` · `References from other venues` · `Something else`
- **Payload key:** `infoNeeded`
- **Lands:** `email_capture_tokens.response` jsonb. Side effect: `outreach_notes` line `Info requested: {value}`. If value is `pricing`, auto-generate a **task**: `Send rate card to {venueName}`, priority medium, due today.
- **Feeds:** Removes guesswork from follow-up. Instead of "they need more info" (about what?), you know exactly what to send. Task auto-creation means it doesn't fall through the cracks.
- **Friction:** One tap. Only appears on the `need_info` branch — people who chose "still interested" or "pass" never see it.
- **Server change:** Conditional task insert in `submitSideEffects`. No migration.

### NEW: When should we check back? (only when status = `pass`)
- **Label:** `Would it help if we checked back later?`
- **Options:** `Sure — try me in a few months` · `Maybe next year` · `Please don't follow up`
- **Payload key:** `recontactPreference`
- **Lands:** `email_capture_tokens.response` jsonb. Side effect: `outreach_notes` line. If `few_months` → set `venues.follow_up_date` to today + 90 days. If `next_year` → today + 365. If `no_follow_up` → leave `archived` status and add note.
- **Feeds:** Populates the currently-empty `venues.follow_up_date` field. This is a dead column right now — this question brings it to life. Your pipeline board can now surface "venues that asked us to come back later" at the right time.
- **Friction:** One tap. Only on the "pass" branch.
- **Server change:** `venues.follow_up_date` update in side effects. No migration (column exists).

---

## 3. `pre_event_checkin` — 3 new questions

### NEW: Estimated capacity (new Step 2, after load-in)
- **Label:** `Roughly how many people does the space hold?`
- **Options:** `Under 100` · `100–300` · `300–500` · `500+` · `Not sure`
- **Payload key:** `venueCapacity`
- **Lands:** `venues.deal_terms` jsonb (key: `capacity`). This field exists but is almost never populated — this fills it.
- **Feeds:** Attendance benchmarking. When the show report comes back with "150–300 attended" and you know capacity is 500, you can calculate fill rate. Over time: "which venues consistently sell out vs. which run half-empty?" Also useful for pitch decks to future sponsors.
- **Friction:** One tap. Sandwiched between existing logistics questions — feels natural.
- **Server change:** `submitSideEffects` writes to `venues.deal_terms` jsonb merge. No migration.

### NEW: What's the vibe/genre? (new Step 3, after capacity)
- **Label:** `What kind of music or vibe is the crowd into?`
- **Options (multi-select):** `Hip-Hop / R&B` · `Latin / Reggaeton` · `EDM / Dance` · `Top 40 / Open Format` · `Other`
- **Payload key:** `genrePreference` (array)
- **Lands:** `venues.deal_terms` jsonb (key: `genre`). Also `outreach_notes` line.
- **Feeds:** Artist prep (Luijay can tailor his set), future venue filtering ("show me all Latin venues"), and sponsor targeting (a tequila brand wants Latin-skewing venues).
- **Friction:** Multi-tap. Optional — "Other" or skip is fine.
- **Server change:** jsonb merge on `deal_terms`. No migration.

### NEW: Will there be a photographer/videographer? (new Step 7, after parking, before rider link)
- **Label:** `Will there be a photographer or videographer at the event?`
- **Options:** `Yes — venue is providing one` · `No — artist should bring their own` · `Not sure yet`
- **Payload key:** `mediaOnSite`
- **Lands:** `email_capture_tokens.response` jsonb. `outreach_notes` line.
- **Feeds:** Content strategy. If the venue has a photographer, Luijay doesn't need to hire one. If they don't, you can flag it as a task: `Arrange content capture for {venueName} on {eventDate}`. Also feeds the show report — if they said "yes, venue provides" but the artist reports no media, that's a gap worth noting.
- **Friction:** One tap.
- **Server change:** Optional task insert if "no." No migration.

---

## 4. `booking_confirmation` / `booking_confirmed` — 2 new questions

### NEW: How would you like to handle the deposit? (after alignment confirmation, before corrections)
- **Label:** `Is there a deposit or payment schedule to note?`
- **Options:** `Full payment after the show` · `Deposit up front, balance night-of` · `Venue pays in advance` · `We'll sort it out separately`
- **Payload key:** `paymentStructure`
- **Lands:** `deals.notes` block (appended to existing booking confirmation note). Also `email_capture_tokens.response` jsonb.
- **Feeds:** Payment expectation tracking. When the `payment_reminder` email goes out later, you already know whether they agreed to deposit + balance or full-after. Prevents awkward "where's our money" emails when the deal was always net-30.
- **Friction:** One tap. Feels natural at booking confirmation — this is when payment terms get locked.
- **Server change:** One line in notes block. No migration.

### NEW: Anything the artist should know about the crowd or event? (final step addition)
- **Label:** `Any details about the event or crowd that would help the artist prepare? (optional)`
- **Placeholder:** `e.g. It's a corporate holiday party, 21+ Latin night, college crowd…`
- **Payload key:** `eventContext`
- **Lands:** `deals.notes` + `email_capture_tokens.response`.
- **Feeds:** Artist prep and set planning. Also enriches the venue profile over time — if every booking at this venue says "Latin night," that's intelligence. Can feed into `venues.deal_terms` jsonb under `typical_event_type`.
- **Friction:** Optional text. Skip-safe.
- **Server change:** Note block addition. No migration.

---

## 5. `invoice_sent` — 2 new questions

### NEW: When should we expect payment? (after AP status, before Note)
- **Label:** `When do you expect payment to go out?`
- **Options:** `Within a week` · `Net 15` · `Net 30` · `Not sure yet`
- **Payload key:** `expectedPaymentTimeline`
- **Lands:** Side effect writes to `deals.payment_due_date`: within a week → today + 7, net 15 → today + 15, net 30 → today + 30, not sure → null. Also `email_capture_tokens.response`.
- **Feeds:** Populates the currently-dead `deals.payment_due_date` column. This enables time-based payment reminder automations that don't exist yet. Instead of manually remembering to chase, the system can auto-queue `payment_reminder` emails when `payment_due_date` passes.
- **Friction:** One tap. Natural follow-up to "is it in AP?"
- **Server change:** `deals.payment_due_date` update in side effects. No migration (column exists).

### NEW: Purchase order or reference number (replace current "Reference # (optional)" with better framing)
- **Label:** `PO number, invoice reference, or AP ticket? (optional)`
- **Placeholder:** `Helps us match payment when it arrives`
- **Payload key:** `poReference` (in addition to keeping existing flow)
- **Lands:** `deals.notes` line + `email_capture_tokens.response`.
- **Feeds:** Payment reconciliation. When money hits and there's no context, this reference closes the loop.
- **Friction:** Optional text. Already on this form — just better framed.
- **Server change:** Note block line. No migration.

---

## 6. `post_show_thanks` — 3 new questions

### NEW: Would you book this artist again? (after star rating, before comments)
- **Label:** `Would you book this artist again?`
- **Options:** `Absolutely` · `Probably` · `Not likely`
- **Payload key:** `wouldRebook`
- **Lands:** `email_capture_tokens.response` jsonb. `outreach_notes` line with category tagging.
- **Feeds:** The venue's version of the artist's "would you play there again?" Creates a two-sided picture. If artist says "for sure" and venue says "not likely," that's critical intel. If both say yes, that's a warm rebooking lead. Can trigger different follow-up paths: `absolutely` → fast-track rebooking email; `not likely` → manager review task.
- **Friction:** One tap.
- **Server change:** Conditional task/email logic. No migration.

### NEW: How was the turnout? (after star rating)
- **Label:** `How was the turnout?`
- **Options:** `Packed` · `Solid` · `Light` · `Slow night`
- **Payload key:** `venueTurnoutAssessment`
- **Lands:** `email_capture_tokens.response` + `outreach_notes`.
- **Feeds:** Cross-reference with artist's attendance estimate from show report. Venue says "packed" + artist says "150–300" at a 500-cap room = different story than venue says "packed" at a 100-cap room. Builds attendance reliability data over time.
- **Friction:** One tap.
- **Server change:** Note line. No migration.

### NEW: Anything your team noticed about the performance? (replaces/enhances current Comments)
- **Label:** `Anything your team noticed — energy, crowd response, production? (optional)`
- **Placeholder:** `Good or bad — honest feedback helps us improve`
- **Payload key:** Keep existing `comments` key — just better framing.
- **Lands:** Same as current.
- **Feeds:** Same as current, but better copy pulls richer responses. "Comments" is vague. "What did your team notice" is specific and invites real feedback.
- **Friction:** Same as current. Zero additional friction.
- **Server change:** None.

---

## 7. `payment_reminder_ack` — 1 new question

### NEW: Expected send date (only when "Not yet — still processing")
- **Label:** `Any idea when it'll go out?`
- **Options:** `This week` · `Next week` · `Waiting on approval` · `Not sure`
- **Payload key:** `expectedSendDate`
- **Lands:** `email_capture_tokens.response`. Side effect: if `this_week` → set `deals.payment_due_date` to today + 7. If `next_week` → today + 14. `outreach_notes` line.
- **Feeds:** Same as invoice_sent timeline question — populates `payment_due_date` for automated reminders. Only shows when they said "not yet," so it's contextually relevant.
- **Friction:** One tap. Only on the "not sent" branch.
- **Server change:** `deals.payment_due_date` update. No migration.

---

## 8. `payment_receipt` — 2 new questions

### NEW: How was working with us overall? (after rebooking interest)
- **Label:** `How was the overall experience working with our team?`
- **Options:** `Great — smooth all around` · `Good — minor hiccups` · `Rough — some issues came up`
- **Payload key:** `workingExperience`
- **Lands:** `email_capture_tokens.response` + `outreach_notes`.
- **Feeds:** Venue-side relationship quality data. The show report captures the artist's perspective; this captures the venue's. "Rough" triggers a task: `Review relationship — venue reported issues at {venueName}`, priority high, due today.
- **Friction:** One tap.
- **Server change:** Conditional task insert. No migration.

### NEW: Would you recommend us to other venues? (final step, before "anything else")
- **Label:** `Would you recommend us to anyone in your network? (optional)`
- **Options:** `Yes — happy to` · `Maybe` · `Rather not`
- **Payload key:** `referralWillingness`
- **Lands:** `email_capture_tokens.response` + `outreach_notes`.
- **Feeds:** NPS-style signal. If "yes" → task: `Follow up on referral willingness — {venueName}`, priority medium, due + 5 days. This is how you grow the pipeline from existing relationships. A venue that says "happy to recommend" is an asset you should act on.
- **Friction:** One tap. Optional.
- **Server change:** Conditional task. No migration.

---

## 9. `show_cancelled_or_postponed` — 1 new question

### NEW: Would you want to work together in the future? (after resolution, before notes)
- **Label:** `Regardless of what happened — would you want to work together again down the line?`
- **Options:** `Definitely` · `Maybe — depends on timing` · `Probably not`
- **Payload key:** `futureInterest`
- **Lands:** `email_capture_tokens.response` + `outreach_notes`. If `definitely` → optionally nudge `venues.status` to `post_follow_up` instead of leaving in limbo. If `probably_not` → `archived`.
- **Feeds:** Cancellations are ambiguous — was it a relationship failure or just bad luck? This question disambiguates. "Definitely" means stay warm. "Probably not" means stop spending energy.
- **Friction:** One tap. Emotionally appropriate — it's forward-looking after a setback.
- **Server change:** Optional status nudge. No migration.

---

## 10. `rebooking_inquiry` — 2 new questions

### NEW: Preferred day of week (before availability text)
- **Label:** `Any day of the week that works best?`
- **Options (multi-select):** `Friday` · `Saturday` · `Sunday` · `Weeknight` · `Flexible`
- **Payload key:** `preferredDays` (array)
- **Lands:** `booking_requests` row (alongside existing fields) + `email_capture_tokens.response`.
- **Feeds:** Scheduling intelligence. Over time: "80% of rebookings prefer Saturday" or "this venue always wants Friday." Also useful for Luijay when planning his calendar.
- **Friction:** One or two taps. Before the text field — gives them an easy start before they have to type.
- **Server change:** Include in `booking_requests` insert. No migration (goes into existing fields or `raw_payload`).

### NEW: Rough budget range (after availability text)
- **Label:** `Roughly what budget range are you working with? (optional)`
- **Options:** `Under $500` · `$500–$1,000` · `$1,000–$2,000` · `$2,000+` · `Let's discuss`
- **Payload key:** `budgetRange`
- **Lands:** `booking_requests.budget_note` + `email_capture_tokens.response`.
- **Feeds:** Deal qualification. Right now rebooking inquiries come in without budget context and you waste time on leads that can't afford the rate. This pre-qualifies. "Under $500" is below Luijay's floor — you can still engage but with different expectations.
- **Friction:** One tap. Optional.
- **Server change:** Write to `booking_requests.budget_note`. No migration.

---

## 11. Show Report Wizard — 4 new questions

### NEW: Did the venue provide what was promised? (after production, before friction tags)
- **Label:** `Did the venue deliver on what they promised? (sound, green room, parking, etc.)`
- **Options:** `Yes — everything was good` · `Mostly — a few things were off` · `No — significant gaps`
- **Payload key:** `venueDelivered`
- **Lands:** `performance_reports` — would need a new column OR encode in `notes` field via structured prefix. Also `outreach_notes` synthesis paragraph.
- **Feeds:** Venue accountability tracking. Over time: "this venue has under-delivered 3 out of 4 shows." Feeds into venue priority scoring and negotiation leverage. If "significant gaps" → task: `Address venue delivery issues — {venueName}`, priority high.
- **Friction:** One tap.
- **Server change:** Either new column on `performance_reports` (migration) or encode in notes/jsonb. Conditional task insert.

### NEW: How was the crowd energy? (after attendance, before payment)
- **Label:** `How was the crowd energy?`
- **Options:** `Electric — they were into it` · `Warm — decent energy` · `Flat — tough crowd` · `Hostile — rough night`
- **Payload key:** `crowdEnergy`
- **Lands:** `performance_reports` notes or new column. `outreach_notes` synthesis.
- **Feeds:** Separates attendance from engagement. A packed room can still be a dead crowd. "Hostile" triggers a review. Over time this builds venue profiles: "great turnout but always a flat crowd" vs. "small but electric." Valuable for deciding whether to rebook.
- **Friction:** One tap.
- **Server change:** Encode in notes or new column. No required migration if using notes.

### NEW: Any merch or tip income? (after payment section, optional)
- **Label:** `Any tips or merch income from the night? (optional)`
- **Options:** `None` · `Under $50` · `$50–$150` · `$150+`
- **Payload key:** `supplementalIncome`
- **Lands:** `performance_reports` notes or `email_capture_tokens.response` equivalent. Could feed into `metrics` as a new category if migration adds it.
- **Feeds:** Total gig economics. A $600 gig with $200 in tips is actually $800. This changes how you evaluate venues — some low-fee venues might be high-total-income venues. For Luijay specifically, tracking tips helps build the case for higher base rates ("average night earns $X in tips, proving crowd engagement").
- **Friction:** One tap. Optional. Skip-safe.
- **Server change:** Notes encoding or new `performance_reports` column. No migration required if using notes.

### NEW: Referral detail capture (when referralLead = yes)
- **Label:** `Who showed interest? Drop whatever you remember.`
- **Placeholder:** `Name, venue, phone, IG — anything helps`
- **Payload key:** `referralDetail`
- **Lands:** `performance_reports` notes + `outreach_notes`. Feeds into the existing "Capture referral lead" task — but now the task has context instead of just a title.
- **Feeds:** Referral leads currently create a task with zero info attached. The manager has to chase the artist asking "who was it?" This captures it while the memory is fresh.
- **Friction:** Short text. Only appears when they already said "yes" to the referral question.
- **Server change:** Include in task notes or outreach_notes synthesis. No migration.

---

## Summary: New Questions by Form

| Form | New Qs | Taps Added | Text Fields Added | Migrations Needed |
|------|--------|------------|-------------------|-------------------|
| `first_outreach` | 3 | 2 | 1 (optional) | 0 (1 contacts upsert logic) |
| `follow_up` | 2 | 2 | 0 | 0 |
| `pre_event_checkin` | 3 | 3 | 0 | 0 |
| `booking_confirmation` | 2 | 1 | 1 (optional) | 0 |
| `invoice_sent` | 2 | 1 | 1 (optional) | 0 |
| `post_show_thanks` | 3 | 3 | 0 (reframe existing) | 0 |
| `payment_reminder_ack` | 1 | 1 | 0 | 0 |
| `payment_receipt` | 2 | 2 | 0 | 0 |
| `show_cancelled_or_postponed` | 1 | 1 | 0 | 0 |
| `rebooking_inquiry` | 2 | 2 | 0 | 0 |
| Show Report Wizard | 4 | 3 | 1 (conditional) | 0 (recommended: 2 columns) |
| **Totals** | **25** | **21** | **4** | **0 required** |

---

## Implementation Priority

**Tier 1 — Ship this week (zero migration, highest ROI):**
1. `follow_up` → "When should we check back?" — brings `venues.follow_up_date` to life
2. `invoice_sent` → "When should we expect payment?" — brings `deals.payment_due_date` to life
3. `first_outreach` → structured alternate contact → creates real `contacts` rows
4. `rebooking_inquiry` → budget range → pre-qualifies leads instantly

**Tier 2 — Ship next (zero migration, strong ROI):**
5. `post_show_thanks` → "Would you book again?" — two-sided rebooking signal
6. `payment_receipt` → referral willingness → pipeline growth engine
7. `pre_event_checkin` → venue capacity → enables fill-rate reporting
8. Show Report → referral detail capture → makes referral tasks actionable

**Tier 3 — Ship when ready (optional migration for max value):**
9. Show Report → venue delivered + crowd energy → venue accountability
10. Show Report → supplemental income → total gig economics
11. `first_outreach` → referral source → attribution reporting
12. Everything else

---

## What NOT to Add

I considered and rejected these:

- **NPS score (1–10) on post-show** — star rating already exists. Two rating scales = confusion.
- **"How did you find our email?" on every form** — only relevant on first outreach. Asking it on a payment reminder is bizarre.
- **Open text "describe your venue" on first outreach** — too much friction at the wrong moment. They haven't committed to anything yet.
- **Detailed tech rider questions on pre-event** — there's already a link field. Don't duplicate what a proper rider document handles.
- **Social media handles on any venue form** — you can look these up. Don't make them do your research.
- **"Rate your manager" on any form** — don't invite criticism of yourself on your own forms. Learn this from the show report data instead.
