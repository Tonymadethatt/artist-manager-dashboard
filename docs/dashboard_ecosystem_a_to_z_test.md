# Walk through your whole dashboard — one straight path

Read this **from top to bottom** in order. Each part picks up where the last one left off, so you shouldn’t need to jump backward. Check the boxes as you finish each item. If something breaks, jot it down and keep going when you can.

For a **deep dive on the live booking call form** (every section of the intake), use the separate guide: [`intake_ecosystem_testing_checklist.md`](intake_ecosystem_testing_checklist.md) after you’ve finished this walk—or use it in place of the shorter “call” step at the end if you want the full story.

---

## Before you start

- [ ] Set aside enough time to move through in **one go** (or pause only between the big parts marked below).
- [ ] Use the **same menu** you always use to move around the app—no need to memorize any special links.

---

### Part 1 — Get in the door

You can’t test anything until you’re inside the product.

- [ ] Open the app and **sign in** with a good password. You should land somewhere that feels like “inside” the tool, not an error page.
- [ ] Try a **wrong password** once. You should get a normal, readable message—not a blank screen.
- [ ] **Refresh the page** while you’re signed in. You should still be signed in (or, if your session expired, you should get a clear sign-in screen—not a broken page).

*You’re in. Next you’ll set up the basics that everything else depends on.*

---

### Part 2 — Who you are in the app (so emails and gigs make sense later)

Before you touch venues or money, put your own details in place. Later steps assume the app knows how to reach **you** for artist-side messages.

- [ ] Open **Settings** (your profile / account area).
- [ ] Fill in or confirm your **artist email** (the one you use for show-related notifications). Save.
- [ ] Change something small, save, then **refresh** and make sure it **stuck**.

*Now the app can talk to you honestly when something is missing. Next you’ll see your home base, then start with the people and places you sell to.*

---

### Part 3 — Your home screen (orientation)

- [ ] Open the **main dashboard / home** (the first screen you usually see after login).
- [ ] Click whatever shortcuts or cards you rely on (venues, pipeline, money, etc.) and confirm they take you to the right place.

*You know how to move around. Next you’ll work the **venue list**—that’s the spine of the rest.*

---

### Part 4 — Venues and contacts (who you’re talking to)

This is your Rolodex of rooms and the people who book you.

- [ ] Open **Outreach** (or whatever you call the list of venues).
- [ ] **Add a test venue** *or* open one you already use for testing.
- [ ] **Click a venue** so the **side panel** opens with details, contacts, and notes.
- [ ] Change something small (status, a note, a follow-up date) and save. It should feel instant and stay after you click away and come back.
- [ ] If you use **status** dropdowns: change status once. If that venue has **more than one gig** saved under it and your account uses **automatic checklists** when status changes, the app should either **ask which gig** the checklist belongs to or tell you clearly what to do—not silently attach tasks to the wrong show.

*You’ve exercised the relationship side. Next you’ll handle **tasks** for those same venues.*

---

### Part 5 — Your to-do list tied to venues (Pipeline)

Tasks are the “what’s next” layer on top of the venues you just touched.

- [ ] Open **Pipeline** (your task board or list).
- [ ] Open a **venue** there so the **progress** strip or panel shows up (if your layout uses one).
- [ ] Add or edit a **task** and save. If you pick **“send an email when this is done,”** pick a real option from the list and save—then try saving with a **broken or old** custom email type (if you have one to test) and confirm the app **stops you** with a clear message instead of saving garbage.
- [ ] If you can, **complete a task** or **move a progress step** that changes venue status. Same rule as Outreach: **multiple gigs** should trigger a **clear choice or message**, not wrong links.

*Tasks and venue progress are covered. Next you’ll touch **paperwork**—agreements and files.*

---

### Part 6 — Agreement wording (templates)

Before you generate a PDF, you want the wording library to be there.

- [ ] Open **Templates** (the place where agreement / document wording lives—not the email wording screen).
- [ ] Open one template and confirm it loads. You don’t have to edit it unless you want to.

*You’ve confirmed the library. Next you’ll **build a file** from that kind of content.*

---

### Part 7 — Files and the file builder (contracts and PDFs)

- [ ] Open **Files** and confirm your file list loads (even if it’s empty).
- [ ] Open **File Builder** (create a new file / agreement).
- [ ] Pick a **template**, optionally tie it to a **venue** and **gig** you already have, and check that the **preview** fills in with sensible info.
- [ ] Save **text or PDF** the way you normally would (whatever your routine is).

*Paper trail works. Next you’ll set **how you price**, because money and imports depend on it.*

---

### Part 8 — How you charge (inside Earnings)

Deal math and the **booking call import** both need at least one real price rule here.

- [ ] Open **Earnings**, then go to the **Pricing** area (packages, hourly rates—whatever your screen calls it).
- [ ] Confirm you have **at least one** package or hourly rate. If not, add a simple one and save.

*Pricing is real. Next you’ll log or open **actual gigs and dollars**.*

---

### Part 9 — Gigs and money (deals)

- [ ] Stay in **Earnings** and open the **Deals** list.
- [ ] **Log a new deal** *or* open an existing test deal.
- [ ] Save a deal that has a **real start and end time** for the show and a venue that isn’t marked “dead” (not rejected/archived). You should **not** feel like the save “did nothing.” If your artist email was missing, you should have been warned **in plain language** earlier in Settings—here you might still see a helpful note if something about calendar emails is off.
- [ ] Find a deal **without** an agreement attached and use the **shortcut to open File Builder** if your screen shows one—it should feel like a natural next step.

*Money is in the system. Next you’ll **see the show on the calendar**.*

---

### Part 10 — Calendar (where the gig sits in time)

- [ ] Open **Calendar**.
- [ ] Confirm the page loads and that anything you’d expect from the deal you just saved **shows up** or you see an honest empty week—not an error.

*You’ve seen time view. Next you’ll check **what the system queued to send**.*

---

### Part 11 — Outbound email (queue and wording)

Now that you’ve moved money and maybe triggered automations, you look at the mail pipe.

- [ ] Open **Email queue**. You should see a normal list (even if it’s quiet). Nothing should look “stuck loading forever.”
- [ ] Open **Email templates** (the place you edit **sent email copy**). Open one template, optionally tweak a word and save if that’s part of your routine.

*Comms path is exercised. Next you’ll zoom out to **numbers and exports**.*

---

### Part 12 — Metrics and reports (business snapshot)

- [ ] Open **Metrics**. Charts or tables should load; an empty honest state is fine.
- [ ] Open **Reports** and run whatever export or view you actually use once in a while.

*You’ve stress-tested ops and money views. Next you’ll run the **live call** path that feeds everything you already visited.*

---

### Part 13 — Booking intake (the call that fills the CRM)

This is the long form you use **on a live booking call**. You already set up pricing and you know where venues and deals land—so this step is about the **handoff** from call → saved intake → **import** into Outreach and Earnings.

- [ ] Open **Booking intake** (from your intakes hub or main menu).
- [ ] Walk through enough of a **fake call** to reach **post-call** and **End call** (you don’t have to fill every field for a smoke test).
- [ ] On the **import** screen, read the **checklist**: it should say clearly what’s already in your database and what still needs an **Import** button.
- [ ] **Import the venue** (if it’s a new place) and **import at least one deal** (or use **import all**). You should see success messages, not mystery silence.
- [ ] If you cleared pricing earlier on purpose, the app should **block** deal import and **point you back to pricing**—that’s correct behavior.
- [ ] After a good import, use **Open file builder** if it appears and confirm the right **place and gig** are selected.

For a **field-by-field** intake test, switch to [`intake_ecosystem_testing_checklist.md`](intake_ecosystem_testing_checklist.md).

*The full loop—call → CRM → money → files—is complete.*

---

### Part 14 — Optional extras (only if you use them)

Do these **in order** only if they matter to your business; skip entirely if not.

- [ ] **Booking intakes hub** (list of intakes): opens and lists rows.
- [ ] **Partnership / previous-clients admin** (if you have that workspace): opens for your login.
- [ ] **Form previews** (internal): loads.
- [ ] Open a real **performance report link** someone would get by email: you get a real form or a polite “not found,” not a white screen.
- [ ] If you bookmarked an old **Tasks** link, it should land you on **Pipeline** without confusion.

---

### Part 15 — Close the loop

- [ ] Click **Terms** and **Privacy** from wherever your app links them (footer, etc.). Both should open.
- [ ] **Sign out** if you have that control, or close the browser—no scary error overlays on the way out.

---

## You’re done when…

Every box you care about is checked, and you’ve written down anything that felt wrong. You’ve walked **one continuous story**: identity → venues → tasks → paperwork → pricing → money → calendar → email → reports → live call → handoff into the same system you already tested.
