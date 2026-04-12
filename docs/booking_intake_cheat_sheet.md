# Booking intake v3 — implementation cheat sheet

**Use this for:** quick orientation before changing code.  
**Authoritative product spec:** [booking_intake_spec_v3.md](./booking_intake_spec_v3.md) — field labels, talking points, segues, and edge cases live there first.

---

## What it is

- **Pre-call:** scrollable form on `/forms/intake`, typing allowed, **Begin Call** flips to live.
- **Live:** one **section card** at a time; taps only (toggles, selects, date/time pickers, chips). Auto-save.
- **Post-call:** after **End call** (`session_mode: post_call`), tabs **`8A`–`8C`** — flagged-field typing, general notes, import preview. `view_section` drives the tab (`POST_CALL_SECTION_ORDER` in `intakePayloadV3.ts`).

---

## Data model

| Where | What |
|--------|------|
| `booking_intakes.venue_data` | Shared: contact, pipeline, `multi_show` / `show_count`, **navigation** (`view_section`, `last_active_section`, `session_mode`), **`same_for_all_*`** toggles per subsection |
| `booking_intake_shows.show_data` | Per-show JSON: event, performance, etc. (extends as new phases ship) |
| `booking_intake_shows.label` | Show label (e.g. from date); updated from live flow when dates change |

**Types & parsing:** `src/lib/intake/intakePayloadV3.ts` (`BookingIntakeVenueDataV3`, `BookingIntakeShowDataV3`, `parseVenueDataV3`, `parseShowDataV3`, `LIVE_SECTION_ORDER`, titles, helpers).

**CRUD + debounce:** `src/hooks/useBookingIntakes.ts`.

**UI:** `src/pages/BookingIntakePage.tsx`.

**Deal import (v3):** `src/lib/intake/mapIntakeToDealForm.ts` (`mapShowBundleToEarningsImport` — optional `venueMeta` for post-call notes + deposit-paid-on-call). **Venue import:** `src/lib/intake/mapIntakeToVenue.ts` (pass **primary show** for post-captured address / name / capacity).

---

## Live navigation (jump-and-return)

- **`last_active_section`** = bookmark (progress). Updated by **Next** and **Begin Call**, **not** by sidebar clicks.
- **`view_section`** = what is on screen. Sidebar sets this when jumping.
- **Return** pill when `view_section !== last_active_section`.
- **Sidebar phase index:** first character of section id → phase bucket (`1*` → Opening, `2*` → Event, `3*` → Performance, …). Unknown stubs: `__stub_N` → phase `N - 1`.
- **Sidebar jump map (current code):** phase **0 → `1A`**, **1 → `2A`**, **2 → `3A`**, **3 → `4A`**, **4 → `5A`**, **5 → `6A`**, **6+ → stub** until those phases ship.

---

## Multi-show + “same for all”

- Defaults and which subsections are per-show are defined in the **full spec** (multi-show table). In code, flags on **`venue_data`** look like `same_for_all_2a` … `same_for_all_3c` (more added as phases ship).
- **Single show** or **same for all on:** one field group. **Off:** repeat per show with **color dot** + label.
- Replication when toggling “same for all” on or editing under sync: `applyShowPatch`, `pick*`, `onSameForAllChange` in `BookingIntakePage.tsx`.

---

## Implemented live path (check repo)

- **Full linear list:** `LIVE_SECTION_ORDER` in `intakePayloadV3.ts` (through **`7C`**; **End call** sets `post_call`, `view_section:8A`).
- **Next/Back use:** `livePathSections(primaryStateRegion)` — same as `LIVE_SECTION_ORDER` **except** section **`4E` is omitted** when the **first show’s** `state_region` is **`CA`** (California), per spec skip rule. Bookmark/view are corrected if they pointed at `4E` when the path drops it.
- **Money path:** **`5A`–`5D`** are **always per show** (no `same_for_all` flags). **`5E` Invoicing** lives on **`venue_data`** (shared).

**Next disabled on `7C`:** operator must use **End call** (Next does not advance past close). When `view_section` is **`7C`** and bookmark matches, footer hints to use End call.

### Phase 7 (Close) — implemented summary

| Section | Storage | Notes |
|---------|---------|--------|
| 7A Next steps | `venue_data` | `send_agreement`, `deposit_on_call`, `client_energy` |
| 7B Follow-ups | `venue_data` | `has_follow_ups`, `follow_up_date`, `follow_up_topics` |
| 7C End call | `venue_data` | `call_status`, `call_ended_at`; **End call** → `suggested_outreach_status`, `session_mode: post_call`, `view_section: 8A` |

### Phase 8 (Post-call) — implemented summary

| Section | Storage | Notes |
|---------|---------|--------|
| 8A Flagged fields | `venue_data` + `show_data` | Text/textarea keys: `event_name_text`, `venue_name_text`, `city_text`, `street_address`, `address_line2`, `postal_code`, `exact_capacity_number`, `music_requests_text`, `custom_setlist_notes` (when 3B setlist = specific requests), `equipment_details_text`, `parking_details_text`, `travel_notes_text`; venue: `onsite_contact_*`, `invoice_*_text`, `billing_contact_*`; Phase 1 confirm patches `contact_*` when flags asked for updates. Post-call nav: sidebar waypoints **8A / 8B / 8C** (mirror live-call shell). |
| 8B General notes | `venue_data` | `post_call_notes`, `future_intel`, `red_flags` |
| 8C Import preview & actions | `venue_data.post_import_venue_id` | **Import venue to Outreach** (create + contacts, or update existing / `post_import` venue). **Import as deal** / **Import all** call `importDealFromIntakeShow.ts` (same payload shape as Earnings save: promise doc, pricing snapshot, calendar side effects). Requires pricing catalog for deals. |

**Parse hygiene:** `finalizeShowPostCaptures` / `finalizeVenuePostCaptures` clear orphan post-capture strings when live flags no longer require them.

---

## Phase 4 (Technical & logistics) — implemented summary

| Section | Storage | “Same for all” default (multi-show) |
|---------|---------|--------------------------------------|
| 4A Equipment | `show_data` | Yes (`same_for_all_4a`) |
| 4B On-site contact | **`venue_data`** (`onsite_*`) | n/a |
| 4C Load-in / soundcheck | `show_data` | No (`same_for_all_4c`) |
| 4D Parking / access | `show_data` | Yes (`same_for_all_4d`) |
| 4E Travel / lodging | `show_data` | Yes (`same_for_all_4e`) |

**Conditionals in UI:** 4B flags only if “different person”; 4C load-in time only if load-in “yes”; 4E lodging + travel notes only if travel is not “local.”

### Phase 5 (Money) — implemented summary

| Section | Storage | Multi-show |
|---------|---------|------------|
| 5A Pricing setup | `show_data` | Per show always |
| 5B Add-ons / surcharges / discounts | `show_data` | Per show always |
| 5C The number (calculator + manual gross) | `show_data` | Per show always |
| 5D Deposit, balance timing, payment methods | `show_data` | Per show always |
| 5E Invoicing | **`venue_data`** | Shared |

**Catalog:** `usePricingCatalog` + `computeDealPrice` / `computeDealPriceBreakdown` (same as Earnings). **Import:** `mapIntakeToDealForm.ts` maps v3 money fields into deal form + pricing state.

### Phase 6 (Venue commitments) — implemented summary

| Section | Storage | Multi-show |
|---------|---------|------------|
| 6A Venue promise lines | `show_data` (`promise_lines_v3`, `promise_lines_auto`) | Default **same for all** (`same_for_all_6a` on `venue_data`) |

Preset ids match **`SHOW_REPORT_PRESETS`** / deal `promise_lines`. **Auto** suggestions: `suggestedPromiseLinesFromEarlierPhases` (Phases 3A–5). **Import:** `promisePresetsFromVenueLinesV3` in `mapIntakeToDealForm.ts`.

**Later polish:** richer missing-field warnings on venue preview; optional onsite contact resolution to `onsite_contact_id` on import.

---

## Quick hygiene when editing

- Run `npx tsc -b --noEmit` before commit.
- Extend **`emptyVenueDataV3` / `emptyShowDataV3` / `parse*`** whenever you add fields so old rows don’t break.
- Keep **live-call** fields tappable-only per spec (no free text in live mode except where spec allows pickers).

---

*Last aligned with codebase: April 2026. Update this file when `LIVE_SECTION_ORDER` or major behaviors change.*
