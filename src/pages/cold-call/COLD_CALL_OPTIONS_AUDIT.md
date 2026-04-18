# Cold call form — options & branches audit (what helps vs. what hurts)

This document lists **every step** in the cold-call flow (pre-call, live cards, post-call) and the **selectable options** exposed there. For each, it calls out choices that **fail to capture data when you already have it**, **push work to “later” without a field**, **don’t align with dashboard/outreach contact fields**, or **are too vague to be useful in the CRM**.

**Code references:** `src/pages/ColdCallFormPage.tsx` (UI), `src/pages/cold-call/liveFieldOptions.ts` (many chip lists), `src/lib/coldCall/coldCallPayload.ts` (types + labels), `src/lib/coldCall/mapColdCallToBookingIntake.ts` (how data lands in intake/outreach).

---

## Live header (all live_call)

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Temperature** (`TemperatureMenu` / `LiveTemperatureBar`) | Clear; Dead; Cold; Warm; Hot; Converting (emoji + label from `COLD_CALL_TEMPERATURE_META`) | Mostly yes | **Clear** leaves temperature empty — fine for auto-score, but easy to forget before close. |

---

## Pre-call (`session_mode === 'pre_call'`)

### Venue source

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **New vs existing** (`IntakeCompactDual`) | New venue / Existing venue | Yes | — |
| **Existing venue** | Dropdown of `venues` | Yes | — |

### Essentials

| Control | Options / type | Serves you? | Issues |
|--------|----------------|-------------|--------|
| Venue name, phone, city | Text | Yes | — |
| **Why am I calling?** | `CALL_PURPOSE_TOGGLE`: Residency / upcoming event / One-time / General availability / Follow-up | Yes | — |

### Add research (collapsible)

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Type of spot** | `PRECALL_VENUE_TYPES` → `VENUE_TYPE_LABELS` (bar, club, lounge, festival, theater, other) | Yes | Same broad types as rest of app; OK. |
| **State** | `US_STATE_OPTIONS` | Yes | — |
| **Size** | `CAPACITY_OPTIONS` (under 100 … 2000+) | Yes | Buckets are coarse but consistent with live p4e. |
| What nights / events? | Free text | Yes | — |
| Instagram, Website | Text | Yes | — |

### I have a name or contact (collapsible)

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| Contact name, Title | Text + **`ContactTitleSelect`** | Yes | **Aligned with venue/contact title system** (`title_key` ecosystem). |
| Email | Text | Yes | — |
| **How I found them** | `COLD_CALL_HOW_FOUND_LABELS`: Instagram, Google, Referral, Yelp, Drove by, Event listing, Industry contact, Other | Yes | — |

### Pitch angle

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| Reason chips | `COLD_CALL_PITCH_REASON_CHIPS` (+ Custom + free `pitch_reason_custom`) | Yes | — |
| **Legacy free-text** | `pitch_angle` textarea | Mixed | Label admits legacy — **easy to ignore or duplicate** chip/custom reason. |

### Follow-up call extra

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Previous cold call** | Select from `prevCallsForVenue` or — | Yes | Only when `call_purpose === 'follow_up'`. |

### Pipeline

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Priority** | 1–5 stars | Mostly yes | Copy says `1 star` / `N stars` — minor. |

---

## Live call — by card (`live_card` / `view_card`)

Branches depend on **Who picked up?** (`who_answered`):

- **Right person** → skips gatekeeper waypoint; goes p1 → p3 → …
- **Gatekeeper** → p1 → **p2a** → …
- **Voicemail** → p1 → **p6_vm** (no gatekeeper card)
- **No answer** → p1 → **p6_na**

---

### p1 — Who picked up? (`liveCardStepTitle`: Who picked up?)

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Who picked up?** | `WHO_ANSWERED_OPTIONS`: Right person; Gatekeeper / staff; Voicemail; No answer | Partial | **If they are gatekeeper/staff, voicemail, or no answer, this card offers no fields for who you spoke with, their name, or their title.** You only pick the bucket; any human detail waits for a **different** card or never gets structured. |
| *(only if Right person)* **Name on the line** | Text input | Yes | — |
| *(only if Right person)* **Name check** | `CONFIRMED_NAME_OPTIONS`: Yes it’s them; No different person; **No name from them yet** | Mixed | If you **typed a name**, “No name from them yet” is **incoherent** (still selectable). |
| *(only if Right person, name blank)* **No name yet?** | Will capture later; Hasn’t said yet | **Weak** | **“Fill in later” on the same step you’re on** — you’re already at the keyboard; forces a deferral instead of optional free-text or skipping chips. Doesn’t distinguish “they refused” vs “line noise.” |
| *(only if Right person)* **Their title** | `ContactTitleSelect` | Yes | **Matches dashboard contact titles.** |

**Ecosystem gap:** Gatekeeper path does **not** get `ContactTitleSelect` on p1; staff identity is handled on p2a with a **different** role system (see below).

---

### p2a — Gatekeeper (`ColdCallFormPage` only when `who_answered === 'gatekeeper'`)

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **What happened?** | `GATEKEEPER_RESULT_OPTIONS`: Gave me a name; Transferred; Took a message; Shut it down | Yes | — |
| **Name or callback — captured?** | **Yes — fill in later**; No | **Poor** | If they **already gave** a name or callback number, you still only get **binary + deferral** — **no name field, no phone field on this step.** You must advance and hope p2a_detail or post notes cover it. |
| **Their role (who you spoke with)** | `COLD_CALL_GATEKEEPER_STAFF_LABELS`: Receptionist; Bartender; Security; Staff; Not sure | **Poor for CRM** | These are **`ColdCallGatekeeperStaffRole` chips**, **not** `ContactTitleKey`. **`ContactTitleSelect` / venue contact titles are not used here.** On import, `buildGatekeeperSecondContact` turns this into a **plain English label** (or “Gatekeeper”), not a normalized `title_key` — **does not match how contacts are stored on the venue in the dashboard.** |

---

### p2a_detail — Decision-maker details (when gatekeeper result = gave name)

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Name they gave** | Text (`decision_maker_name`) | Yes | — |
| **Their title** | `ContactTitleSelect` (`decision_maker_title_key`) | Yes | **Aligned with ecosystem** for the *decision-maker*, not for the gatekeeper you just spoke to. |
| **Best time** | `BEST_TIME_OPTIONS`: Morning; Afternoon; Evening; Specific day — later; They didn’t say | Mostly yes | “Specific day — later” still **doesn’t collect the day** on this card. |
| **Direct line / email?** | **Yes — capture later**; No | **Poor** | Same anti-pattern: **no inputs for the actual line or email** when you say yes — deferred to nowhere structured on this step. |

---

### p2_msg — Message left

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| *(first row)* | Got name — later; No name | **Weak** | Again **“later”** without a required follow-up field; **no** “they gave name now” with inline input. |
| *(second row)* | Expecting callback; No I’ll try again | Mixed | OK for intent; **no field for who took the message** or extension. |

---

### p3 — The pitch (initial reaction)

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **How did they respond?** | `INITIAL_REACTION_OPTIONS`: Interested; Maybe; We have our own DJs; Not right now; Not interested at all | Mostly yes | **“Not right now” vs “Not interested at all”** can feel similar on a quick call; both are needed for routing but **operator may hesitate** without sub-notes. |

---

### p3b — Pivot (guest DJs)

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Pivot** | `PIVOT_OPTIONS`: Actually yeah sometimes; Not really; We might for special events | Yes | — |

---

### p3c — Graceful parking

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Parking** | `PARKING_OPTIONS`: Yes send info; No don’t bother; Try again in a few months | Mostly yes | — |
| **Send to** | `SEND_TO_OPTIONS`: Email; Text; Instagram DM; **They’ll find us** | Mixed | **“They’ll find us”** is **low signal** for follow-up workflow — no artifact of channel or owner expectation. |

---

### p4a — Their event nights

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **What nights?** | Multi chips: Monday … Sunday (`COLD_CALL_WEEKDAY_LABELS`) | Yes | — |
| **Night details** | Yes — specifics later; Just the days | **Weak** | **“Specifics later”** with **no text field** on this card for what those specifics are. |

---

### p4b — Music & crowd

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Vibe** | `MUSIC_VIBE_PRESETS` (same family as booking intake) | Yes | **Aligned with intake vibe IDs.** |
| **If they ask who he is** | Collapsible: profile `tagline` | Yes | Reference only; not options. |

---

### p4c — How they book

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Who handles booking?** | `BOOKING_PROCESS_OPTIONS`: This person decides; Someone else; Committee; They didn’t say | Yes | Choosing **This person** auto-sets decision-maker same = yes (see code). |
| **Talking to the decision-maker?** | `DECISION_SAME_OPTIONS` (shown if not “this person”) | Yes | — |
| **How much did you get about who decides?** | Got info — later; They were vague | **Weak** | **“Got info — later”** with **no structured fields** on this card for name, title, or contact — another deferral. |

---

### p4d — Budget (strong signal only)

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Budget range** | `BUDGET_RANGE_OPTIONS` (incl. They didn’t say; Depends on the DJ) | Yes | — |
| **Rate reaction** | `RATE_REACTION_OPTIONS`: Comfortable; Hesitant; More than we usually pay; **Didn’t discuss** | Yes | — |

---

### p4e — Capacity & venue type

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Capacity** | `CAPACITY_OPTIONS` | Yes | Same buckets as pre-call. |
| **Venue type** | `VENUE_TYPE_CONFIRM_OPTIONS`: Bar, Club, Festival, Theater, Lounge, Other | Mostly yes | **Parallel** to pre-call `venue_type` / global `VenueType` — small risk of **inconsistency** if operator sets different values in pre-call vs live. |

---

### p5 — The ask

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Their answer** | `ASK_RESPONSE_OPTIONS`: Yes let’s set something up; I need to check and get back; **Send me his info first**; Not right now; No | Mixed | **“Send me his info first”** assumes **male artist / “his”** — wrong copy for many users; also **no inline capture of which channel** they asked for (unless inferred elsewhere). |

---

### p6 — Close

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Call ended** | `ENDED_OPTIONS`: Yes; They had to go; Got cut off | Mixed | **“Yes”** is **vague** — doesn’t distinguish clean mutual wrap vs abrupt. |
| **Duration feel** | `DURATION_OPTIONS`: Quick / Short / Medium / Long | Yes | — |
| Convert / End call | Buttons | Yes | — |

---

### p6_vm — Voicemail

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Voicemail** | Left voicemail; Skipped | Yes | — |
| **When to follow up** | Tomorrow; In a few days; Next week; Don’t retry | Yes | — |

---

### p6_na — No answer

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Try again** | Later today; Tomorrow; Next week; **Drop this lead** | Mostly yes | **Drop this lead** is strong — good — but confirm it matches your pipeline expectations. |
| **Notes** | Add note after; Nothing to add | **Weak** | Selecting **“Add note after”** does **not** open a note field on this screen — you still rely on **post-call notes** or memory. |

---

## Post-call (`session_mode === 'post_call'`)

### Outcome

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Final temperature** | Same set as live (`COLD_CALL_TEMPERATURE_META`) | Yes | — |
| **Outcome** | Auto vs Manual; manual uses `COLD_CALL_OUTCOME_LABELS` (dead_not_fit, gatekeeper_info, interested_sending, …) | Yes | Large list — **manual override** is powerful but dense. |
| **Save** | `IntakeCompactDual`: History only / Save to pipeline | Yes | — |

### Follow-up (if save to pipeline)

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| **Next actions** | Multi: `COLD_CALL_NEXT_ACTION_LABELS` (website, mix, press, email_recap, text, schedule_call, instagram, other) | Yes | — |
| Follow up by (date), notes | Text / date | Yes | — |

### Notes

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| Call notes | Free text | Yes | — |
| **Rejection reason** (if final temp dead) | `COLD_CALL_REJECTION_LABELS` | Yes | — |

### Pipeline import

| Control | Options | Serves you? | Issues |
|--------|---------|-------------|--------|
| Import to Outreach | Button | Yes | Contact row uses `target_title_key` etc.; **gatekeeper staff role still not a `title_key`** (see `buildGatekeeperSecondContact`). |

---

## Cross-cutting problems (summary)

1. **p1 is blind for non–right-person paths** — No way to log **gatekeeper’s name or title** on the opener; you only classify the line.
2. **“Fill in later / capture later / got name — later”** appears repeatedly **without paired inputs** on the same step — forces deferral when you often **have the fact in hand**.
3. **Gatekeeper staff “role” chips are a parallel taxonomy** to **`ContactTitleSelect` / `title_key`** — second contact gets a **string role label**, not the same field as venue contacts.
4. **Gendered copy** on p5: “Send me **his** info first.”
5. **Vague binaries**: p6 “Call ended: Yes”; p3c “They’ll find us”; p4c/p2a “got info — later” with no structured capture.
6. **p6_na “Add note after”** promises a note but **doesn’t collect it on-card**.

---

## Suggested fix directions (for a future pass; not implemented here)

- Add **optional inline fields** (name, phone, `ContactTitleSelect`) on **p1** when `who_answered === 'gatekeeper'` (or immediately after selection without advancing).
- Replace **`gatekeeper_staff_role` chips** with **`ContactTitleSelect` + optional “other” free text**, and map to `title_key` when importing.
- Replace **“yes — fill in later”** patterns with **“Yes — enter below”** + inputs, or **“Not yet”** only when truly unknown.
- Add **note / identity fields** on p6_na when “Add note after” is selected, or jump to notes.
- Reword p5 **his** → **their** or **the artist’s**.

---

*Generated from codebase audit. Update this file when options change in `ColdCallFormPage.tsx` / `liveFieldOptions.ts` / `coldCallPayload.ts`.*
