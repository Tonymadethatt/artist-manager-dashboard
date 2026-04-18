# Cold call scripts — full reference (for copy edits)

Use this file to draft wording changes. **Production copy lives in code**; after you edit here, hand the updates back and they should be applied to the files listed under [Source files](#source-files).

---

## Source files

| What | File |
|------|------|
| Live card script lines (beats), step titles, profile context helper | `src/pages/cold-call/liveCardCopy.ts` |
| Pitch “because …” chip labels + clause text | `src/lib/coldCall/coldCallPayload.ts` → `COLD_CALL_PITCH_REASON_CHIPS` |
| Form chip labels (not always spoken aloud; they steer the flow) | `src/pages/cold-call/liveFieldOptions.ts` |
| Weekday strings injected into **p5** when `call_purpose === 'residency'` | `src/lib/coldCall/coldCallPayload.ts` → `COLD_CALL_WEEKDAY_LABELS` (same labels as p4a chips) |

---

## Profile → script context (`ColdCallScriptCtx`)

Built by `coldCallScriptContext(profile)` in `liveCardCopy.ts` from `ArtistProfile`:

| Variable | Source field | Fallback when empty |
|----------|--------------|-------------------|
| `artistName` | `profile.artist_name` | `'the artist'` |
| `managerFirst` | first word of `profile.manager_name`, else `profile.company_name` | `'I'` |
| `managerPhone` | `profile.manager_phone` | `''` (see phone fallback below) |
| `credentialsLine` | `profile.tagline` | `'an experienced club & event DJ with strong radio and brand work.'` |

**Phone fallback inside beats:** if `managerPhone` is blank after trim, scripts use the literal phrase: `the number I’m calling from`.

---

## Call data → injected values (`ColdCallDataV1`)

Used inside `scriptBeatsForCard` (same file):

| Symbol in code | Meaning | Fields / logic |
|----------------|---------|----------------|
| `vn` | Venue name for script | `d.venue_name.trim()` or `'your venue'` |
| `city` | City/area | `d.city.trim()` or `'the area'` |
| `n` | First name on the line | See **Name on the line** below |
| `events` | Extra pitch line | `d.known_events.trim()` — if non-empty, an extra beat is appended on **p3** |
| `phone` | Callback number | `ctx.managerPhone.trim()` or `'the number I’m calling from'` |
| `because` | Clause after “great fit because …” on **p3** | See **Pitch “because” clause** below |
| `artistName`, `managerFirst`, `credentialsLine` | From profile context | (above) |

### Name on the line (`n`)

`nameOrHey(d)` uses the **first word** of the first non-empty of:

1. `d.target_name`
2. If `d.confirmed_name === 'different'`: `d.different_name_note`
3. `d.decision_maker_name`

If all are empty, `n` is `''` (scripts skip the name where branches check `n`).

### Pitch “because” clause (`because`)

`pitchBecauseClause(d)` — first match wins:

1. If `d.pitch_reason_custom.trim()` → use that string as the full clause.
2. Else if `d.pitch_reason_chip` is set and exists in `COLD_CALL_PITCH_REASON_CHIPS` → use that chip’s `clause({ venue, city })` with `venue = d.venue_name.trim() || 'your venue'`, `city = d.city.trim() || 'the area'`.
3. Else if `d.pitch_angle.trim()` → use that.
4. Else → empty (p3 uses the shorter “great fit for what you’re doing” line).

### Credentials punctuation

- **p3:** `credentialsLine` is appended; if it does not end with `.`, a period is added before the next beat.
- **p6_vm (with name):** credentials are inserted with a trailing period **removed** before joining with “, and I came across …”.

### Close card (**p6**) temperature

Branch uses `d.operator_temperature` if set, otherwise `d.final_temperature`.

---

## Step titles (UI headings above SCRIPT)

From `liveCardStepTitle(card)` in `liveCardCopy.ts`:

| Card id | Title |
|---------|--------|
| `p1` | Who picked up? |
| `p2a` | Gatekeeper |
| `p2a_detail` | Decision-maker details |
| `p2_msg` | Message left |
| `p3` | The pitch |
| `p3b` | Pivot — guest DJs |
| `p3c` | Graceful parking |
| `p4a` | Their event nights |
| `p4b` | Music & crowd |
| `p4c` | How they book |
| `p4d` | Budget (strong signal only) |
| `p4e` | Capacity & venue type |
| `p5` | The ask |
| `p6` | Close |
| `p6_vm` | Voicemail |
| `p6_na` | No answer |

---

## Pitch reason chips (`COLD_CALL_PITCH_REASON_CHIPS`)

Each entry: **id** (stable key in code), **label** (UI chip), **clause** (spoken clause; may use `venue` / `city`).

| id | label | clause text (variables: `venue`, `city`) |
|----|-------|-------------------------------------------|
| `latin_crowd` | Latin crowd | `your crowd is into the Latin scene and that’s his specialty` |
| `events_match` | Their events match | `the events you run are right in line with what he does` |
| `location_fit` | Location fit | `you’re in a great spot for his audience in ${city \|\| 'the area'}` |
| `socials` | Saw their socials | `I saw what you guys are doing on Instagram and the vibe matches perfectly` |
| `referral` | Referral | `someone in the industry recommended I reach out` |
| `need_djs` | They need DJs | `it looks like you’re actively booking DJs and I think he’d stand out` |

When a chip is active, **p3** includes: `I came across ${vn} — I think ${artistName} would be a great fit because ${because}.`

---

## Live script beats by card (`scriptBeatsForCard`)

Each block is a **list of lines** shown in the UI (operator reads top to bottom).

### `p1` — Who picked up?

**Branch A:** `d.call_purpose === 'follow_up'` **and** `n` is non-empty

1. `Hey${n ? `, ${n}` : ''}?`  
2. `This is ${managerFirst} — I called a little while back about ${artistName}.`  
3. `You told me to follow up around this time.`

**Branch B:** `n` non-empty (and not branch A, or follow_up without name — see code order: follow_up+n uses A first)

1. `Hey — I’m looking for ${n}.`  
2. `Is this them?`

**Branch C:** default (no usable first name)

1. `Hey — I’m trying to reach whoever handles entertainment or DJ bookings at ${vn}.`  
2. `Who would that be?`

---

### `p2a` — Gatekeeper

1. `No worries — I’m ${managerFirst}, I manage ${artistName}.`  
2. `We work with a lot of spots in the ${city} area.`  
3. `I wanted to connect with whoever handles your entertainment or DJ bookings.`  
4. `Could you point me in the right direction?`

---

### `p2a_detail` — Decision-maker details

1. `Perfect — I appreciate that.`  
2. `I’ll reach out to them directly.`  
3. `Thanks for your help.`

---

### `p2_msg` — Message left

1. `Could you let them know ${managerFirst} from ${artistName}’s team called?`  
2. `If they want to reach back, my number is ${phone}.`  
3. `Appreciate it.`

---

### `p3` — The pitch

Lines are built in order:

1. If `n`: `${n}, I appreciate you taking the call.`  
   Else: `I appreciate you taking the call.`  
2. `I’m ${managerFirst} — I manage ${artistName}.`  
3. `${credentialsLine}` with `.` ensured at end.  
4. If `because` non-empty: `I came across ${vn} — I think ${artistName} would be a great fit because ${because}.`  
   Else: `I came across ${vn} — I think ${artistName} would be a great fit for what you’re doing.`  
5. `Do you ever bring in guest DJs or try someone new on a night?`  
6. **Only if** `events` non-empty: `I saw you run ${events} — that lines up with what he does.`

---

### `p3b` — Pivot — guest DJs

1. `Totally makes sense — most venues have a core rotation.`  
2. `Do you ever bring in a guest DJ for special nights or when someone can’t make it?`  
3. `That’s usually where someone like ${artistName} fits — elevates the room without stepping on toes.`

---

### `p3c` — Graceful parking

`closeName` = `n ? `${n}, ` : ''`

1. `No worries at all — ${closeName}I’d love to stay on your radar for when timing’s right.`  
2. `Cool if I send ${artistName}’s info so you have it on file?`

---

### `p4a` — Their event nights

1. `That’s great to hear.`  
2. `What nights do you typically run events or bring in DJs?`

---

### `p4b` — Music & crowd

1. `What kind of music does the crowd lean toward on those nights?`  
2. `What’s the vibe?`

---

### `p4c` — How they book

1. `How does booking usually work here?`  
2. `Do you handle that directly, or is there someone else I should talk to?`

---

### `p4d` — Budget (strong signal only)

1. `Just so I can put something sensible together —`  
2. `what do you typically budget for a DJ on those nights?`

---

### `p4e` — Capacity & venue type

1. `Roughly how big is the room — capacity-wise?`

---

### `p5` — The ask

`night` = `d.event_nights[0]` or the literal `'your event nights'` (first selected weekday string, e.g. `Monday`).

**Branch:** `d.call_purpose === 'upcoming_event'`

1. `I think ${artistName} would be strong for an event you’ve got coming up.`  
2. `What does it look like to get him on the lineup?`

**Branch:** `d.call_purpose === 'one_time'`

1. `I think ${artistName} would crush it for a night you’ve got coming up.`  
2. `What does getting him on the lineup look like?`

**Branch:** `d.call_purpose === 'residency'`

1. `Here’s what I’m thinking${n ? `, ${n}` : ''} — ${artistName} would be a strong fit for your ${night} nights.`  
2. `What would a trial night look like so you can see what he brings?`

**Branch:** default (other / empty purpose)

1. `Would you be open to ${artistName} coming through for a night — even as a trial?`  
2. `No long-term lock-in — just one night to prove value.`

---

### `p6` — Close

Let `t = d.operator_temperature || d.final_temperature`.

| `t` | Beats |
|-----|--------|
| `dead` | `I appreciate your time.` / `If anything changes, feel free to reach out.` / `Have a good one.` |
| `cold` | `No worries at all.` / `I’ll follow up down the road if timing gets better.` / `Thanks for your time${n ? `, ${n}` : ''}.` |
| `warm` | `I’ll send ${artistName}’s info now so you’ve got it.` / `I’ll follow up soon to see where things stand.` / `Appreciate your time${n ? `, ${n}` : ''}.` |
| `hot` | `I’ll put something together this week — dates, rates, the works.` / `I’ll follow up to lock it in.` / `Appreciate you${n ? `, ${n}` : ''}.` |
| `converting` | `Let’s do it.` / `If you’ve got a few minutes, I can walk you through details and get the date locked.` |
| *(anything else / empty)* | `Thanks again for the time — I’ll follow up with next steps.` |

---

### `p6_vm` — Voicemail

**Branch:** `n` non-empty

1. `Hey ${n} — this is ${managerFirst}, I manage ${artistName}.`  
2. `${credentialsLine without trailing period}, and I came across ${vn}.`  
3. `I think he’d be a great fit for what you’re doing.`  
4. `Would love to connect quick — my number is ${phone}.`  
5. `Again, ${managerFirst} with ${artistName} — talk soon.`

**Branch:** no name

1. `Hey — this is ${managerFirst}, I manage ${artistName}.`  
2. `${credentialsLine with period enforced}.`  
3. `I’m reaching out to ${vn} because I think he’d be a strong addition to your lineup.`  
4. `If whoever handles entertainment could call me at ${phone}, I’d appreciate it.`  
5. `${managerFirst} with ${artistName}. Thanks.`

---

### `p6_na` — No answer

1. `No answer.`  
2. `Try again later or follow up another way when it makes sense.`

---

## Legacy helper

`scriptForCard(card, d, managerPhone)` in `liveCardCopy.ts` joins the same beats with spaces; it builds context with `coldCallScriptContext(null)` (no profile), so **artist/manager defaults apply** unless `managerPhone` overrides phone.

---

## Related: weekday labels (feed **p4a** UI + **p5** `night`)

`COLD_CALL_WEEKDAY_LABELS`: `Monday` … `Sunday` (see `coldCallPayload.ts`). Selected values are stored in `d.event_nights`; the script uses the **first** entry for residency wording.
