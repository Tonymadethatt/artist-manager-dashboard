# Call intake — field & ecosystem spec (handoff for AI)

This document describes **everything the product already knows how to store** for **venues**, **contacts**, and **deals**, plus the **pricing calculator** and **show recap (promise) lines**. Use it to design a **new intake UX**: questions, sections, control types (dropdown, multi-select, toggles, time, currency, etc.), and **official answer options** where the app uses fixed enums.

**Design goals (from product owner)**  
The intake experience must work **during a live phone call**. The operator is scrolling while listening—not hunting through a long script interleaved with tiny fields. Prefer:

- **Short, labeled sections** with **predictable order** (same order every time).
- **One screen-height “chunk” per topic** where possible (e.g. “Venue identity”, “Show date & times”, “Money & calculator”, “Travel”, “Contacts”).
- **Tap targets and pre-baked options** (dropdowns / toggles) over free text when the answer must land in a typed field.
- Clear **visual separation** between “script / coaching” copy and “data capture” controls (or drop script from the intake surface if it lives elsewhere).

This file does **not** prescribe final copy or layout; it lists **variables, types, legal values, and destinations**.

---

## 1. Product context

**App:** Artist Manager dashboard (React + Vite, Supabase Postgres + Auth).  
**Key surfaces:**

| Surface | Path (approx.) | Role |
|--------|----------------|------|
| Outreach | `/outreach` | Venue list, add/edit venue (`VenueDialog`), contacts on venue |
| Earnings | `/earnings` | Deals: log/edit show, gross, commission, pricing calculator, recap tab |
| Forms → Intake | `/forms/intake` | Persisted intakes: `booking_intakes` + `booking_intake_shows` (JSON blobs today) |
| Settings / profile | `/settings` | `artist_profile` (artist name, manager, emails, phone, etc.) |

**Intake persistence (current schema):**

- `booking_intakes`: one row per “call session” / workspace; `venue_data` JSON + `title`, `schema_version`, timestamps.
- `booking_intake_shows`: many rows per intake; `show_data` JSON + `label`, `sort_order`, optional `imported_deal_id` after a deal is logged.

Imports today: **Outreach** can seed **Add venue** from an intake; **Earnings** can seed **Log deal** from a chosen show draft. Any new intake schema should still map cleanly to **`Venue`**, **`Contact[]`**, and **deal form + `computeDealPrice` + `pricing_snapshot`**.

---

## 2. Time & calendar rules (deals)

- Deal **event** and **performance** times in the UI are captured as **Pacific “wall”** date (`YYYY-MM-DD`) + **local time** (`HH:mm`).  
- On save, the app converts to UTC ISO for `event_start_at`, `event_end_at`, `performance_start_at`, `performance_end_at` (see `pacificWallToUtcIso`, `addCalendarDaysPacific` when end time is before start on the same calendar day).
- **Weekend pricing hint:** `computeDealPrice` / `pickDefaultServiceId` treat **Friday–Sunday** (UTC weekday from `YYYY-MM-DD`) as “weekend” for catalog `PricingService.dayType`.

Intake should collect **enough** to reproduce: show date, event start/end (or “doors” vs “set” if you model that way), performance set start/end, and timezone assumptions must match **Pacific** unless the product changes.

---

## 3. Venue — database / `Venue` modelAll fields below are **first-class** on `venues` (or nested JSON). Labels shown are user-facing where defined in code.

| Field | Type | Notes |
|-------|------|--------|
| `name` | string | Required for save |
| `location` | string \| null | Street line 1; used for calendar / maps |
| `city` | string \| null | |
| `address_line2` | string \| null | Unit, suite, floor |
| `region` | string \| null | State / province |
| `postal_code` | string \| null | |
| `country` | string \| null | |
| `venue_type` | enum | See **§3.1** |
| `priority` | number | Typically **1–5** (stars in UI) |
| `status` | enum | See **§3.2** (outreach pipeline) |
| `outreach_track` | enum | See **§3.3** — affects **commission behavior** on deals |
| `follow_up_date` | `YYYY-MM-DD` \| null | |
| `capacity` | string \| null | Free text (e.g. “500”, “~200 standing”) — agreements / deal form |
| `deal_terms` | JSON \| null | Legacy / optional structured snippet — see **§3.4** |

### 3.1 `VenueType` — official values

| Value | Label |
|-------|--------|
| `bar` | Bar |
| `club` | Club |
| `festival` | Festival |
| `theater` | Theater |
| `lounge` | Lounge |
| `other` | Other |

**Order for dropdowns:** `bar`, `club`, `festival`, `theater`, `lounge`, `other`.

### 3.2 `OutreachStatus` — official values

| Value | Label |
|-------|--------|
| `not_contacted` | Not Contacted |
| `reached_out` | Reached Out |
| `in_discussion` | In Discussion |
| `agreement_sent` | Agreement Sent |
| `booked` | Booked |
| `performed` | Performed |
| `post_follow_up` | Post Follow-Up |
| `rebooking` | Rebooking |
| `closed_won` | Closed - Won |
| `closed_lost` | Closed - Lost |
| `rejected` | Rejected |
| `archived` | Archived |

**Default for new venue from cold intake:** often `not_contacted` unless you know better.

### 3.3 `OutreachTrack` — official values (critical for money)

| Value | Label | Meaning |
|-------|--------|--------|
| `pipeline` | Pipeline | Manager-sourced; normal commission tiers apply on deals |
| `community` | Community | Artist’s existing network; **booking commission is forced to `artist_network` (0%)** on save when venue is linked — gross still tracked |

Intake should capture **which world this lead is** so imports don’t fight Earnings logic.

### 3.4 `DealTerms` (optional on venue)

JSON shape (all optional strings/number):

- `event_date`, `pay`, `set_length`, `load_in_time`, `notes`

Useful if you want intake to capture “rough terms” before a deal exists; not all intake answers must map here.

---

## 4. Contact — `contacts` model

Each contact belongs to one `venue_id`.

| Field | Type |
|-------|------|
| `name` | string (required) |
| `role` | string \| null |
| `email` | string \| null |
| `phone` | string \| null |
| `company` | string \| null |

Intake should support **0..N** contacts and map to this shape on **Import to Outreach** (batch insert after venue create).

---

## 5. Deal — `deals` model & logging form

### 5.1 Core deal fields (high level)

| Field | Type | Notes |
|-------|------|--------|
| `description` | string | Deal title / show description |
| `venue_id` | uuid \| null | Links to venue; drives community tier behavior |
| `event_date` | `YYYY-MM-DD` \| null | Pacific date; also legacy when times missing |
| `event_start_at`, `event_end_at` | timestamptz \| null | Built from Pacific date + time |
| `performance_genre` | string \| null | Free text |
| `performance_start_at`, `performance_end_at` | timestamptz \| null | Set window vs event window |
| `onsite_contact_id` | uuid \| null | Must be a contact on the selected venue |
| `gross_amount` | number | **Required** > 0 to save |
| `commission_tier` | enum | See **§5.2**; may be **clamped** on save if venue is `community` |
| `payment_due_date` | `YYYY-MM-DD` \| null | |
| `notes` | string \| null | |
| `venue_capacity` | mirrored in form | Often synced to `venues.capacity` on save from deal form |
| `promise_lines` | JSON | Recap commitments — see **§7** |
| `pricing_snapshot` | JSON | Output of calculator + metadata — see **§6** |
| `deposit_due_amount`, `deposit_paid_amount` | numbers | From policies + snapshot / manual |
| `agreement_url`, `agreement_generated_file_id` | optional | Post-intake workflow |

Calendar / Google fields (`event_cancelled_at`, `google_shared_calendar_event_id`, etc.) are **not** intake-first; ignore for call script unless you explicitly track cancellation on the call.

### 5.2 `CommissionTier` — official values

| Value | Label | Default rate (booking commission) |
|-------|--------|-------------------------------------|
| `new_doors` | New Doors | 20% |
| `kept_doors` | Kept Doors | 20% |
| `bigger_doors` | Bigger Doors | 10% |
| `artist_network` | Artist network | 0% (community / network) |

**Rule:** If the linked venue’s `outreach_track` is `community`, saved deals use **`artist_network`** for commission tier regardless of UI selection (non–artist_network selections are normalized on save).

### 5.3 `PaymentMethod` (retainers / payments — optional on intake)

| Value | Label |
|-------|--------|
| `cash` | Cash |
| `paypal` | PayPal |
| `zelle` | Zelle |
| `apple_pay` | Apple Pay |
| `venmo` | Venmo |
| `check` | Check |
| `other` | Other |

Useful if intake captures “how they pay” before it lands in notes or a future invoice flow.

---

## 6. Pricing catalog & calculator (`computeDealPrice`)

Catalog is **per user**, stored in `user_pricing_catalog.doc` as `PricingCatalogDoc`:

- `packages[]` — each: `id`, `name`, `price` (USD whole dollars), `hoursIncluded`, `bullets[]`
- `services[]` — each: `id`, `name`, `price`, `priceType`: `per_hour` | `flat_rate`, `dayType`: `weekday` | `weekend` | `any`
- `addons[]` — each: `id`, `name`, `price`, `priceType`: `flat_fee` | `per_event` | `per_artist` | `per_sq_ft` | `per_effect` | `per_setup`, optional `unitLabel`
- `discounts[]` — each: `id`, `name`, `percent` (whole percent), optional `clientType`
- `surcharges[]` — each: `id`, `name`, `multiplier` (e.g. 1.35 = +35%)
- `policies` — `defaultDepositPercent`, `salesTaxPercent`, `minimumBillableHours`

### 6.1 `ComputeDealPriceInput` (what intake must be able to feed)

| Key | Type |
|-----|------|
| `catalog` | full `PricingCatalogDoc` (from live user catalog) |
| `eventDate` | `YYYY-MM-DD` \| null |
| `baseMode` | `package` \| `hourly` |
| `packageId` | string \| null — must match a catalog package `id` |
| `serviceId` | string \| null — must match a catalog service `id` |
| `overtimeServiceId` | string \| null — hourly service used for package overtime hours |
| `performanceHours` | number (billable / performance duration for calc) |
| `addonQuantities` | `Record<addonId, number>` — non-negative integers |
| `surchargeIds` | string[] — valid surcharge ids |
| `discountIds` | string[] — valid discount ids |

**Important:** Package/service/addon/surcharge/discount **ids are user-defined** (not global enums). The intake UI should **load the live catalog** and offer **dropdowns/checkboxes** bound to those ids. If ids go stale, imports should warn and fall back (existing mapper pattern).

### 6.2 `DealPricingSnapshot` (persisted on deal after save)

Version `v: 1`. Includes:

- `finalSource`: `calculated` \| `manual`
- Money breakdown fields: `subtotalBeforeTax`, `taxAmount`, `total`, `depositDue`, `lastCalculatedTotal`
- Full calculator inputs mirror: `baseMode`, `packageId`, `serviceId`, `overtimeServiceId`, `performanceHours`, `addonQuantities`, `surchargeIds`, `discountIds`
- `computedAt` ISO timestamp

Intake does not need to store the snapshot until deal save; it needs to store **enough inputs** to re-run `computeDealPrice` on import.

---

## 7. Show recap / promise lines (`promise_lines`)

Deals store **`DealPromiseLinesDocV2`** (preferred):

```text
{ v: 2, venue: { lines: DealPromiseLine[] }, artist: { lines: DealPromiseLine[] } }
```

**Venue-side preset catalog** (stable ids — use for toggles / multi-select in intake):

| Preset id | Label | “Major” if answer is No |
|-----------|--------|---------------------------|
| `guaranteed_fee` | Guaranteed fee | yes |
| `pa_sound` | PA and sound | yes |
| `stage_lighting` | Stage and lighting | yes |
| `set_times` | Set times and curfew | yes |
| `load_in` | Load-in and soundcheck | no |
| `merch_terms` | Merch terms | no |
| `hospitality` | Hospitality | no |
| `lodging` | Lodging | no |
| `parking` | Parking and access | no |
| `marketing` | Marketing / promo | no |
| `guest_list` | Guest list and comps | no |

**Artist-side preset catalog** (`ARTIST_SHOW_REPORT_PRESETS`) — if intake captures artist commitments:

| Preset id | Label |
|-----------|--------|
| `artist_on_time` | On time for load-in and show |
| `artist_gear` | Gear prepared and functional |
| `artist_backup` | Backup plan if gear fails |
| `artist_professional` | Professional with staff and crowd |
| `artist_comm` | Communication with venue / promoter |
| `artist_music` | Music plan / requests handled |

Custom lines: deal form allows **custom recap lines** per side; intake can collect free text lines to merge into `buildPromiseLinesDocV2FromUi` patterns later.

---

## 8. Artist profile (`artist_profile`) — for personalization only

Not venue/deal storage, but intake **script personalization** uses:

- `artist_name`, `artist_email`
- `manager_name`, `manager_title`, `manager_email`, `manager_phone`
- `company_name`, `website`, `phone`, `social_handle`, `tagline`, `from_email`, `reply_to_email`

---

## 9. Suggested topic buckets for a call-friendly intake (non-prescriptive)

Group questions so operators can **jump to a section** without reading a linear script:

1. **Call meta** — intake title, client first name / company, call date (optional).
2. **Venue identity & location** — maps to §3 address fields + `venue_type` + `capacity`.
3. **Pipeline vs community** — `outreach_track` + maybe `priority` + `follow_up_date` + `status`.
4. **People** — contacts (§4); who invoices; billing email; on-site tech.
5. **Show / engagement** — `description`, `performance_genre`, `event_date`, event times, performance times.
6. **Money** — `commission_tier` (if pipeline), calculator mode, package/service, hours, add-ons, surcharges, discounts, rough gross, deposit conversation, `payment_due_date`.
7. **Logistics** — travel, lodging, gear provided vs BYO, load-in/soundcheck, parking — many map to **notes** or **promise preset toggles** (§7).
8. **Recap commitments** — toggle venue presets; optional artist presets; custom bullets.
9. **Follow-ups** — what’s still unknown; `notes` fields.

Each bucket should expose **only** the controls needed for that bucket so scrolling is **local**, not global.

---

## 10. Mapping cheat sheet (intake → save targets)

| Intake concept | Typical destination |
|----------------|---------------------|
| Venue name, address, city, region, postal, country | `venues.*` |
| Indoor/outdoor, parking, gear — if not separate columns | `venues.notes` / intake `freeText` / deal `notes` |
| Booker / tech / invoice contact | `contacts` rows |
| Show title, genre, date, times | `deals` + Pacific conversion |
| Calculator selections | `ComputeDealPriceInput` → `pricing_snapshot` |
| “What we promised” checklist | `promise_lines` preset toggles + custom lines |
| Community vs pipeline | `venues.outreach_track` + deal `commission_tier` rules |
| Guest count / capacity | `venues.capacity` and/or deal form `venue_capacity` |

---

## 11. Files in repo (for implementer)

| Area | Path |
|------|------|
| Types & enums | `src/types/index.ts` |
| Intake JSON shapes (current) | `src/lib/intake/intakePayload.ts` |
| Venue import mapper | `src/lib/intake/mapIntakeToVenue.ts` |
| Deal import mapper | `src/lib/intake/mapIntakeToDealForm.ts` |
| Pricing math | `src/lib/pricing/computeDealPrice.ts` |
| Recap presets | `src/lib/showReportCatalog.ts` |
| Venue form UI | `src/components/outreach/VenueDialog.tsx` |
| Deal form UI | `src/pages/Earnings.tsx` |
| Intake page (to be redesigned) | `src/pages/IntakeForms.tsx` |
| DB migration (intake tables) | `supabase/migrations/049_booking_intakes.sql` |

---

## 12. Open design decisions (for the next AI + product owner)

- Should **script / coaching** live **outside** the intake scroll (e.g. collapsible, separate tab, or print PDF) so intake is **purely data**?
- Do you need **one page per section** with **sticky section nav** on mobile?
- Which questions are **mandatory before Import** vs optional notes?
- Do you need **duplicate detection** (same venue name + date) warnings?
- Should **catalog ids** be snapshotted as **labels** in intake JSON for human-readable exports when ids drift?

---

*Generated for handoff: aligns with Artist Manager codebase as of this document’s authoring. Update enums if `src/types/index.ts` changes.*
