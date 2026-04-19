# Cold call ecosystem — full script & options audit

**Purpose:** Single reference for **spoken script lines** (beats), **UI labels**, **every selectable option**, and **routing** between live cards.  
**Generated from source:** `liveCardCopy.ts`, `liveFieldOptions.ts`, `ColdCallFormPage.tsx`, `coldCallLiveRouting.ts`, `coldCallLivePath.ts`, `coldCallPayload.ts`, `intakePayloadV3.ts` (`MUSIC_VIBE_PRESETS`).  
**Note:** Copy in production is defined in code; if this file drifts, trust the files above.

---

## Profile → script context (`coldCallScriptContext`)

| Field | Source | Fallback |
|--------|--------|----------|
| `artistName` | `profile.artist_name` | `the artist` |
| `managerFirst` | first token of `manager_name` or `company_name` | `I` |
| `managerPhone` | `profile.manager_phone` | `''` (beats then use *“the number I’m calling from”*) |
| `credentialsLine` | `profile.tagline` | `an experienced club & event DJ with strong radio and brand work.` |

**Dynamic:** `coldCallTimeOfDayGreeting()` on **p3** — `Good morning` / `Good afternoon` / `Good evening` / `Good night` from browser local hour.

**Name on line (`n` in code):** first word of first non-empty: `target_name`, else gatekeeper `gatekeeper_name` if `who_answered === 'gatekeeper'`, else `decision_maker_name`.

---

## Sidebar waypoints (labels)

Order in UI: **Opener → Pitch → Redirect → The Ask → Pivot → Close** (`coldCallWaypointAnchor` / `waypointIndex` in `coldCallLivePath.ts`).  
Some phases are **skipped** when `who_answered` is right person, voicemail, or no answer (see comments in `coldCallPhaseSkipped`).

---

## Live cards — script beats + capture fields

Legend:

- **Beats:** lines from `coldCallLiveScriptBeats(card, d, ctx)`. `situational` / `situationalChain` affect styling only (yellow follow-up block).
- **Options:** id → label as shown in UI.

### p1 — The Opener

**Script (conditional):**

1. **Follow-up** (`call_purpose === 'follow_up'` **and** `n` non-empty):  
   - `Hey {n}, it’s {managerFirst} — we spoke a little while back about {artistName}.`  
   - `You mentioned to follow up around now, so I wanted to check in.`

2. **Else if venue name blank:**  
   - `Hey, this is {managerFirst} — I’m calling about live DJ bookings for venues.`  
   - *situational:* `Perfect — are you guys currently booking DJs for any upcoming events?`  
   - *situational + chain:* `Are you the one that handles entertainment?`

3. **Else (venue name set):**  
   - `Hey, is this {venueLine}?`  
   - *situational:* `Perfect — are you guys currently booking DJs for any upcoming events?`  
   - *situational + chain:* `Are you the one that handles entertainment?`

**Capture — Who picked up?** (`WHO_ANSWERED_OPTIONS`)

| id | Label |
|----|--------|
| `right_person` | They book DJs |
| `gatekeeper` | Not the right person |
| `voicemail` | Voicemail |
| `no_answer` | No answer |

**If `right_person`:** helper text (passive capture); **Name** (text); **Title** (`ContactTitleSelect` / contact titles catalog).

**If `gatekeeper`:** **Gatekeeper name** (text); **Gatekeeper title** (`ContactTitleSelect`).

**Advance:** right_person → **p3**; gatekeeper → **p2a**; voicemail → **p6_vm**; no_answer → **p6_na**.

---

### p2a — The Redirect

**Script:**  
`No worries — who would be the right person to talk to about this, and what’s the best way to reach them?`

**Capture — What happened?** (`GATEKEEPER_RESULT_OPTIONS`)

| id | Label |
|----|--------|
| `gave_name` | They gave me a name |
| `transferred` | They transferred me |
| `message` | They took a message (ends call) |
| `shut_down` | They shut it down |

**Advance:**

- `gave_name` → **p2a_detail**
- `transferred` → **p3** (`transferred_note: true`)
- `message` → **p6** *(skips p2_msg UI in router — see note below)*
- `shut_down` → **p6** (`operator_temperature` forced `dead` if unset)

**Note:** Card **p2_msg** (Message left) is implemented in UI + script, but **`advanceFromLiveCard` routes `message` straight to p6**, so **p2_msg is not reached** through the default gatekeeper branch. It remains in the type system and sidebar sets for history / edge cases.

---

### p2a_detail — Decision-maker details

**Script:**  
`Perfect, I appreciate you. I’ll reach out to them. Thanks again — enjoy the rest of your day.`

**Capture**

- **Name they gave** — `decision_maker_name` (text)
- **Their title** — `decision_maker_title_key` (`ContactTitleSelect`)
- **Best time** — `BEST_TIME_OPTIONS`: Morning, Afternoon, Evening, Specific day, They didn’t say  
  - If Specific day → **best_time_specific** (text, e.g. Tuesday after 2pm)
- **Direct line / email** — `DM_DIRECT_LINE_OPTIONS`: Got a number, Got an email, Got both, No  
  - If phone/both → **decision_maker_direct_phone**  
  - If email/both → **decision_maker_direct_email**

**Advance:** → **p6**

---

### p2_msg — Message left

**Script:**  
- `Could you let them know {managerFirst} called about {artistName}?`  
- `My number is {phone} if they want to reach back.`  
- `I appreciate it.`

**Capture**

- **Who took the message?** — `message_taker_name` (text)
- **Callback expected?** — `yes` → “Yes — they’ll call back”; `no_retry` → “No — I’ll try again”

**Advance (when this card is active):** → **p6** (requires `callback_expected`)

---

### p3 — The Pitch

**Script (always):**

1. `{coldCallTimeOfDayGreeting()} — my name’s {managerFirst} — I work with {artistName}.`
2. `We’ve done work with brands like Jack Daniel’s, Golden Boy, and he’s currently on air at Cali 93.9.`
3. `I came across you guys on Instagram and wanted to reach out because I think there’s a good fit here. Let me ask you this: what is your typical DJ night like right now?`

**Extra beat:** If `initial_reaction === 'pitch_tell_me_more'` **and** `pitch_tell_me_more_ack` is true:  
`Here’s the quick picture — {credentialsLine}` (or fallback: `{artistName} is an experienced club and event DJ — mixes and press kit on request.`)

**Capture — How did they respond?** (`INITIAL_REACTION_OPTIONS`)

| id | Label |
|----|--------|
| `pitch_rotation_solid` | We have a solid rotation already |
| `pitch_looking` | We’re actually looking for someone |
| `pitch_in_house` | We do it in-house |
| `pitch_no_dj_nights` | We don’t really do DJ nights |
| `pitch_tell_me_more` | Tell me more about him first |

Changing reaction resets **`pitch_tell_me_more_ack`** to false.

**Routing (`advanceFromLiveCard`) — important:**

| `initial_reaction` | Next |
|--------------------|------|
| `pitch_tell_me_more` | First continue: set `pitch_tell_me_more_ack: true` (stay on p3). Second continue: → **p5** |
| `pitch_no_dj_nights` or `not_interested` | → **p6** (temperature → `dead` if unset) |
| `not_right_now` | → **p6** |
| `pitch_rotation_solid`, `pitch_in_house`, `own_djs` | → **p3b** |
| `how_much` | → **p4d** |
| `pitch_looking`, `interested`, `maybe` | → **p5** |
| (empty / other) | no advance until a listed branch matches |

**Legacy stored ids** (not on chip list today, but still handled in router / payload):  
`interested`, `maybe`, `own_djs`, `not_right_now`, `not_interested`, `how_much`.

---

### p3b — The Pivot

**Script:**  
1. `That makes sense — a good rotation is hard to build.`  
2. `Here’s the thing — what I’ve seen work is bringing him in as a guest for one night. No commitment, no replacing anyone — just a night to see what he adds to the room.`

**Capture —** `PIVOT_OPTIONS`

| id | Label |
|----|--------|
| `sometimes` | Actually yeah, that could work |
| `special_events` | Maybe for a special event |
| `not_really` | Nah, we’re good |

**Advance:** `not_really` or `special_events` → **p6**; `sometimes` → **p5**

---

### p3c — Graceful parking

**Script:** If `n`: `No worries at all, {n}.` / else: `No worries at all.`  
Then: stay-on-radar lines + `Cool if I send over {artistName}’s info…`

**Capture**

- **Parking** — `PARKING_OPTIONS`: Yes — send info; No — don’t bother; Try again in a few months  
- If send info → **Send via** `SEND_TO_OPTIONS`: Email, Text, Instagram DM, They already know about us

**Advance:** → **p6** (if `send_info`, require `send_to`)

---

### p4a — Their event nights

**Script:** `Good to know.` / `What nights do you usually have events or bring DJs in?`

**Capture**

- **What nights?** — multi-select chips: **Monday … Sunday** (`COLD_CALL_WEEKDAY_LABELS`)
- **Quick note (optional)** — `night_details_note` (text)

**Advance:** → **p5**

---

### p4b — Music & crowd

**Script:** `What kind of music does your crowd go for?`

**Capture — Vibe** — multi-select from `MUSIC_VIBE_PRESETS` (ids + labels):

| id | Label |
|----|--------|
| `latin_party` | Latin Party |
| `hiphop_rnb` | Hip-Hop & R&B |
| `club_high_energy` | Club / High Energy |
| `chill_lounge` | Chill / Lounge |
| `open_format` | Open Format / Mix of Everything |
| `afro_caribbean` | Afro / Caribbean |
| `latin_x_hiphop` | Latin x Hip-Hop |
| `latin_x_club` | Latin x Club |
| `rnb_x_latin` | R&B x Latin |

Optional **details** disclosure: if profile tagline set, “If they ask who he is” shows tagline text (not a stored beat).

**Advance:** → **p5**

---

### p4c — How they book

**Script:**  
`And how does booking usually work on your end — do you handle that, or is there someone else I should talk to?`

**Capture — Who handles booking?** (`BOOKING_PROCESS_OPTIONS`)

| id | Label |
|----|--------|
| `this_person` | This person decides |
| `someone_else` | Someone else decides |
| `committee` | Committee / multiple people |
| `unsaid` | They didn’t say |

- If **`unsaid`:** **Talking to the decision-maker?** (`DECISION_SAME_OPTIONS`): Yes — I’m talking to them; No — need someone else  
- If **`someone_else` or `committee`:** **Who should I talk to?** (name), **Their title**, **Contact info?** (`DM_DIRECT_LINE_OPTIONS` + phone/email fields)

**Advance:** → **p5**

---

### p4d — The Price Pivot

**Script:**  
1. `For a single set he’s at $1,500, but honestly it depends on the setup — if there’s a bigger opportunity here we can figure out something that works.`  
2. *situational:* `That makes sense. What if we did a trial night at a reduced rate — that way there’s less risk and you get to see what he does?`

**Capture**

- **Budget range** — `BUDGET_RANGE_OPTIONS`: Under $500; $500–$1,000; $1,000–$1,500; $1,500–$2,000; $2,000–$3,000; $3,000+; They didn’t say; Depends on the DJ  
- If budget ≠ `no_say` → **How they reacted** — `RATE_REACTION_OPTIONS`: Comfortable; Hesitant; More than we usually pay; Didn’t discuss  
- If budget is `no_say`, rate auto **`skipped`** in UI.

**Advance:** → **p5**

---

### p4e — Capacity & entity type

**Script:** `And roughly how big is the space?`

**Capture**

- **Capacity** — `CAPACITY_OPTIONS`: Under 100; 100–300; 300–500; 500–1,000; 1,000–2,000; 2,000+  
- **Entity type** — `EntityTypeSelect` / `VENUE_TYPE_CONFIRM_OPTIONS` (venue types from `VENUE_TYPE_ORDER` + `VENUE_TYPE_LABELS`)

**Advance:** → **p5**

---

### p5 — The Ask

**Script:**  
1. `I’d love to get him in front of you guys — even just one night so you can see what he does.`  
2. `Would it be cool if we set up a trial night?`

**Capture — Their answer** (`ASK_RESPONSE_OPTIONS`)

| id | Label |
|----|--------|
| `yes_setup` | Yes — let’s set something up |
| `check_back` | I need to check and get back |
| `send_info_first` | Send me info first |
| `not_now` | Not right now |
| `no` | No |

- If `send_info_first` → **Send via** `ASK_SEND_CHANNEL_OPTIONS`: Email, Text, Instagram DM  
- If `check_back` → **When should I follow up?** `ASK_FOLLOWUP_WHEN_OPTIONS`: A few days; Next week; End of month; They’ll reach out  

**Temperature hints** (auto): yes_setup → converting; check_back → hot; send_info_first → warm; not_now → cold; no → dead (`applyAskResponseTemperatureHint`).

**Advance:** → **p6**

---

### p6 — The Close

**Script** depends on `operator_temperature || final_temperature`:

| Temperature | Beats |
|-------------|--------|
| `dead` | `I appreciate your time — seriously. Enjoy the rest of your day.` |
| `cold` | Appreciate time + circle back + enjoy day; *situational:* `I didn’t catch your name — what was it again?` |
| `warm` | Send everything + check in + thanks; *situational:* `Who am I sending this to?`; *chain:* `I appreciate you — I didn’t catch your name?` |
| `hot` | Get everything + check in few days; *situational:* `Who am I sending this to?` |
| `converting` | `Perfect — I can actually get everything set up right now if you’ve got a couple more minutes.`; *situational:* `Who am I setting this up for?` |
| (empty / other) | Thanks + enjoy; *situational:* `I didn’t catch your name?` |

**Capture**

- **How the call ended** — `ENDED_OPTIONS`: Clean wrap; They had to go; Got cut off; I ended it  
- **Duration feel** — `DURATION_OPTIONS`: Quick (under 2 min); Short (2–5 min); Medium (5–10 min); Long (10+ min)  
- If temperature **converting**: optional **Convert to booking** button; **End call — wrap up** always  

**Advance:** → **post_call** (`session_mode`)

---

### p6_vm — Voicemail

**Script:** With `n`: named intro + fit + callback. Without `n`: generic intro + venue + callback.

**Capture**

- **Voicemail:** Left voicemail / Skipped (`left` / `skipped`)  
- **When to follow up:** Tomorrow; In a few days; Next week; Don’t retry  

**Advance:** → **post_call**

---

### p6_na — No answer

**Script:** `No answer.`

**Capture — Try again**

| id | Label |
|----|--------|
| `later_today` | Later today |
| `tomorrow` | Tomorrow |
| `next_week` | Next week |
| `remove` | Drop this lead |

**Advance:** → **post_call**

---

## Post-call (`session_mode === 'post_call'`) — not spoken script; options

- **Final temperature** — same scale as live (`COLD_CALL_TEMPERATURE_META` / `TemperatureMenu`)
- **Outcome** — auto from data or manual: keys in `COLD_CALL_OUTCOME_LABELS` (dead_not_fit, dead_wrong_contact, gatekeeper_info, interested_sending, interested_followup, very_interested_proposal, converting_intake, voicemail, no_answer)
- **Save to pipeline** — History only / Save to pipeline  
- If pipeline: **Next actions** — `COLD_CALL_NEXT_ACTION_LABELS` (website, mix, press, email_recap, text, schedule_call, instagram, other); **Follow up by** (date); **Follow-up notes**  
- **Notes** — free text  
- If **final_temperature === dead**: **Rejection reason** — `COLD_CALL_REJECTION_LABELS` (no_outside_djs, exclusive_dj, budget_low, wrong_genre, bad_timing, rude, wrong_contact, other)  
- Optional **Import to Outreach**; if **converting** and not converted: **Convert to booking intake**

---

## Pre-call (summary)

Not live script; sets up **p1** and research. Main toggles: **CALL_PURPOSE_TOGGLE** — Residency/recurring; Upcoming event; One-time; General availability; Follow-up.  
Essentials: venue, phone, city, call purpose chips; collapsible research (entity type, state, size `CAPACITY_OPTIONS`, nights text, socials); contact block; **pitch reason chips** `COLD_CALL_PITCH_REASON_CHIPS` + custom; priority 1–5.

---

## Validation messages (Continue on bookmark)

Summarized from `liveCardAdvanceBlockersAtBookmark`: required fields per card match gates in `advanceFromLiveCard` (e.g. p5 requires `ask_send_channel` when `send_info_first`, etc.).

---

*End of audit — keep in sync when editing `liveCardCopy.ts`, `liveFieldOptions.ts`, or routing.*
