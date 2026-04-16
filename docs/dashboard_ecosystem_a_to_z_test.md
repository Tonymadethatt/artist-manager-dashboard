# Walk through your whole dashboard — one straight path (second pass)

This version is **longer on purpose**: it catches menu items, mobile layout, badges, money toggles, show forms, and other pieces the first outline skimmed. Still read **top to bottom** when you can—each part explains **why the next part comes next**.

For **every field on the booking call form**, keep using `[intake_ecosystem_testing_checklist.md](intake_ecosystem_testing_checklist.md)`.

**Legend:** `[ ]` not done · `[x]` passed · write down anything weird

---

## Before you start

- Use a **test account** or data you’re allowed to mess with (deals, emails, PDFs).
- Plan **one long session**; if you must stop, note which **part number** you reached.

---

### Part 1 — Get in the door

- Open the app and **sign in** with a good password. You should land **inside** the product.
- Try a **wrong password** once. You should see a normal message, not a broken page.
- **Refresh** while signed in. You should still be signed in, or you should get a **clean login** screen if the session timed out.
- If you ever use a **link that asks you to log in first**, after signing in you should land **back where you were trying to go** (not always dumped on home).

*You’re in. Next you’ll load your **identity and safety switches** so the rest of the test behaves like real life.*

---

### Part 2 — Who you are, how you charge emails, and calendar hooks

This is your **Settings** area—do it before venues so gig mail and calendar aren’t lying to you later.

- Open **Settings**.
- Confirm **artist name / company / tagline** (whatever your agreement and emails pull from). Save if you change anything.
- Set or confirm **artist email** (the inbox **you** read for show-related automations). Save, refresh, confirm it **stuck**.
- If you use **Google Calendar** from here: connect or confirm connection, or deliberately note “we don’t use this” so you’re not surprised later.
- If you use **email test mode** (sending real automations to **safe test inboxes** instead of clients): turn it on only if both **test artist** and **test client** addresses are filled in and **neither matches your real Artist email** (the app blocks that on save). Flip it once and confirm it **saves**. Turn it **off** when you’re done testing if that’s your norm.
- Skim any other **billing / identity** fields you rely on (phone, address, logo) so File Builder and emails aren’t pulling blanks.

*The app knows who you are and how hard to hit real inboxes. Next you’ll use the **home screen** as mission control.*

---

### Part 3 — Home screen, menu, and phone layout

- Open **Overview** (home / dashboard). Wait for cards to finish loading—no endless spinner.
- Read each **summary strip** (tasks due, follow-ups, money, inbox snapshot—whatever you see). Numbers should look **plausible**, not obviously stuck at zero if you have data.
- Click **“view all”** (or similar) on **at least two** cards and confirm you land in the right area.
- **Sidebar:** expand/collapse each **group** (Workspace, Content, Forms, Email) and confirm every link you actually use is there.
- **Badges** (little counts on menu items): note whether **Tasks**, **Email queue**, **Calendar**, or **Show reports** show a number when you know work is waiting. (You’ll sanity-check again at the end.)
- **Mobile or narrow window:** open the **menu button**, slide the menu out, tap a few destinations, **close** the menu—nothing should trap you with a frozen overlay.

*You trust navigation. Next you’ll work **venues and people**—the spine of the CRM.*

---

### Mobile / narrow screens (expectation)

The dashboard is **built for desktop** first (dense tables, intake steps, sidebar). On a phone or very narrow window you can still navigate, but it may feel cramped or slow for real work. Treat **full mobile polish** as a separate project if you need reliable on-the-go ops.

---

### Part 4 — Venues, contacts, and day-to-day outreach

- Open **Outreach** (venue list).
- Use **search** and **filters** (status, type, track) once each—list should respond.
- **Sort** by a different column if offered—order should change in a sensible way.
- **Add a venue** *or* open a safe test venue.
- Open the **side panel** for that venue. Confirm **address**, **status**, **follow-up date**, and **track** show what you expect.
- **Contacts:** add or edit a contact; save; come back—data should **stick**.
- **Notes:** add a short note; it should appear in the thread.
- **Status change:** pick a new status once. If this venue has **more than one gig** on file and your account auto-adds **checklist tasks** on status, the app should **ask which gig** or **tell you what to do**—not attach tasks to the wrong show silently.
- If you use **email from this panel**: queue or send a **venue email** (follow-up, booking note—whatever you have). You should get success or a **clear** block (missing email address, etc.).
- If you use **performance form** from outreach: trigger “send form” (or equivalent) on a safe venue and confirm you get feedback, not silence.
- If you use **import from intake**: open the intake picker and confirm it lists intakes (even if you pick none).

*Relationships are exercised. Next you’ll handle **tasks and the workflow board**.*

---

### Part 5 — Tasks, views, and the progress side panel

- Open **Tasks** (Pipeline).
- Switch **view modes** if you have board vs list—both should render.
- Open a **venue** so the **progress** panel appears (if your layout uses it).
- **Add a task** with a title and due date; save; find it in the list.
- **Edit a task** and set **“when I complete this, send…”** to a **real** built-in type; save successfully.
- Try saving a task with a **bad or deleted custom email type** (if you have one to test). The app should **refuse** and **explain**, not save quietly.
- **Complete a task** (or un-complete one) and confirm the row updates. If completing can trigger **emails or calendar fixes**, watch for a toast or message.
- From the **progress** panel, confirm a step that **changes venue status** if you use that flow—same **multi-gig** rule as Outreach.
- If you use **bulk select / delete**, select two tasks and run your safe bulk action once.

*Operational tasks work. Next you’ll tune **automatic task packs** (different from agreement documents).*

---

### Part 6 — Task templates (checklists tied to pipeline status)

These live under **Tasks → Templates** (pipeline templates—not the Documents page).

- Open **Templates** from the **Tasks** area (pipeline templates).
- Open an existing pack and confirm **trigger status** and **task lines** load.
- Optionally add a **harmless test line** and save, then remove it if you don’t want it.

*Checklist automation is sane. Next you’ll handle **agreement wording** (contracts).*

---

### Part 7 — Document templates (agreement wording)

- Open **Documents** (agreement / document templates—not email templates).
- Open one template; scroll sections; confirm **variables / merge fields** show if you use them.
- Optionally tweak wording and **save**; refresh and confirm.

*Wording library is good. Next you’ll **create files** and optional **public links**.*

---

### Part 8 — Files and File Builder (including “set as deal agreement”)

- Open **Files**. List loads; open one existing file if you have any.
- Open **New file** / **File Builder**.
- Pick a **document template**, tie to a **venue** and **gig** you already have, watch **preview** fill.
- If you use **multiple contacts** at a venue, switch **which contact** merges in and confirm preview changes.
- Save **text** and/or **PDF** the way you normally ship.
- If you use **“this is the agreement for this gig”** checkbox, turn it **on**, save, then open that **deal** in Deals and confirm the agreement pointer or link updated.
- If you rely on **public download links** for agreements, copy the link from the file record and open it in a **private browser** once (should work or politely fail—not a crash).

*Paper trail works. Next you’ll define **prices** so deals and intake imports don’t choke.*

---

### Part 9 — Pricing (inside Deals / Earnings)

- Open **Deals** (Earnings) and switch to the **Pricing** section (packages, hourly rates, add-ons—your labels may vary).
- Confirm **at least one** billable path exists. If not, create a **minimal** package or rate and save.
- Optionally adjust a price and confirm **deal calculator** still behaves on a test deal later.

*Pricing is real. Next you’ll log **money and payment state**.*

---

### Part 10 — Deals, commissions, and payment flags

- Stay in **Deals** on the **deal list**.
- **Open** a test deal *or* **log a new** one.
- Fill **show date**, **start/end time**, **gross**, **venue**, **promise / recap lines** if required, then **save**. You should get confirmation, not a silent failure.
- If the venue was in an **early outreach stage**, saving a full show **may** move it toward **booked** for calendar purposes—note whether that matches what you expect.
- If the venue is **rejected or archived**, note any **honest message** about calendar or email—not a fake success.
- Toggle **artist paid** / **you got paid** (or your equivalents) on a **safe** deal and confirm the row updates.
- If you use **retainers / monthly fees** on this screen, open that area and confirm totals look loaded.
- If you use **take show off calendar / put back on**, try the **safe** control once and read the confirmation copy.
- For a deal **missing** an agreement, use the **shortcut into File Builder** if you see it.

*Money state is exercised. Next you’ll handle **post-show forms** you send to artists.*

---

### Part 11 — Show reports (performance forms you track)

- Open **Show Reports** (performance reports list).
- List loads; open **one row** and confirm details or status make sense.
- If you use **manual show report** entry, open that flow and **start** a row (you can discard if the app allows).
- If you send forms from here, send one to a **safe test** address or yourself.

*Show paperwork is covered. Next you’ll see **gigs in time**.*

---

### Part 12 — Calendar

- Open **Calendar**.
- Navigate **week / month** (whatever you have). No blank crash.
- Confirm a deal you saved with real times **shows** in the right slot, or note **why not** (cancelled, wrong venue stage, etc.)—you’re checking for honesty, not magic.
- If you use **Google sync**, trigger **sync** or open settings from this area once.

*Time view works. Next you’ll inspect **what’s waiting to send** and **how emails read**.*

---

### Part 13 — Email queue, email wording, and management reports

- Open **Reports** under the **Email** section (management / PDF reports—**not** Show Reports). Generate or download whatever you use monthly.
- Open **Email queue**. Items load; open **one** pending item and read recipient, subject, and status.
- If you **cancel**, **reschedule**, or **force send** from here, try the **least risky** action on a test row.
- Open **Email templates** (email copy, not documents). Edit a **tiny** phrase on a template you own, save, refresh, confirm.

*Outbound plumbing is tested. Next you’ll look at **big-picture numbers**.*

---

### Part 14 — Metrics

- Open **Metrics**.
- Each chart or table should **load** or show an **empty** message—not spin forever.
- Change **date range** or filter if available; numbers should **move or explain** themselves.

*Analytics path works. Next you’ll run the **live call** and **import** into everything you just checked.*

---

### Part 15 — Booking intake: hub, call, end, import

- Open **Intakes** (list of calls). You should see rows or a clear empty state.
- **Open one intake** (new or existing) into the **full call workspace**.
- Move through **phases** far enough to prove saves stick (pick a few hard sections: money, promises, close).
- **End call** so post-call work unlocks.
- On the **import** screen, read the **checklist**: venue linked? each show imported? end call recorded? Copy should match reality.
- **Import venue** if needed, then **import deal(s)** or **import all**. Success text should mention anything important (pricing missing, artist email missing, calendar skipped, etc.).
- Click **Open File Builder** after import if offered; venue and gig should **pre-select** when data has loaded.
- **Return to Outreach** and **Deals** and confirm the imported records **match** what the intake claimed.

For **field-by-field** intake coverage, use `[intake_ecosystem_testing_checklist.md](intake_ecosystem_testing_checklist.md)`.

*The loop from call → CRM → money → files is closed.*

---

### Part 16 — Public and edge cases (still in order; skip whole blocks if unused)

- **Forms → Preview:** internal preview pages load.
- **Previous clients** workspace: opens for your login; list or empty state OK.
- Open your real **public booking / partnership form** in a private window; submit a **fake** entry if safe—confirm it lands where you expect (email, list, etc.).
- Open a real **performance report link** an artist would get—form loads or polite error, not a white screen.
- Open a **venue email acknowledgment** link if you use tracked links—should resolve, not error.
- Hit an old bookmark to **Tasks** that isn’t **Pipeline**—you should end up on the **task board** without confusion.

---

### Part 17 — Second pass sanity (same day, after the walk above)

Do these **once** at the end—you’re not redoing the whole story, just catching **drift**.

- **Badges** on the sidebar: do counts still match what you’d expect after everything you did?
- **Overview** home: do the same cards reflect the new deal, tasks, or emails you created?
- **Refresh** on Outreach, Pipeline, Deals, Email queue—no mystery **500** or empty shells.
- **Sign out** from the sidebar; you should return to login cleanly.
- **Terms** and **Privacy** pages open from any footer or legal link.

---

## You’re done when…

Every box you need is checked, surprises are written down, and you’ve run at least **one** full import from intake into Outreach/Deals plus **one** file or email action so the edges of the system actually touched each other.