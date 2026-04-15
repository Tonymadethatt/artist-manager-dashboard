# Dashboard ecosystem — A to Z test checklist

Use this to **walk the whole product once** and confirm the main flows still connect. Check boxes as you go. For **booking intake → Outreach/Earnings/File Builder** in depth, also run [`intake_ecosystem_testing_checklist.md`](intake_ecosystem_testing_checklist.md).

**Legend:** `[ ]` not tested · `[x]` passed · note failures in the margin or a ticket

---

## A — Account & access

- [ ] **Login** (`/login`): sign in succeeds; wrong password shows a clear error.
- [ ] **Session**: refresh the browser on a shell page; you stay signed in (or you are sent to login—behavior matches what you expect).
- [ ] **Logout** (if you have a logout control): returns to login or public state.

---

## B — Booking intake (live call tool)

- [ ] Open **Booking intake** (`/forms/intake` or from hub). Load or create an intake; move through a few sections without console errors.
- [ ] **End call** saves post-call state; **8C checklist** shows what is / isn’t in the CRM yet (venue, deals per show, end call recorded).
- [ ] **Import venue** creates/links Outreach; **Import deal** (or **Import all**) creates Earnings rows when pricing catalog is set up.
- [ ] With **empty pricing catalog**, deal import is blocked and a link to **Earnings → Pricing** appears.
- [ ] After a successful deal import, **Open File Builder** (if shown) opens with venue/deal pre-filled when possible.

**Deep pass:** follow [`intake_ecosystem_testing_checklist.md`](intake_ecosystem_testing_checklist.md) Scenario A and/or B.

---

## C — Calendar (gigs)

- [ ] Open **Calendar** (`/calendar`). Events or empty state loads without errors.
- [ ] If you use Google sync: connect/disconnect or sync control still behaves as before (no crash).

---

## D — Dashboard home

- [ ] **Dashboard** (`/`) loads; key cards or shortcuts render; links to main modules work.

---

## E — Earnings (deals & money)

- [ ] **Earnings** (`/earnings`): deals list loads; **Log deal** opens the form.
- [ ] Save a deal with **full event start/end** (and a venue that is not rejected/archived): no silent failure; if **Artist email** is empty in Settings, you see a message about gig emails when the deal qualifies for calendar.
- [ ] **`/earnings?tab=pricing`**: opens the **Pricing** section; you can add/edit catalog items used by intake and deal calculator.
- [ ] Deal row **File Builder (agreement)** link appears when agreement fields are empty (smoke: link opens File Builder).

---

## F — Files & File Builder

- [ ] **Files** (`/files`): list loads; open a file or empty state is fine.
- [ ] **File Builder** (`/files/new`): pick template + optional venue/deal; preview updates; save text or PDF path works for you.
- [ ] **Deep link**: open `/files/new?venueId=<id>&dealId=<id>` (use real IDs from your test data); after data loads, selects match (see “Loading deals…” if deals are still fetching).

---

## G — Gig / deal calendar emails (smoke)

- [ ] After logging a calendar-ready deal from **intake** or **Earnings**, check **Email queue** (`/email-queue`) for expected **gig**-related rows when profile **Artist email** is set and venue status allows calendar (e.g. booked).
- [ ] With **Artist email** cleared in Settings, you still get explicit UI hints on save/import—not a silent empty queue with no explanation.

---

## H — Hub & public forms (smoke)

- [ ] **Booking intakes hub** (`/forms/intakes`) opens if you use it.
- [ ] **Performance report** public link (`/performance-report/:token` with a real token) loads or shows a controlled error—not a blank page.
- [ ] **Venue email ack** bridge (`/venue-email-ack/:token`) smoke if you use tracked links.

---

## I — Internal tools (optional)

- [ ] **Partnership roll admin** (`/workspace/partnerships`): loads for your role; no crash.
- [ ] **Form previews** (`/forms/preview`): loads if you rely on it.

---

## J — (reserved)

---

## K — (reserved)

---

## L — Login (see A)

---

## M — Metrics & reports

- [ ] **Metrics** (`/metrics`): page loads; charts/tables or empty state OK.
- [ ] **Reports** (`/reports`): page loads; export or actions you use still work.

---

## N — Navigation & shell

- [ ] Sidebar/top nav: every item you care about navigates to the right route.
- [ ] **Badges** (if any): update after completing tasks or queue changes (smoke).

---

## O — Outreach (venues & CRM)

- [ ] **Outreach** (`/outreach`): list loads; **Add venue** works; open **venue detail** panel.
- [ ] Change **status** on a row: status saves; if **status-triggered templates** exist and the venue has **multiple deals**, you get a **deal picker** or a clear message—not tasks on the wrong deal.
- [ ] **Edit venue** / contacts / notes: save without errors.

---

## P — Pipeline & task templates

- [ ] **Pipeline** (`/pipeline`): board or list loads; open a venue card and the **progress** side panel.
- [ ] Confirm a progress step that changes **status** and auto-applies templates: same **multi-deal** behavior as Outreach (picker or toast on failure to load deals).
- [ ] **Add / Edit task** from Pipeline: save with a valid **email on complete** type; try an invalid/deleted custom type and confirm you get a **blocked save** with a message.
- [ ] **Pipeline templates** (`/pipeline/templates`): open, edit an item if you use templates; seed/default packs still load.

---

## Q — Email queue & templates

- [ ] **Email queue** (`/email-queue`): rows load; filters or actions you use work.
- [ ] **Email templates** (`/email-templates`): list/editor loads; save a small edit if you routinely change copy.

---

## R — (reserved)

---

## S — Settings & profile

- [ ] **Settings** (`/settings`): profile fields save (**Artist email** especially for gig emails).
- [ ] Change a setting, refresh: value persists.

---

## T — Tasks page redirect

- [ ] Visiting **`/tasks`** redirects to **`/pipeline`** (bookmark compatibility).

---

## U — (reserved)

---

## V — (reserved)

---

## W — Workspace (see I)

---

## X — (reserved)

---

## Y — (reserved)

---

## Z — Zero regressions (quick pass)

- [ ] No page in this checklist throws an **unhandled** error overlay during normal clicks.
- [ ] **Terms** (`/terms`) and **Privacy** (`/privacy`) open if you link to them from the app or footer.

---

## Suggested order in one sitting

1. **A → N → S** (access, nav, settings)  
2. **O → P → Q** (outreach, pipeline, email)  
3. **E → F → G** (earnings, files, queue/calendar smoke)  
4. **B** + [`intake_ecosystem_testing_checklist.md`](intake_ecosystem_testing_checklist.md)  
5. **C, M, R, H, I** as needed for your role  

---

## Document templates (agreements)

- [ ] **Templates** (`/templates`): document templates list loads; open one; **File Builder** can use it (cross-check with **F**).
