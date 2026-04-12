# BOOKING INTAKE FORM — DEFINITIVE BUILD SPEC
### Version 3.0 — April 12, 2026
### Type: INBOUND BOOKING — Client is already interested
### Purpose: Complete specification for implementation — hand this to any AI or developer
### Platform: Desktop and laptop only. No mobile or tablet support required.
### Design system: Reuse existing dashboard components, theming, and visual language. Nothing new.

---

## TABLE OF CONTENTS

1. [What This Is](#1-what-this-is)
2. [Page Architecture & Layout](#2-page-architecture--layout)
3. [The Three Modes](#3-the-three-modes)
4. [Sidebar Behavior](#4-sidebar-behavior)
5. [Path Flow Behavior (Main Content)](#5-path-flow-behavior-main-content)
6. [Jump-and-Return System](#6-jump-and-return-system)
7. [Skip / Conditional Logic](#7-skip--conditional-logic)
8. [Multi-Show System](#8-multi-show-system)
9. [Existing Venue Selector](#9-existing-venue-selector)
10. [Design Rules](#10-design-rules)
11. [Phase 0 — Pre-Call Prep](#11-phase-0--pre-call-prep)
12. [Phase 1 — The Opening](#12-phase-1--the-opening)
13. [Phase 2 — The Event: Big Picture](#13-phase-2--the-event-big-picture)
14. [Phase 3 — The Performance](#14-phase-3--the-performance)
15. [Phase 4 — Technical & Logistics](#15-phase-4--technical--logistics)
16. [Phase 5 — The Money Conversation](#16-phase-5--the-money-conversation)
17. [Phase 6 — Venue Commitments](#17-phase-6--venue-commitments)
18. [Phase 7 — The Close](#18-phase-7--the-close)
19. [Phase 8 — Post-Call Cleanup](#19-phase-8--post-call-cleanup)
20. [Dashboard Field Mapping Reference](#20-dashboard-field-mapping-reference)
21. [Conditional Logic Rules (Complete)](#21-conditional-logic-rules-complete)
22. [Segue Language Reference (Complete)](#22-segue-language-reference-complete)
23. [What This Spec Does Not Cover](#23-what-this-spec-does-not-cover)

---

## 1. WHAT THIS IS

This is the build specification for an **inbound booking intake form** — a tool used during live phone calls with clients who have already expressed interest in booking DJ Luijay. The operator (the artist's manager) uses this form to capture all booking details while on the phone, without ever having to stop the conversation to type.

### 1.1 Core Philosophy

- The client should feel like they are being **taken care of**, not interviewed.
- The operator should be able to give the client **maximum attention** — glance at the form, tap a response, and immediately return focus to the conversation.
- Every question flows naturally from the last, like a real conversation — not like jumping between unrelated form sections.
- When the call is over, the data captured should be enough to **immediately create a venue, contacts, and one or more deals** in the dashboard with minimal post-call cleanup.

### 1.2 What Makes This Different From a Normal Form

- Organized by **conversation flow**, not by data category.
- Has **three distinct modes** (pre-call, live-call, post-call) that change the interface behavior.
- Uses a **step-by-step path** during the live call — one section card at a time, not a scrolling page.
- Has a **jump-and-return system** for when the client mentions something out of order.
- Sections **appear or disappear** based on earlier answers (skip logic).
- Supports **multi-show intake** — a single call can capture up to 3 separate shows with a color-coded system.
- Supports **existing venue selection** to skip re-entering known venue and contact data.

---

## 2. PAGE ARCHITECTURE & LAYOUT

### 2.1 Dedicated Page

The intake form lives on its **own dedicated page**, separate from the main dashboard. When the operator starts an intake, they leave the dashboard and enter this focused environment. Suggested route: `/forms/intake/new` or `/intake/new`.

No dashboard navigation, sidebar, or other UI competes for attention on this page. Single-purpose environment.

### 2.2 Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│  [Top Bar — minimal: intake title + save + exit]         │
├────────────────┬─────────────────────────────────────────┤
│                │                                         │
│   SIDEBAR      │         MAIN CONTENT AREA               │
│   (left)       │         (center, constrained width)     │
│                │                                         │
│   Section      │   Current section card                  │
│   waypoints    │   rises into view as you progress       │
│                │                                         │
│   - Phase 0    │   ┌─────────────────────────────┐       │
│   - Phase 1    │   │  Section card with fields   │       │
│   - Phase 2    │   │  and talking points         │       │
│   - Phase 3    │   └─────────────────────────────┘       │
│   - Phase 4    │                                         │
│   - Phase 5    │   [Next →] button at bottom of card     │
│   - Phase 6    │                                         │
│   - Phase 7    │                                         │
│   - Phase 8    │                                         │
│                │                                         │
├────────────────┴─────────────────────────────────────────┤
│  [Bottom Bar — current phase label + progress]           │
└──────────────────────────────────────────────────────────┘
```

### 2.3 Dimensions

- **Sidebar:** ~220-260px fixed width. Always visible. Does not collapse.
- **Main content area:** Remaining width. Content is **centered and constrained** to max ~700-800px so the operator's eyes aren't scanning a wide screen. Cards should feel focused, not sprawling.
- **Top bar:** Minimal height. Contains intake title (editable, defaults to "[Contact Name] — Booking Intake"), Save button, Exit button (with unsaved changes warning).
- **Bottom bar:** Thin persistent bar showing current phase label and a subtle progress indicator (e.g., "Section 4 of 8" or a thin progress bar).

---

## 3. THE THREE MODES

The interface **transforms** between these modes sequentially. They are not tabs.

### 3.1 PRE-CALL MODE

**When:** Before the operator picks up the phone.
**Layout:** Traditional form layout. All pre-fill fields visible at once in scrollable grouped cards. Typing is fine.
**Contains:**
- Existing Venue Selector (see Section 9)
- All 🟡 PRE-FILL fields from Phase 0
- Multi-show toggle (see Section 8)
- **"Begin Call"** button at the bottom

**On "Begin Call":**
1. Saves all pre-call data.
2. Transitions interface to Live-Call Mode.
3. Activates sidebar with phase waypoints.
4. Displays Phase 1, Section 1A as the first card.
5. Sets `lastActiveSection = "1A"` for jump-and-return.
6. Pre-filled data auto-populates into talking point brackets and later fields.

### 3.2 LIVE-CALL MODE

**When:** After "Begin Call" is tapped.
**Layout:** Step-by-step path. One section card centered in main content at a time. Sidebar active with waypoints.
**Rules:**
- **Only tappable controls** — toggles, dropdowns, pickers, multi-select chips. NO free-text input.
- Any field needing typing becomes a **flag toggle** ("Capture after call: Yes/No") and the text input appears in Post-Call Mode.
- Jump-and-return is active.
- Skip logic is active.
- Multi-show controls are active on per-show sections (see Section 8).

### 3.3 POST-CALL MODE

**When:** After "End Call" is tapped in Phase 7.
**Layout:** Structured cleanup view. All flagged fields surfaced. Free-text typing available.
**Contains:**
- Flagged fields list (with context of which phase they came from)
- General notes section
- Import preview cards (venue + deal per show)
- Import action buttons

---

## 4. SIDEBAR BEHAVIOR

### 4.1 Waypoint Structure

Each phase gets one entry. Each shows:
- Phase icon or number
- Short label (e.g., "Opening," "Event," "Performance," "Technical," "Money," "Commitments," "Close")
- Status indicator:
  - ○ Not started
  - ◐ Partially complete
  - ● Complete
  - ⊘ Skipped (hidden by skip logic)

### 4.2 Current Position

Currently active section is **visually highlighted** (bold, accent color, background change). Highlight moves as operator progresses.

### 4.3 Clicking a Waypoint

Navigates to that section immediately. This initiates **jump-and-return** (see Section 6). Always clickable during Live-Call Mode. Skipped sections (⊘) are still clickable — clicking one un-skips it and shows the section.

### 4.4 Bookmark Indicator

When the operator has jumped away from their flow position, the sidebar shows a **bookmark icon** (📌 or similar) next to `lastActiveSection` so they always see where their progress point is.

### 4.5 Mode-Specific Display

- **Pre-Call Mode:** Sidebar can preview the full call flow (Phases 0-7) or only show Phase 0 sections. Either works.
- **Live-Call Mode:** Sidebar shows Phases 1-7.
- **Post-Call Mode:** Sidebar shows Phase 8 sub-sections (Flagged Fields, Notes, Import).

---

## 5. PATH FLOW BEHAVIOR (MAIN CONTENT)

### 5.1 Card-Based Progression

Each section is a **card** containing (top to bottom):

```
┌─────────────────────────────────────────┐
│  TALKING POINT                          │
│  (subtle, muted, italic — glanceable)   │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  [Same for all shows] toggle            │
│  (only on per-show sections, only if    │
│   multi-show is active)                 │
│                                         │
│  FIELD GROUP                            │
│  (toggles, dropdowns, pickers —         │
│   with show color indicators if          │
│   multi-show is active and "same for    │
│   all" is off)                          │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  SEGUE PREVIEW                          │
│  (very subtle — bridge to next topic)   │
│                                         │
│  [ Next → ]                             │
└─────────────────────────────────────────┘
```

### 5.2 Transition Animation

When "Next" is tapped:
- Current card **slides up and fades** (done — exits viewport upward).
- Next card **slides up from below** into center position.
- Smooth vertical movement — like walking forward on a path. Not a lateral slide, not a jarring page switch.

### 5.3 Going Back

- Click a section in the sidebar (triggers jump-and-return if mid-flow)
- Or press "← Back" button / swipe to go to the immediately previous section
- Previous card slides back down with all fields preserved.

### 5.4 Keyboard Shortcuts (recommended)

- `Enter` or `Tab` → advance to next section
- `Shift+Tab` → go back to previous section
- Number keys `1-7` → jump to that phase (same as sidebar click)

---

## 6. JUMP-AND-RETURN SYSTEM

### 6.1 Purpose

People don't talk in order. The client mentions venue capacity during the greeting. Without jump-and-return, the operator either remembers it (unreliable) or scrolls around and loses their place (disruptive). This system solves that.

### 6.2 How It Works

1. Operator is on **Section X** (current path position). System stores `lastActiveSection = X`.
2. Client mentions something relevant to **Section Y**. Operator clicks Section Y on sidebar.
3. Section Y appears in main content. A **floating return button** appears — **"↩ Return to [Section X name]"** — anchored to the bottom-right of the main content area or as a persistent floating pill. Visually prominent (accent color).
4. Operator taps relevant fields in Section Y.
5. Operator taps **"↩ Return"** button. Taken back to Section X. Path continues.

### 6.3 Rules

- `lastActiveSection` updates **only** via the "Next" button or the initial "Begin Call" action. Sidebar jumps never change it.
- The "↩ Return" button **only appears** when viewed section ≠ `lastActiveSection`.
- If the operator taps "Next" while in a jumped-to section, that section becomes the new `lastActiveSection` and the return button disappears. They've chosen to continue from here.
- The return button label always names the destination: "↩ Return to Performance Details" — never generic.
- The sidebar shows a **📌 bookmark icon** next to `lastActiveSection` whenever the operator is viewing a different section.

---

## 7. SKIP / CONDITIONAL LOGIC

### 7.1 How It Works

Certain answers **hide or show** later sections or fields. When a section is hidden:
- It does **not appear** in the path flow. "Next" skips over it.
- Sidebar waypoint shows as **⊘ Skipped** (grayed out, subtle "N/A" label).
- Still clickable in sidebar — clicking it un-skips and shows the section (operator override).
- If any field in a skipped section gets filled (via sidebar click), the section re-enters the flow.

### 7.2 Rules

All conditional rules are defined in [Section 21](#21-conditional-logic-rules-complete).

---

## 8. MULTI-SHOW SYSTEM

### 8.1 Overview

A single intake call can cover **up to 3 shows**. This happens when a client wants to book DJ Luijay for multiple dates or events. The venue and contact information is shared across all shows; the event-specific details (dates, times, set details, pricing) can differ per show.

### 8.2 Activation

In Phase 0 (Pre-Call Mode), there is a **multi-show toggle**:

| Field | Label | Type | Options | Default |
|-------|-------|------|---------|---------|
| `multi_show` | Multiple shows? | Toggle | `Single show` · `Multiple shows` | `Single show` |
| `show_count` | How many shows? | Dropdown | `2`, `3` | `2` |

`show_count` only appears if `multi_show` = `Multiple shows`.

The toggle can also be activated **during the call** (Live-Call Mode) if the client mentions additional shows mid-conversation. A persistent small control in the top bar or bottom bar allows the operator to switch from single to multi-show at any time without leaving their current section.

### 8.3 Color-Coding System

Each show gets a **color assignment**:

| Show | Color | Hex (suggested) | Label |
|------|-------|-----------------|-------|
| Show 1 | Blue | `#3B82F6` | Auto-generated from date, editable (e.g., "Apr 18 Show" or "Friday Set") |
| Show 2 | Purple | `#8B5CF6` | Same |
| Show 3 | Amber | `#F59E0B` | Same |

Show labels are **auto-generated** from the event date once entered (e.g., "Apr 18" or "Sat Apr 18"). If no date is entered yet, they default to "Show 1," "Show 2," "Show 3." Labels are editable at any time.

### 8.4 Which Sections Are Per-Show vs Shared

| Section | Per-Show or Shared | Rationale |
|---------|-------------------|-----------|
| Phase 0 — Pre-Call | Shared | Same client, same venue |
| Phase 1 — Opening | Shared | You greet them once |
| Phase 2A — Event Identity | Per-show (default: Same for all) | Usually same type but could differ |
| Phase 2B — When | **Per-show (default: Different per show)** | Dates and times almost always differ |
| Phase 2C — Where | Per-show (default: Same for all) | Usually same venue |
| Phase 2D — Scale | Per-show (default: Same for all) | Usually same capacity |
| Phase 3A — Role & Slot | **Per-show (default: Different per show)** | Set times and role can differ |
| Phase 3B — Music & Vibe | Per-show (default: Same for all) | Usually same genre |
| Phase 3C — Other Performers | Per-show (default: Same for all) | Usually same lineup context |
| Phase 4A — Equipment | Per-show (default: Same for all) | Usually same setup |
| Phase 4B — On-Site Contact | Shared | Same person for all shows |
| Phase 4C — Load-In | **Per-show (default: Different per show)** | Different times per show |
| Phase 4D — Access & Parking | Per-show (default: Same for all) | Usually same |
| Phase 4E — Travel & Lodging | Per-show (default: Same for all) | Usually same |
| Phase 5A-5D — Pricing & Payment | **Per-show (always different)** | Each show gets its own pricing calculation. No "Same for all" toggle on pricing sections. |
| Phase 5E — Invoicing | Shared | Same billing entity |
| Phase 6 — Promise Lines | Per-show (default: Same for all) | Usually same commitments |
| Phase 7 — Close | Shared | You close the call once |

### 8.5 "Same for All Shows" Toggle

On **per-show sections**, a toggle appears at the top of the section card:

**[ Same for all shows ]** — a single toggle switch.

- **On (default for most sections):** One set of fields. The answer applies to all shows. No color indicators needed.
- **Off:** The fields **duplicate** per show. Each set of fields is prefixed with a **colored dot** (●) matching the show's assigned color. The show label appears next to the dot (visible on hover or always visible if space allows).

**Visual example when "Same for all" is OFF on a 2-show intake:**

```
┌─────────────────────────────────────────┐
│  TALKING POINT                          │
│                                         │
│  [Same for all shows: OFF]              │
│                                         │
│  ● Apr 18 (blue dot)                    │
│  ┌─────────────────────────────────┐    │
│  │ Set start: [3:00 AM]           │    │
│  │ Set end:   [4:00 AM]           │    │
│  │ Set length: 1 hr (auto)        │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ● Apr 25 (purple dot)                  │
│  ┌─────────────────────────────────┐    │
│  │ Set start: [11:00 PM]          │    │
│  │ Set end:   [1:00 AM]           │    │
│  │ Set length: 2 hrs (auto)       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [ Next → ]                             │
└─────────────────────────────────────────┘
```

### 8.6 Pricing Sections (Always Per-Show)

Phases 5A through 5D (pricing mode, add-ons, the number, deposit/payment) are **always per-show** when multi-show is active. There is no "Same for all" toggle on these sections. Each show gets its own full pricing calculation because:
- Different dates may trigger different service rates (weekday vs weekend)
- Different set lengths change the hourly calculation
- Different add-ons or surcharges may apply
- Each show results in a separate `pricing_snapshot` and `gross_amount`

When multi-show is active, the pricing sections display all shows on one card with clear color-coded separation (same visual pattern as above — colored dots with show labels).

### 8.7 How Multi-Show Data Is Stored

Each show becomes its own row in `booking_intake_shows`:
- `intake_id` → parent intake
- `label` → show label ("Apr 18 Show")
- `sort_order` → 1, 2, or 3
- `show_data` → JSON blob containing all per-show field values
- `imported_deal_id` → null until imported as a deal

Shared data (venue, contacts, general notes) lives on the parent `booking_intakes` row in `venue_data`.

### 8.8 Importing Multi-Show Deals

In Phase 8 (Post-Call), the import section shows **one deal preview card per show**, each color-coded:

```
┌─ ● Show 1: Apr 18 (blue) ──────────────┐
│  Event: After-Party at [venue]          │
│  Set: 3:00-4:00 AM (1 hr)              │
│  Gross: $1,150                          │
│  [ Import as Deal ]                     │
└─────────────────────────────────────────┘

┌─ ● Show 2: Apr 25 (purple) ────────────┐
│  Event: Club Night at [venue]           │
│  Set: 11:00 PM-1:00 AM (2 hrs)         │
│  Gross: $2,000                          │
│  [ Import as Deal ]                     │
└─────────────────────────────────────────┘
```

Each show can be imported independently. The venue import happens once (shared). Each deal import pulls from that specific show's data.

---

## 9. EXISTING VENUE SELECTOR

### 9.1 Position

At the **very top of Pre-Call Mode**, before any Phase 0 fields. This is the first thing the operator sees when starting a new intake.

### 9.2 Layout

```
┌─────────────────────────────────────────┐
│                                         │
│  VENUE SOURCE                           │
│  ○ New venue    ● Existing venue        │
│                                         │
│  [Search venues... 🔍]                  │
│  ┌─────────────────────────────────┐    │
│  │ Club XYZ — Los Angeles, CA     │    │
│  │ The Warehouse — Bermuda Dunes  │    │
│  │ ...                             │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### 9.3 Behavior

**Toggle:** `New venue` or `Existing venue`.

**If "New venue"** (default): Phase 0 proceeds normally. Operator fills in all contact and venue info manually.

**If "Existing venue":**
1. A **search/dropdown** appears showing all venues from the operator's outreach system.
2. Operator selects a venue.
3. The following fields **auto-fill** from the venue record:
   - Venue name → `venue_name`
   - Venue type → `venue_type`
   - City, state, address, postal code → all location fields
   - Capacity → `capacity_range` (if stored)
4. The **primary contact** on that venue auto-fills into Phase 0A contact fields:
   - Contact name, role, email, phone, company
5. A **contact selector dropdown** appears showing all contacts on that venue, with the primary contact pre-selected. The operator can switch to a different contact if they're speaking with someone else.
6. The venue identity and location sections in Phase 2 (2A, 2C) are **pre-filled and show as confirmed** — the operator can still modify if needed, but doesn't have to re-enter anything.

### 9.4 Commission Tier Auto-Suggestion

When an existing venue is selected, the system checks the deals history:

| Condition | Auto-Suggested Tier |
|-----------|-------------------|
| Venue `outreach_track` = `community` | `artist_network` (0%) — **forced**, not just suggested |
| Venue is new to the system (no previous deals) | `new_doors` (20%) |
| Venue has at least one previous deal | `kept_doors` (20%) |
| Operator can always manually override to: | `bigger_doors` (10%) — for new opportunities that emerged from existing relationships |

The commission tier dropdown is in Phase 0C with all four options visible, but the auto-suggested one is pre-selected. The operator can change it with a single tap.

---

## 10. DESIGN RULES

### 10.1 No Typing During Live-Call Mode

**Foundational rule.** During live-call mode, every visible field must be one of:
- Toggle (2-3 options, tap to select)
- Dropdown (tap to open, tap to select)
- Multi-select chips (tap to toggle on/off)
- Date picker (tap to open calendar, tap a date)
- Time picker (tap to open time selector, tap a time)
- Number stepper (tap +/- to adjust)
- Star rating (tap a star)

If information requires typing, the live-call mode shows a **flag toggle**: "Capture after call?" → `Yes` / `No`. The text input appears in Phase 8.

### 10.2 Talking Points Style

- **Subtle, muted text** — italic, slightly smaller, lighter color. Glanceable, not dominant.
- Written in **first person** as the operator speaking.
- **[Bracket placeholders]** auto-fill from pre-call data (e.g., *"Hey [Rafael]..."*).
- Not a script to read verbatim — a suggested phrasing to adapt naturally.
- If pre-call data is missing, the talking point adapts. For example, if no event type is known, the talking point drops that reference rather than showing an empty bracket.

### 10.3 Segue Language Style

- Appears at the bottom of each section card, after fields, above "Next."
- Even more subtle than talking points — like a footnote or gentle nudge.
- Written as **bridge sentences** connecting the current topic to the next.
- Full reference in [Section 22](#22-segue-language-reference-complete).

### 10.4 Field Layout Within Cards

- Toggles: **inline, side by side** in a row. All options visible at once.
- Dropdowns: **full-width**, tap to open.
- Multi-select chips: wrap horizontally like tags.
- Time/date pickers: compact, show current value inline with tap-to-edit.
- All interactive elements: **minimum 44px height**, ideally 48-56px. Operator taps quickly without precision.

### 10.5 Auto-Save

Every field change **auto-saves** to `booking_intakes` / `booking_intake_shows`. No manual save needed. If browser crashes, nothing is lost. Subtle "Saved ✓" indicator in top bar.

### 10.6 Auto-Population Between Fields

| Source Field | Auto-Populates Into |
|-------------|-------------------|
| `event_date` | Day of week display + weekend/weekday pricing in Phase 5 |
| Set start + end times | `set_length` (auto-calculated) → `performanceHours` in pricing |
| Event end < event start | `overnight_event` auto-toggles → `addCalendarDaysPacific` on save |
| `travel_required` = "Local" | Hides lodging fields, potentially skips Section 4E |
| `contact_name` from pre-call | Populates talking point brackets in all phases |
| `contact_company` from pre-call | Populates invoice defaults in Phase 5E |
| Venue data from pre-call / existing selector | Pre-selects toggles in Phase 2 |
| `equipment_provider` in Phase 4A | Auto-sets `pa_sound` promise line in Phase 6 |
| Set times entered in Phase 3A | Auto-confirms `set_times` promise line in Phase 6 |
| Pricing agreed in Phase 5 | Auto-confirms `guaranteed_fee` promise line in Phase 6 |
| `load_in_discussed` in Phase 4C | Auto-sets `load_in` promise line in Phase 6 |
| `parking_status` in Phase 4D | Auto-sets `parking` promise line in Phase 6 |
| `lodging_status` in Phase 4E | Auto-sets `lodging` promise line in Phase 6 |

### 10.7 Visual Design

Use **existing dashboard components, theming, colors, typography, and spacing**. No new design language. The intake form should feel like a natural part of the dashboard — just on its own dedicated page. Reuse buttons, toggles, dropdowns, cards, color tokens, etc. from the existing component library.

---

## 11. PHASE 0 — PRE-CALL PREP

**Mode:** PRE-CALL MODE (traditional form layout, typing is fine)

### Existing Venue Selector (top of page — see Section 9 for full spec)

| Field | Label | Type | Options | Default |
|-------|-------|------|---------|---------|
| `venue_source` | Venue source | Toggle | `New venue` · `Existing venue` | `New venue` |
| `existing_venue_id` | Select venue | Searchable dropdown (from venues table) | Dynamic | — |
| `selected_contact_id` | Speaking with | Dropdown (contacts on selected venue) | Dynamic — primary contact pre-selected | Primary contact |

### Section 0A: Who Am I Calling?

*If existing venue is selected, these fields auto-fill from the selected contact. Editable.*

| Field | Label | Type | Required? | Maps To |
|-------|-------|------|-----------|---------|
| `contact_name` | Contact name | Text input | Yes | `contacts.name` |
| `contact_company` | Company / brand | Text input | No | `contacts.company` |
| `contact_role` | Their role / title | Text input | No | `contacts.role` |
| `contact_phone` | Phone number | Text input (tel) | Yes | `contacts.phone` |
| `contact_email` | Email | Text input (email) | No | `contacts.email` |

### Section 0B: What Do I Already Know?

| Field | Label | Type | Options | Required? | Maps To |
|-------|-------|------|---------|-----------|---------|
| `inquiry_source` | How they found us | Dropdown | `Instagram DM`, `Email`, `Phone/Text`, `Referral`, `Website`, `Radio`, `Other` | No | `booking_intakes.venue_data` metadata |
| `inquiry_summary` | What they told us so far | Text area (3 lines) | — | No | Internal |
| `known_event_date` | Date mentioned? | Date picker (optional) | — | No | Pre-populates Phase 2B |
| `known_event_type` | Event type mentioned? | Dropdown | `After-Party`, `Private Event`, `Club Night`, `Corporate`, `Wedding`, `Festival`, `Concert`, `Brand Activation`, `Other` | No | Pre-populates Phase 2A |
| `known_venue_name` | Venue mentioned? | Text input | — | No | Pre-populates Phase 2C |
| `known_city` | City mentioned? | Text input | — | No | Pre-populates Phase 2C |
| `pre_call_notes` | Anything else to remember | Text area | — | No | Internal |

### Section 0C: Pipeline & Commission

| Field | Label | Type | Options | Default | Required? | Maps To |
|-------|-------|------|---------|---------|-----------|---------|
| `outreach_track` | Lead source | Toggle | `Pipeline` · `Community` | — | Yes | `venues.outreach_track` |
| `commission_tier` | Commission tier | Dropdown | `New Doors (20%)`, `Kept Doors (20%)`, `Bigger Doors (10%)`, `Artist Network (0%)` | Auto-suggested (see Section 9.4) | Yes | `deals.commission_tier` |
| `priority` | Priority | Star rating (1-5) | — | 3 | No | `venues.priority` |
| `intake_title` | Intake title | Text input | — | Auto: "[contact_name] — Booking Intake" | No | `booking_intakes.title` |

**Commission tier rules:**
- If `outreach_track` = `Community` → `commission_tier` is **forced** to `Artist Network (0%)` and the dropdown is disabled.
- If `outreach_track` = `Pipeline` and existing venue with previous deals → auto-suggest `Kept Doors`.
- If `outreach_track` = `Pipeline` and new venue → auto-suggest `New Doors`.
- Operator can always manually select `Bigger Doors` regardless of history.

### Section 0D: Multi-Show

| Field | Label | Type | Options | Default |
|-------|-------|------|---------|---------|
| `multi_show` | Multiple shows? | Toggle | `Single show` · `Multiple shows` | `Single show` |
| `show_count` | How many? | Dropdown | `2`, `3` | `2` |

`show_count` only visible if `multi_show` = `Multiple shows`.

When activated, show slots are created with default labels ("Show 1," "Show 2," "Show 3") and assigned colors (Blue, Purple, Amber). Labels become editable and auto-update once event dates are entered later.

**Note:** Multi-show can also be activated during the call via a persistent control in the top bar or bottom bar.

### Begin Call Button

**[ 🔴 Begin Call ]**

At the bottom of Phase 0. Transitions to Live-Call Mode.

---

## 12. PHASE 1 — THE OPENING

**Mode:** LIVE-CALL MODE
**Shared across all shows** (not per-show)
**Duration:** First 1-2 minutes

### Section 1A: The Greeting

**Talking point:**
> *"Hey [contact_name], this is Tony with DJ Luijay's team — thanks for reaching out about [known_event_type / known_event_date]. I wanted to get on the phone with you personally to make sure we take care of everything. How's it going?"*

*Adaptation: If `known_event_type` and `known_event_date` are empty, drop that clause: "...thanks for reaching out. I wanted to get on the phone..."*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `confirmed_contact` | Speaking with the right person? | Toggle | `Yes` · `No — different person` | If No → flag for post-call |
| `call_vibe` | Call energy | Toggle | `Excited` · `Business` · `Rushed` | Internal |

**Segue to 1B:**
> *"Before we get into the fun stuff — just want to make sure I have everything right on my end."*

---

### Section 1B: Confirm What You Know

**Talking point:**
> *"Is [contact_phone] still the best number for you? And should I send everything over to [contact_email]?"*

*Adaptation: If email is empty: "What's the best email to send everything to?" + flag for post-call capture.*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `phone_confirmed` | Phone? | Toggle | `Confirmed` · `Update needed` | Flag if update |
| `email_confirmed` | Email? | Toggle | `Confirmed` · `Update needed` · `Need to get` | Flag if update/need |
| `company_confirmed` | Company? | Toggle | `Confirmed` · `Update needed` | Flag if update |

**Segue to Phase 2:**
> *"Alright, we're good. So tell me about this event — what are we working with?"*

---

## 13. PHASE 2 — THE EVENT: BIG PICTURE

**Mode:** LIVE-CALL MODE
**Duration:** Minutes 2-5

### Section 2A: Event Identity

**Multi-show:** Per-show. Default: Same for all.

**Talking point:**
> *"Give me the rundown — what's the event, what's the vision?"*

*If pre-filled: "So the [after-party] — tell me more about the vision for it."*

| Field | Label | Type | Options | Pre-populated from | Maps To |
|-------|-------|------|---------|-------------------|---------|
| `event_type` | Event type | Dropdown | `After-Party`, `Private Event`, `Club Night`, `Corporate`, `Wedding`, `Festival`, `Concert`, `Brand Activation`, `Other` | `known_event_type` | `booking_intake_shows.show_data` |
| `venue_type` | Venue type | Dropdown | `Bar`, `Club`, `Festival`, `Theater`, `Lounge`, `Other` | Existing venue data | `venues.venue_type` |
| `setting` | Setting | Toggle | `Indoor` · `Outdoor` · `Both` | — | `booking_intake_shows.show_data` |
| `event_name_flag` | Event name? | Toggle | `Yes — capture later` · `No name yet` | — | Flag → `deals.description` |

**Segue to 2B:**
> *"Love it. And when are we looking at for the date?"*

---

### Section 2B: When

**Multi-show:** Per-show. Default: **Different per show** (dates almost always differ).

**Talking point (single show):**
> *"What date are we locked in for?"*

**Talking point (multi-show):**
> *"Let's get the dates down — when's the first one?"*

*If pre-filled: "So we're looking at [known_event_date] — is that confirmed?"*

| Field | Label | Type | Pre-populated from | Maps To |
|-------|-------|------|--------------------|---------|
| `event_date` | Event date | Date picker | `known_event_date` | `deals.event_date` |
| `day_of_week` | Day of week | Auto-calculated (read-only) | From `event_date` | Pricing info |
| `event_start_time` | Event start | Time picker (15-min) | — | `deals.event_start_at` (Pacific) |
| `event_end_time` | Event end | Time picker (15-min) | — | `deals.event_end_at` (Pacific) |
| `overnight_event` | Overnight? | Auto-toggle (if end < start) | Auto | Time conversion logic |

**Multi-show note:** When "Same for all" is off, each show's date picker is shown in sequence with its color dot. The show label auto-updates to include the date once entered (e.g., "Show 1" → "Sat Apr 18").

**Segue to 2C:**
> *"Got it. And where's this going down?"*

---

### Section 2C: Where

**Multi-show:** Per-show. Default: Same for all.

**Talking point:**
> *"Do you have a venue locked in?"*

*If existing venue: "So this is at [venue_name] — same spot?"*

| Field | Label | Type | Options | Pre-populated from | Maps To |
|-------|-------|------|---------|-------------------|---------|
| `venue_name_flag` | Venue name | Toggle | `Already have it` · `They told me — capture later` · `TBD` | Auto if existing venue or `known_venue_name` | `venues.name` |
| `city_flag` | City | Toggle | `Already have it` · `They told me — capture later` · `TBD` | Auto if existing venue or `known_city` | `venues.city` |
| `state_region` | State | Dropdown | US states + `Other / International` | Auto if existing venue | `venues.region` |
| `address_status` | Address known? | Toggle | `Have it` · `They'll send it` · `TBD — private location` | Auto "Have it" if existing venue | Flag if needed |

**Segue to 2D:**
> *"Nice. And how big are we talking — what's the expected turnout?"*

---

### Section 2D: Scale

**Multi-show:** Per-show. Default: Same for all.

**Talking point:**
> *"What kind of crowd are we looking at?"*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `capacity_range` | Expected capacity | Dropdown | `Under 100`, `100-300`, `300-500`, `500-1,000`, `1,000-2,000`, `2,000-5,000`, `5,000+` | `venues.capacity` + `deals.venue_capacity` |
| `exact_capacity_flag` | Exact number given? | Toggle | `Yes — capture later` · `No — range is fine` | Flag if yes |

**Segue to Phase 3:**
> *"Alright, I've got the picture. Let's talk about what you want from Luijay's set."*

---

## 14. PHASE 3 — THE PERFORMANCE

**Mode:** LIVE-CALL MODE
**Duration:** Minutes 5-8

### Section 3A: Role & Slot

**Multi-show:** Per-show. Default: **Different per show.**

**Talking point:**
> *"What kind of role are you envisioning for Luijay — headliner, opener, holding down the whole night?"*

**Talking point (multi-show, "Same for all" OFF):**
> *"Is his role the same for both nights, or different?"*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `performance_role` | Role | Dropdown | `Headliner`, `Opener`, `Support / Mid-Set`, `Solo (Only DJ)`, `Resident / Regular`, `Guest Set` | `booking_intake_shows.show_data` |
| `set_start_time` | Set start | Time picker (15-min) | — | `deals.performance_start_at` (Pacific) |
| `set_end_time` | Set end | Time picker (15-min) | — | `deals.performance_end_at` (Pacific) |
| `set_length` | Set length | Auto-calculated (read-only) | — | `computeDealPrice` → `performanceHours` |

**Segue to 3B:**
> *"And what's the vibe musically? Any specific direction?"*

---

### Section 3B: Music & Vibe

**Multi-show:** Per-show. Default: Same for all.

**Talking point:**
> *"What kind of sound are you envisioning?"*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `genres` | Genre | Multi-select chips | `Latin House`, `Reggaeton`, `Hip-Hop`, `Top 40`, `EDM`, `Cumbia`, `Salsa`, `Afrobeats`, `Open Format`, `Other` | `deals.performance_genre` |
| `custom_setlist` | Custom setlist? | Toggle | `No — DJ's call` · `Yes — specific requests` | Pricing flag |
| `music_requests_flag` | Specific requests? | Toggle | `None` · `Yes — capture later` | Flag if yes |

**Segue to 3C:**
> *"Is Luijay the only one on the lineup, or are there other acts?"*

---

### Section 3C: Other Performers

**Multi-show:** Per-show. Default: Same for all.

**Talking point:**
> *"Any other DJs or performers that night?"*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `other_performers` | Other performers? | Toggle | `Solo act` · `Multiple performers` | `booking_intake_shows.show_data` |
| `num_other_acts` | How many? | Dropdown | `1`, `2`, `3`, `4+` | `booking_intake_shows.show_data` |
| `billing_priority` | Luijay's billing | Dropdown | `Top billing`, `Co-headliner`, `Supporting act` | `booking_intake_shows.show_data` |

**Conditional:** `num_other_acts` and `billing_priority` only visible if `other_performers` = `Multiple performers`.

**Segue to Phase 4:**
> *"Got it. Let me ask you a few things on the production side — just to make sure everything's dialed in."*

---

## 15. PHASE 4 — TECHNICAL & LOGISTICS

**Mode:** LIVE-CALL MODE
**Duration:** Minutes 8-12

### Section 4A: Equipment

**Multi-show:** Per-show. Default: Same for all.

**Talking point:**
> *"On the equipment side — does the venue have a full DJ setup, or does Luijay need to bring his own gear?"*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `equipment_provider` | DJ equipment | Toggle | `Venue provides` · `DJ brings own` · `Hybrid` | Promise line: `pa_sound` + pricing flag |
| `equipment_details_flag` | Details? | Toggle | `Full setup confirmed` · `Discussed — capture later` · `Not discussed` | Flag if "capture later" |

**Segue to 4B:**
> *"And on the day of — who should we connect with when Luijay gets there?"*

---

### Section 4B: On-Site Contact

**Shared** across all shows.

**Talking point:**
> *"Is there a production person or point of contact on site?"*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `onsite_same_contact` | Same as main contact? | Toggle | `Same person` · `Different person` | `deals.onsite_contact_id` |
| `onsite_name_flag` | Name | Toggle | `They told me — capture later` · `Not discussed` | Flag → `contacts.name` |
| `onsite_phone_flag` | Phone | Toggle | `They told me — capture later` · `Not discussed` | Flag → `contacts.phone` |

**Conditional:** `onsite_name_flag` and `onsite_phone_flag` only visible if `onsite_same_contact` = `Different person`.

**Segue to 4C:**
> *"Do you have a load-in time or soundcheck window figured out?"*

---

### Section 4C: Load-In & Soundcheck

**Multi-show:** Per-show. Default: **Different per show.**

**Talking point:**
> *"Just so we know when to have him there — any load-in or soundcheck window?"*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `load_in_discussed` | Load-in set? | Toggle | `Yes` · `TBD` | Promise line: `load_in` |
| `load_in_time` | Load-in time | Time picker | — | `booking_intake_shows.show_data` |
| `soundcheck` | Soundcheck? | Toggle | `Yes` · `No` · `Not discussed` | Promise line: `load_in` |

**Conditional:** `load_in_time` only visible if `load_in_discussed` = `Yes`.

**Segue to 4D:**
> *"Any special instructions for getting in — parking, loading, anything like that?"*

---

### Section 4D: Access & Parking

**Multi-show:** Per-show. Default: Same for all.

**Talking point:**
> *"How's the parking and access situation?"*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `parking_status` | Parking / access | Toggle | `Confirmed` · `Need to confirm` · `Not discussed` | Promise line: `parking` |
| `parking_details_flag` | Details? | Toggle | `Yes — capture later` · `No` | Flag if yes |

**Segue to 4E:**
> *"Is this local, or would there be any travel involved?"*

---

### Section 4E: Travel & Lodging

**Multi-show:** Per-show. Default: Same for all.

**Talking point:**
> *"Is this local to the area, or are we looking at travel?"*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `travel_required` | Travel | Toggle | `Local — no travel` · `Regional (driving)` · `Requires flight` | Pricing flag |
| `lodging_status` | Lodging | Toggle | `Not needed` · `Venue provides` · `DJ covers` · `Not discussed` | Promise line: `lodging` |
| `travel_notes_flag` | Details? | Toggle | `Yes — capture later` · `No` | Flag if yes |

**Conditional:** `lodging_status` and `travel_notes_flag` **hidden** if `travel_required` = `Local — no travel`. Entire Section 4E **skipped** if `state_region` = California (artist's local state), though overridable via sidebar.

**Segue to Phase 5:**
> *"Alright, logistics are covered. Let me pull up what this looks like on the investment side."*

---

## 16. PHASE 5 — THE MONEY CONVERSATION

**Mode:** LIVE-CALL MODE
**Duration:** Minutes 12-18

### Section 5A: Pricing Setup

**Multi-show:** Per-show. **Always different** — no "Same for all" toggle.

**Talking point (single show):**
> *"Based on what you've described — here's what this looks like."*

**Talking point (multi-show):**
> *"Let me break down the pricing for each date."*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `pricing_mode` | Pricing mode | Toggle | `Package` · `Hourly` | `computeDealPrice` → `baseMode` |
| `package_id` | Package | Dropdown (from `pricing_catalog.packages[]`) | Dynamic | `computeDealPrice` → `packageId` |
| `service_id` | Service rate | Dropdown (from `pricing_catalog.services[]`, filtered by weekday/weekend from `event_date`) | Dynamic — auto-suggested | `computeDealPrice` → `serviceId` |
| `performance_hours` | Billable hours | Number display (editable +/- stepper) | Auto from set times | `computeDealPrice` → `performanceHours` |

**Conditional:** `package_id` visible only if `pricing_mode` = `Package`. `service_id` and `performance_hours` visible only if `pricing_mode` = `Hourly`.

---

### Section 5B: Add-Ons & Adjustments

**Multi-show:** Per-show. **Always different** — no "Same for all" toggle.

**Talking point (if applicable):**
> *"There are a couple things that might apply here depending on the specifics..."*

| Field | Label | Type | Maps To |
|-------|-------|------|---------|
| `addon_quantities` | Add-ons | Multi-select tiles (from `pricing_catalog.addons[]`) — name + price + unit. Tap to toggle, tap again to increment qty. | `computeDealPrice` → `addonQuantities` |
| `surcharge_ids` | Surcharges | Multi-select tiles (from `pricing_catalog.surcharges[]`) — name + percentage (e.g., "+15% Seasonal") | `computeDealPrice` → `surchargeIds` |
| `discount_ids` | Discounts | Multi-select tiles (from `pricing_catalog.discounts[]`) — name + percent off | `computeDealPrice` → `discountIds` |

**Design:** Each tile shows the **live dollar impact** updating in real time as the base changes.

---

### Section 5C: The Number

**Multi-show:** Per-show. **Always different.**

**Display section** — auto-calculated, not manually entered (unless override).

| Field | Label | Type | Maps To |
|-------|-------|------|---------|
| `subtotal` | Subtotal | Read-only (prominent) | `pricing_snapshot.subtotalBeforeTax` |
| `tax_amount` | Tax | Read-only | `pricing_snapshot.taxAmount` |
| `total` | **Total** | Read-only (**large, bold**) | `pricing_snapshot.total` → `deals.gross_amount` |
| `pricing_source` | Use calculated? | Toggle: `Use calculated` · `Manual override` | `pricing_snapshot.finalSource` |
| `manual_gross` | Manual amount | Number input (tap-friendly numpad) | `deals.gross_amount` |

**Conditional:** `manual_gross` visible only if `pricing_source` = `Manual override`.

**Talking point:**
> *"So for the [set_length] [performance_role] set on [event_date], we're looking at [total]."*

**Multi-show talking point:**
> *"So for [Show 1 label], we're at [total]. And for [Show 2 label], it's [total]."*

**Segue to 5D:**
> *"Let me tell you how we usually structure the payment."*

---

### Section 5D: Deposit & Payment

**Multi-show:** Per-show. **Always different.**

**Talking point:**
> *"We do a 50% deposit to lock in the date, balance due before the event. Does that work?"*

| Field | Label | Type | Options | Default | Maps To |
|-------|-------|------|---------|---------|---------|
| `deposit_percent` | Deposit | Dropdown | `25%`, `50%`, `75%`, `100% upfront` | `50%` | `deals.deposit_due_amount` (calculated) |
| `deposit_amount` | Deposit amount | Read-only | Auto: total × percent | — | `deals.deposit_due_amount` |
| `balance_amount` | Balance | Read-only | Auto: total − deposit | — | Derived |
| `balance_timing` | Balance due | Dropdown | `Before event`, `Day of event`, `After event`, `Custom date` | `Before event` | `deals.payment_due_date` context |
| `balance_due_date` | Date | Date picker | — | — | `deals.payment_due_date` |
| `payment_methods` | Payment methods | Multi-select chips | `Cash`, `Zelle`, `Venmo`, `Apple Pay`, `PayPal`, `Check`, `Other` | — | Deal metadata |

**Conditional:** `balance_due_date` visible only if `balance_timing` = `Custom date`.

**Segue to 5E:**
> *"And for the invoice — should I send that directly to you?"*

---

### Section 5E: Invoicing

**Shared** across all shows (same billing entity).

**Talking point:**
> *"Should I put the invoice under [contact_company] and send it to [contact_email]?"*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `invoice_same_contact` | Invoice to main contact? | Toggle | `Yes` · `Different person` | Routing |
| `invoice_company_confirmed` | Company | Toggle | `[contact_company] — correct` · `Different — capture later` | Flag if different |
| `invoice_email_confirmed` | Email | Toggle | `[contact_email] — correct` · `Different — capture later` | Flag if different |
| `billing_contact_flag` | Billing contact | Toggle | `Same as main` · `They told me — capture later` | Flag if different |

**Conditional:** Company/email/billing fields only visible if `invoice_same_contact` = `Different person`.

**Segue to Phase 6:**
> *"Alright, money's squared away. Just want to run through a couple quick things to make sure we're on the same page."*

---

## 17. PHASE 6 — VENUE COMMITMENTS

**Mode:** LIVE-CALL MODE
**Duration:** Minutes 18-20 (quick pass)
**Multi-show:** Per-show. Default: Same for all.

### Section 6A: Venue Promise Lines

**Talking point:**
> *"Just confirming a few things so there are no surprises on either side..."*

**Layout:** Compact grid of toggleable chips/switches. NOT a long checklist. The operator taps confirmed items, leaves the rest as "Not discussed."

| Preset ID | Label | Toggle Options | Auto-Set From | Maps To |
|-----------|-------|---------------|---------------|---------|
| `guaranteed_fee` | Guaranteed fee | `Confirmed` · `Not discussed` · `No` | Auto if pricing agreed in Phase 5 | `promise_lines.venue` |
| `pa_sound` | PA and sound | `Venue provides` · `DJ provides` · `Not discussed` | Auto from `equipment_provider` (4A) | `promise_lines.venue` |
| `stage_lighting` | Stage and lighting | `Confirmed` · `Not discussed` · `No` | — | `promise_lines.venue` |
| `set_times` | Set times and curfew | `Confirmed` · `Not discussed` | Auto if set times entered (3A) | `promise_lines.venue` |
| `load_in` | Load-in and soundcheck | `Confirmed` · `Not discussed` | Auto from Phase 4C | `promise_lines.venue` |
| `hospitality` | Hospitality | `Confirmed` · `Not discussed` · `No` | — | `promise_lines.venue` |
| `parking` | Parking and access | `Confirmed` · `Need to confirm` · `Not discussed` | Auto from Phase 4D | `promise_lines.venue` |
| `guest_list` | Guest list and comps | `Confirmed` · `Not discussed` · `N/A` | — | `promise_lines.venue` |
| `lodging` | Lodging | `Confirmed` · `Not needed` · `Not discussed` | Auto from Phase 4E | `promise_lines.venue` |
| `marketing` | Marketing / promo | `Confirmed` · `Not discussed` | — | `promise_lines.venue` |
| `merch_terms` | Merch terms | `Confirmed` · `Not discussed` · `N/A` | — | `promise_lines.venue` |

**Auto-set items** show a subtle "auto" indicator so the operator knows they were filled from earlier answers.

**Operator does NOT read every item aloud.** Suggested spoken confirmations:
- *"Just confirming — you've got the full sound system on your end, right?"* → PA/sound
- *"The fee we discussed is locked — no surprises on either side."* → Guaranteed fee
- *"Set times are [start] to [end]?"* → Set times

**Segue to Phase 7:**
> *"We're looking good. Let me tell you what happens from here."*

---

## 18. PHASE 7 — THE CLOSE

**Mode:** LIVE-CALL MODE
**Duration:** Final 2-3 minutes
**Shared** across all shows.

### Section 7A: Next Steps

**Talking point:**
> *"Here's what happens next — I'm putting together the agreement, sending it to [contact_email] with the invoice for the deposit. Once that's handled, the date is officially locked. Sound good?"*

**Talking point (multi-show):**
> *"I'll put together agreements for both dates and send everything over together."*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `send_agreement` | Agreement? | Toggle | `Yes — sending` · `No — verbal only` | Workflow trigger |
| `deposit_on_call` | Deposit? | Toggle | `Paying now` · `Sending invoice` | `deals.deposit_paid_amount` |
| `client_energy` | Energy at close | Toggle | `Very excited` · `Positive` · `Neutral` · `Uncertain` | Internal |

---

### Section 7B: Follow-Ups

**Talking point:**
> *"Anything else you need from our side, or anything I should follow up on?"*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `has_follow_ups` | Follow-ups? | Toggle | `Yes` · `All clear` | Flags Phase 8 |
| `follow_up_date` | When | Date picker | — | `venues.follow_up_date` |
| `follow_up_topics` | What | Multi-select chips | `Address`, `Contacts`, `Technical`, `Payment`, `Contract review`, `Other` | Internal |

**Conditional:** `follow_up_date` and `follow_up_topics` only visible if `has_follow_ups` = `Yes`.

---

### Section 7C: End Call

**Talking point:**
> *"[contact_name], appreciate you — this is going to be great. I'll have everything in your inbox within the hour. Let's make it happen."*

| Field | Label | Type | Options | Maps To |
|-------|-------|------|---------|---------|
| `call_status` | Call completed? | Toggle | `Full call` · `Partial — need follow-up` · `Voicemail` | Internal |
| `call_timestamp` | Time | Auto (current) | — | `booking_intakes` metadata |

**[ 🔴 End Call ]**

Tapping this:
1. Saves all live-call data.
2. Transitions to Post-Call Mode.
3. Auto-sets outreach status based on context: agreement being sent → `agreement_sent`; verbal only → `in_discussion` or `booked`.
4. Surfaces all flagged fields in Phase 8.

---

## 19. PHASE 8 — POST-CALL CLEANUP

**Mode:** POST-CALL MODE (typing is fine)

### Section 8A: Flagged Fields

System collects **every field** flagged during the call ("capture later," "update needed," etc.). Presented as a clean list of compact cards:

Each flagged item shows:
1. **Source:** "From: Phase 2 — The Event"
2. **What:** "Venue name (they told you — capture later)"
3. **Show indicator** (if multi-show and the flag is per-show): colored dot + show label
4. **Input field:** text/number input ready for typing

Common flagged fields:
- Contact name (if different person), phone (if updated), email (if updated)
- Event name / title
- Venue name, city, street address, address line 2, postal code
- Exact capacity number
- On-site contact name, phone, role
- Equipment details, music requests, parking details, travel notes
- Invoice company, email, billing contact (if different)

### Section 8B: General Notes

| Field | Label | Type | Maps To |
|-------|-------|------|---------|
| `call_notes` | Call notes | Text area (unlimited) | `deals.notes` + `booking_intakes.venue_data` |
| `future_intel` | Things worth remembering | Text area | Internal |
| `red_flags` | Concerns | Text area | Internal |

### Section 8C: Import Preview & Actions

**Venue Preview Card:**
- Name, type, city/state, capacity, outreach track, status
- Contacts listed with roles
- ⚠️ Missing required fields warning (if any)

**Deal Preview Cards (one per show, color-coded if multi-show):**

```
┌─ ● Show 1: Sat Apr 18 (blue) ──────────┐
│  After-Party at [venue_name]            │
│  Set: 3:00-4:00 AM (1 hr) — Headliner  │
│  Genre: Latin House                      │
│  Gross: $1,150 | Deposit: $575          │
│  Commission: Kept Doors (20%)           │
│  ⚠️ Missing: [list if any]              │
│  [ Import as Deal ]                     │
└─────────────────────────────────────────┘

┌─ ● Show 2: Sat Apr 25 (purple) ────────┐
│  Club Night at [venue_name]             │
│  Set: 11 PM-1 AM (2 hrs) — Solo        │
│  Genre: Open Format                      │
│  Gross: $2,000 | Deposit: $1,000       │
│  Commission: Kept Doors (20%)           │
│  [ Import as Deal ]                     │
└─────────────────────────────────────────┘
```

**Buttons:**
- **[ Import Venue to Outreach ]** — creates/updates venue + contacts. If existing venue was selected in Phase 0, this updates rather than creates.
- **[ Import as Deal ]** (per show) — creates deal with full pricing snapshot, promise lines, all data. Requires venue to be imported/linked first.
- **[ Import All ]** — imports venue + all shows as deals in sequence.

---

## 20. DASHBOARD FIELD MAPPING REFERENCE

### 20.1 Intake → Venue (`venues` table)

| Intake Field | Venue Column |
|-------------|-------------|
| `venue_name` (pre-fill, existing, or post-call flag) | `name` |
| Street address (post-call) | `location` |
| `address_line2` (post-call) | `address_line2` |
| `city` (pre-fill, existing, or post-call flag) | `city` |
| `state_region` | `region` |
| Postal code (post-call) | `postal_code` |
| `venue_type` | `venue_type` |
| `priority` | `priority` |
| Auto-calculated from Phase 7 | `status` |
| `outreach_track` | `outreach_track` |
| `follow_up_date` | `follow_up_date` |
| `capacity_range` or exact capacity | `capacity` |

### 20.2 Intake → Contacts (`contacts` table)

**Primary contact:**
| Intake | Contact Column |
|--------|---------------|
| `contact_name` | `name` |
| `contact_role` | `role` |
| `contact_email` | `email` |
| `contact_phone` | `phone` |
| `contact_company` | `company` |

**On-site contact (if different):**
| Intake | Contact Column |
|--------|---------------|
| On-site name (post-call) | `name` |
| On-site role (post-call) | `role` |
| On-site phone (post-call) | `phone` |
| `contact_company` | `company` |

**Billing contact (if different):**
| Intake | Contact Column |
|--------|---------------|
| Billing name (post-call) | `name` |
| "Billing" | `role` |
| Invoice email (post-call) | `email` |
| Invoice company (post-call) | `company` |

### 20.3 Intake → Deal (`deals` table) — per show

| Intake Field | Deal Column | Notes |
|-------------|------------|-------|
| Event name or auto-generated | `description` | Auto: "[event_type] at [venue_name] — [event_date]" |
| Imported venue ID | `venue_id` | |
| `event_date` | `event_date` | `YYYY-MM-DD` Pacific |
| `event_start_time` + date | `event_start_at` | `pacificWallToUtcIso` |
| `event_end_time` + date + overnight | `event_end_at` | + `addCalendarDaysPacific` if overnight |
| `genres` joined | `performance_genre` | Comma-separated |
| `set_start_time` + date | `performance_start_at` | `pacificWallToUtcIso` |
| `set_end_time` + date + overnight | `performance_end_at` | + `addCalendarDaysPacific` |
| On-site contact ID | `onsite_contact_id` | |
| `total` or `manual_gross` | `gross_amount` | Required > 0 |
| `commission_tier` | `commission_tier` | Forced to `artist_network` if community |
| `balance_due_date` or derived | `payment_due_date` | |
| `call_notes` + compiled | `notes` | |
| `capacity_range` or exact | `venue_capacity` | |
| Compiled promise lines | `promise_lines` | `DealPromiseLinesDocV2` format |
| Calculator output | `pricing_snapshot` | `DealPricingSnapshot` v1 |
| `deposit_amount` | `deposit_due_amount` | |
| If paid on call | `deposit_paid_amount` | Only if `deposit_on_call` = `Paying now` |

### 20.4 Intake → Pricing Calculator (`ComputeDealPriceInput`) — per show

| Intake | Calculator Input |
|--------|-----------------|
| Live pricing catalog | `catalog` |
| `event_date` | `eventDate` |
| `pricing_mode` | `baseMode` |
| `package_id` | `packageId` |
| `service_id` | `serviceId` |
| `performance_hours` | `performanceHours` |
| `addon_quantities` | `addonQuantities` |
| `surcharge_ids` | `surchargeIds` |
| `discount_ids` | `discountIds` |

### 20.5 Intake → Promise Lines (`DealPromiseLinesDocV2`) — per show

```json
{
  "v": 2,
  "venue": {
    "lines": [
      {
        "presetId": "[preset_id]",
        "label": "[label]",
        "confirmed": true | false | null
      }
    ]
  },
  "artist": {
    "lines": []
  }
}
```

Mapping:
- `Confirmed` / `Venue provides` → `confirmed: true`
- `Not discussed` → omit or `confirmed: null`
- `No` / `N/A` → `confirmed: false`

---

## 21. CONDITIONAL LOGIC RULES (COMPLETE)

### Field-Level Conditionals

| Trigger Field | Trigger Value | Effect |
|--------------|---------------|--------|
| `venue_source` | `Existing venue` | Show venue search + contact selector. Auto-fill Phase 0A + venue fields. |
| `venue_source` | `New venue` | Hide venue search. Standard Phase 0A. |
| `multi_show` | `Multiple shows` | Show `show_count`. Activate color system. Show "Same for all" toggles on per-show sections. |
| `multi_show` | `Single show` | Hide `show_count`. No color indicators. No "Same for all" toggles. |
| `outreach_track` | `Community` | Force `commission_tier` = `Artist Network (0%)`. Disable tier dropdown. |
| `outreach_track` | `Pipeline` | Enable `commission_tier` dropdown. Auto-suggest based on venue history. |
| `confirmed_contact` | `No — different person` | Flag for post-call (new contact name) |
| `email_confirmed` | `Update needed` or `Need to get` | Flag for post-call |
| `phone_confirmed` | `Update needed` | Flag for post-call |
| `company_confirmed` | `Update needed` | Flag for post-call |
| `event_name_flag` | `Yes — capture later` | Flag for post-call |
| `venue_name_flag` | `They told me — capture later` | Flag for post-call |
| `city_flag` | `They told me — capture later` | Flag for post-call |
| `address_status` | `They'll send it` or `TBD` | Flag for post-call |
| `exact_capacity_flag` | `Yes — capture later` | Flag for post-call |
| `other_performers` | `Solo act` | Hide `num_other_acts`, `billing_priority` |
| `other_performers` | `Multiple performers` | Show `num_other_acts`, `billing_priority` |
| `custom_setlist` | `Yes — specific requests` | Flag for post-call |
| `music_requests_flag` | `Yes — capture later` | Flag for post-call |
| `equipment_details_flag` | `Discussed — capture later` | Flag for post-call |
| `onsite_same_contact` | `Same person` | Hide `onsite_name_flag`, `onsite_phone_flag` |
| `onsite_same_contact` | `Different person` | Show `onsite_name_flag`, `onsite_phone_flag` |
| `load_in_discussed` | `TBD` | Hide `load_in_time` |
| `load_in_discussed` | `Yes` | Show `load_in_time` |
| `parking_details_flag` | `Yes — capture later` | Flag for post-call |
| `travel_required` | `Local — no travel` | Hide `lodging_status`, `travel_notes_flag` |
| `travel_required` | `Regional` or `Requires flight` | Show `lodging_status`, `travel_notes_flag` |
| `pricing_mode` | `Package` | Show `package_id`. Hide `service_id`, `performance_hours`. |
| `pricing_mode` | `Hourly` | Show `service_id`, `performance_hours`. Hide `package_id`. |
| `pricing_source` | `Use calculated` | Hide `manual_gross` |
| `pricing_source` | `Manual override` | Show `manual_gross` |
| `balance_timing` | `Custom date` | Show `balance_due_date` |
| `balance_timing` | Other | Hide `balance_due_date` |
| `invoice_same_contact` | `Yes` | Hide invoice sub-fields |
| `invoice_same_contact` | `Different person` | Show invoice sub-fields |
| `has_follow_ups` | `All clear` | Hide `follow_up_date`, `follow_up_topics` |
| `has_follow_ups` | `Yes` | Show `follow_up_date`, `follow_up_topics` |

### Section-Level Skip Rules

| Condition | Section Skipped |
|-----------|----------------|
| `travel_required` = `Local — no travel` AND `state_region` = California | Section 4E entire section removed from path |
| `event_type` = `Club Night` AND venue_type = `bar` or `club` | Phase 6: auto-hide `lodging`, `merch_terms`, `guest_list` toggles (still accessible via sidebar) |

---

## 22. SEGUE LANGUAGE REFERENCE (COMPLETE)

| From → To | Segue |
|-----------|-------|
| 1A Greeting → 1B Confirm | *"Before we get into the fun stuff — just want to make sure I have everything right on my end."* |
| 1B Confirm → 2A Event Identity | *"Alright, we're good. So tell me about this event — what are we working with?"* |
| 2A Event → 2B When | *"Love it. And when are we looking at for the date?"* |
| 2B When → 2C Where | *"Got it. And where's this going down?"* |
| 2C Where → 2D Scale | *"Nice. And how big are we talking — what's the expected turnout?"* |
| 2D Scale → 3A Role | *"Alright, I've got the picture. Let's talk about what you want from Luijay's set."* |
| 3A Role → 3B Music | *"And what's the vibe musically? Any specific direction?"* |
| 3B Music → 3C Others | *"Is Luijay the only one on the lineup, or are there other acts?"* |
| 3C Others → 4A Equipment | *"Got it. Let me ask you a few things on the production side — just to make sure everything's dialed in."* |
| 4A Equipment → 4B On-Site | *"And on the day of — who should we connect with when Luijay gets there?"* |
| 4B On-Site → 4C Load-In | *"Do you have a load-in time or soundcheck window figured out?"* |
| 4C Load-In → 4D Parking | *"Any special instructions for getting in — parking, loading, anything like that?"* |
| 4D Parking → 4E Travel | *"Is this local, or would there be any travel involved?"* |
| 4D/4E → 5A Pricing | *"Alright, logistics are covered. Let me pull up what this looks like on the investment side."* |
| 5A-5B → 5C Number | *(No spoken segue — flows as one money conversation)* |
| 5C Number → 5D Payment | *"Let me tell you how we usually structure the payment."* |
| 5D Payment → 5E Invoice | *"And for the invoice — should I send that directly to you?"* |
| 5E Invoice → 6A Promise | *"Alright, money's squared away. Just want to run through a couple quick things to make sure we're on the same page."* |
| 6A Promise → 7A Close | *"We're looking good. Let me tell you what happens from here."* |
| 7A Close → 7B Follow-Up | *"Anything else you need from our side?"* |
| 7B Follow-Up → 7C End | *"[contact_name], appreciate you — this is going to be great."* |

---

## 23. WHAT THIS SPEC DOES NOT COVER

1. **The Lead / Pitch Intake Form (Type 2)** — outbound version where the operator pitches DJ Luijay to venues. Separate spec, separate build.

2. **Agreement / contract generation** — what happens after import. Separate workflow. This intake form captures data; it does not produce agreements.

3. **Artist-side commitments** — the `ARTIST_SHOW_REPORT_PRESETS` (on-time, gear prepared, backup plan, etc.) are internal and handled outside this form.

4. **Duplicate venue detection** — if the operator selects "New venue" but the venue already exists, the system could warn. This spec does not define that logic but it would be a nice-to-have enhancement.

5. **Mobile or tablet** — this form is desktop/laptop only.

---

*This is the definitive build spec. Every behavior, field, mapping, conditional rule, multi-show interaction, existing venue flow, and segue is documented here. Hand this to any AI or developer and they have everything they need.*
