# Intake → ecosystem testing checklist

Use this **in order**. Each section tells you **what to do once**, then **where to verify** so you are not re-reading the same screen five times.

**Legend:** `[ ]` = not done · `[x]` = passed

---

## 0. Preconditions (one-time)

- [ ] **Pricing catalog** has at least one package or hourly rate (deal import requires it).
- [ ] You can log in and open **Booking intake**, **Outreach** (venues + contacts + activity), **Earnings** (deals), and **File Builder** (agreements).
- [ ] Pick **two** test scenarios you will run:
  - **Scenario A — New venue:** intake with `venue_source = new` (no existing Outreach venue).
  - **Scenario B — Existing venue:** intake linked to a venue that already has **1–2 contacts** in Outreach (so matching/upsert is realistic).

---

## 1. Scenario A — New venue (full pipe)

### 1.1 Fill intake (single pass — cover as many areas as you can)

**Venue-level (shared)**

- [ ] Pre-call / opening: inquiry source, inquiry summary, pre-call notes, known venue/city/date/type (if shown).
- [ ] Primary contact: name, email, phone, company/role; use **“different person on call”** once with name + title bucket.
- [ ] Phone/email **confirmed / update needed / need email** chips so Phase 1 confirmation lines exist.
- [ ] On-site: **different** from main; fill name + phone; add **on-site role / connect method / connect window** if available.
- [ ] Venue access: flag + chips + optional “other” note.
- [ ] DJ parking chip.
- [ ] Invoicing: **different** billing path — invoice company/email flags + typed company/email + billing name/email (or link a billing contact if you use that flow).
- [ ] Close (Phase 7): send agreement path, deposit on call, client energy, follow-up topics + follow-up date, call status, close artifact tags.

**Show-level (at least one show; second show optional)**

- [ ] Event cadence, setting, venue archetype, **other** event type / **other** venue type text if applicable.
- [ ] Doors vs event start; mark **overnight** timing if your test date/time can cross midnight.
- [ ] Capacity range + exact capacity (for venue + deal capacity string).
- [ ] Music: setlist tags, delivery, lineup; **other performers / # acts / billing priority**.
- [ ] Equipment: provider, mic, sound tech (name or linked contact), hybrid/venue includes, **DJ package interest**, **hybrid add-ons**, **revisit production in §5B** if shown.
- [ ] Load-in / parking **status** + parking class; **lodging status**; travel booking + ground transport.
- [ ] Money: package or hourly, add-ons/surcharges/discounts as needed; **manual gross + reason** on one path if you want that in notes.
- [ ] Promise lines (Phase 6 / 8A grid): set several lines to non-empty values (drives deal `promise_lines`).

**Post-call (8B / 8A)**

- [ ] **8B:** post_call_notes, future_intel, red_flags (these should land in **deal notes** and **end-call activity** where applicable).
- [ ] **8A:** fix any flagged fields; adjust promise lines if needed.

### 1.2 End call- [ ] From live **Close**, click **End call** (moves to post-call).

### 1.3 Import venue (8C)

- [ ] **Import venue** (creates new Outreach venue).

**Verify — Outreach → venue record**

- [ ] Name, address fields, city/region/postal, type, capacity, follow-up date, status/track match preview.
- [ ] **`deal_terms`** on venue (if your UI shows it): event date / set length / load-in / short notes from inquiry+pre-call when present.

**Verify — Outreach → contacts**

- [ ] Primary contact row exists with expected name/email/phone/company.
- [ ] On-site contact exists when “different” + data captured.
- [ ] Billing contact exists when “different” + typed/link path (no obvious duplicate of primary if email matches).

**Verify — Outreach → activity / notes**

- [ ] New **activity** note with category **Booking intake** describing import (created venue).

### 1.4 Import deal(s) (8C)

- [ ] **Import as deal** (or **Import all**).

**Verify — Earnings → deal row**

- [ ] Description, date, event window, performance window, genre, gross, commission tier, deposit paid (if “paying now” on call), `payment_due_date` if custom balance date.
- [ ] **`onsite_contact_id`** populated when on-site was different and name/phone can match a contact (check deal detail if exposed; otherwise infer from File Builder onsite tokens below).

**Verify — Earnings → deal notes (long text)**

- [ ] Pricing/deposit **terms block** present.
- [ ] **Venue narrative**: inquiry/pre-call, Phase 1 confirmations, on-site logistics, invoicing flags + typed invoice/billing lines, Phase 7 close metadata, follow-up topics/date, 8B intel/concerns/post notes (as applicable).
- [ ] **Show narrative**: other event/venue type text, overnight line, performers/billing priority, equipment extras, parking/lodging status, etc.

**Verify — deal attachments to agreement world**

- [ ] `promise_lines` / recap reflects intake promise grid (venue recap in product UI if visible).

### 1.5 Agreement / File Builder (after deal exists)

- [ ] Open **File Builder** with **same venue + same deal** selected.
- [ ] Confirm tokens populate where expected:
  - [ ] **`deal_notes`** (from deal notes).
  - [ ] **Pricing summary** from `pricing_snapshot`.
  - [ ] **On-site** merge fields if deal has `onsite_contact_id` and contact has phone/email.
  - [ ] **Venue capacity** / **set length** style fields when driven from deal + venue snapshot.

---

## 2. Scenario B — Existing venue (sync + end-call activity)

### 2.1 Setup

- [ ] In Outreach, note **existing** contacts (emails/phones) you will **intentionally change** in intake.

### 2.2 Run intake linked to that venue

- [ ] Change primary email or phone **slightly** (or add second phone path) to test **update-not-insert**.
- [ ] Add **new** on-site or billing person not on roster (should **insert**).
- [ ] Fill a subset of Phase 7 + 8B notes so activity content is obvious.

### 2.3 End call (existing venue)

- [ ] **End call**.

**Verify — Outreach → activity**

- [ ] New **Booking intake** note on **existing** venue: call ended time, follow-up topics/date, post_call_notes / intel / concerns as included.

**Verify — Outreach → venue status (if applicable)**

- [ ] Venue **status** moved toward suggested close outcome when intake suggests agreement sent / in discussion (your product rules).

### 2.4 Import / re-import venue from 8C

- [ ] Run **Import venue** again (update path).

**Verify — contacts upsert**

- [ ] Matched contacts **updated** (not duplicated) when email/phone matches.
- [ ] New people **added** when no match.
- [ ] Local intake **contact chips** refresh if you rely on them after import.

**Verify — activity**

- [ ] Second intake note: **updated venue + synced contacts** wording.

### 2.5 Import deal

- [ ] Import at least one deal.

**Verify**

- [ ] Same deal notes richness as Section1.4.
- [ ] **On-site** resolution still sane when `onsite_linked_contact_id` or fresh sync created the row.

---

## 3. Focused edge cases (quick passes)

Run any that matter to you; each is **short**.

### 3.1 Contact matching

- [ ] Two derived contacts share **same email** → should converge to **one** row updated, not two inserts.
- [ ] Match on **phone only** (no email on new row) → updates correct row.

### 3.2 On-site link

- [ ] **Linked** on-site venue contact id in intake → deal `onsite_contact_id` = that id.
- [ ] **Typed** on-site only → after sync, deal gets id of **new or matched** contact.

### 3.3 Deal overlap warning

- [ ] Import deal for a time that **overlaps** an existing deal → confirm prompt, then **allow** or **cancel** as expected.

### 3.4 Failure tolerance

- [ ] **End call** still completes if activity note insert fails (e.g. offline) — you should still land in post-call.
- [ ] Venue **created** but contacts sync fails → message says so; **activity note** still attempted on new venue path (per implementation).

### 3.5 `deal_terms` / agreement defaults

- [ ] Venue has **no** primary show date → `deal_terms.event_date` may come from **known_event_date** only; confirm you’re OK with that.
- [ ] Change **set times** on show → re-import venue → venue snapshot **set_length** updates if your UI exposes it.

---

## 4. Sign-off (single screen)

When both scenarios pass, you’re done:

- [ ] **Venue** fields + **`deal_terms`** look right.
- [ ] **Contacts** created/updated without junk duplicates.
- [ ] **Deals** have **money + narrative + promise recap** aligned with intake.
- [ ] **Activity** shows **Booking intake** entries for end-call + imports.
- [ ] **File Builder** reflects **deal_notes**, **pricing**, and **onsite** when ids line up.

---

## 5. If something fails — what to capturePaste into an issue / follow-up:

1. **Scenario** (new vs existing venue) and **intake id** (from activity note or URL).
2. **Which checkbox section** failed (venue / contacts / deal / activity / agreements).
3. **Screenshot** of intake **8C preview** + the **wrong** Outreach/Earnings field.
4. Whether **contacts** in DB were **missing**, **duplicated**, or **not updated**.

This keeps debugging parallel to the code paths: `executeImportVenue`, `upsertIntakeVenueContactsForVenue`, `mapShowBundleToEarningsImport` / `substantive*`, `importDealFromIntakeShow`, `insertIntakeOutreachActivityNote`, `buildAgreementPrefill`.
