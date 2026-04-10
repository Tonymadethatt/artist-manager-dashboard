# Fix: Auto-Send Email Queue via External Cron Job

## What this document is

A complete handoff for an AI assistant with access to a **cron-job MCP server** (e.g. cron-job.org). The goal: set up one external cron job so that queued emails auto-send. Everything else in the codebase is already working — the only missing piece is the cron trigger.

### Operational status (Feb 2026)

- A cron-job.org job for this queue **already existed**: title **Artist Manager — Process Email Queue (every 1 min)**, **job ID `7455108`**, correct URL, **POST**, **every minute** (UTC), and **`X-Queue-Secret`** header set.
- It was **`enabled: false`**, so Netlify **`process-email-queue` was never invoked** — that matches “auto-send is dead” while manual Send still worked.
- **Fix:** the job was **turned on** via MCP (`update_job` → `enabled: true`). No repo or Netlify function changes were required for this step.
- **You must confirm** Netlify **`PROCESS_QUEUE_SECRET`** exactly matches the **`X-Queue-Secret`** header on that cron job; otherwise every run returns **401** and the queue never drains.

### Sunday two-week digest (separate trigger)

- **`enqueue-gig-calendar-digest`** is still wired in **`netlify.toml`** (`cron = "5 * * * *"`). If Netlify scheduled functions remain flaky on your plan, add a **second** external cron (e.g. **hourly** POST to `https://artist-manager-dashboard.netlify.app/.netlify/functions/enqueue-gig-calendar-digest` with the same **`X-Queue-Secret`**). The handler only inserts rows when America/Los_Angeles is Sunday **5:00**–**5:59**; other hours no-op.

---

## The problem

This app (artist-manager dashboard on Netlify) has an email queue system. Emails are inserted into a `venue_emails` table in Supabase with `status = 'pending'`. A Netlify function called `process-email-queue` reads pending rows, checks timing/buffer rules, and sends them via Resend.

**The function works perfectly when called.** Manual sends from the UI work. The logic is tested and correct.

**The function is never called automatically.** It was designed to be hit by an external cron job every minute, but that cron was never configured. As a result:
- No emails auto-send. Ever.
- The user has been manually clicking "Send now" on every single email.
- The entire auto-send feature (with configurable 5/10/15/20/30 minute buffer) is dead.

### What was tried and failed

1. **Netlify Scheduled Functions** (`[[schedule]]` in `netlify.toml` with `cron = "* * * * *"`): Added, deployed, verified deploy succeeded. Function logs remain empty — Netlify never invokes it. The `netlify.toml` still has this config as a backup, but it does not work in practice (possibly a free-plan limitation, possibly a Netlify bug).

2. **Client-side polling** (`useAutoSendQueue` hook in `src/hooks/useAutoSendQueue.ts`): Added as a stopgap — polls the function every 60s from the browser using the user's Supabase JWT. This works BUT only while the browser tab is open, which defeats the purpose. It's left in place as a supplement for responsiveness, not a replacement.

3. **The cron-job MCP was available the whole time** but was never used. That is what needs to happen now.

---

## The one thing you need to do

### Create a cron job with these exact settings:

| Setting | Value |
|---------|-------|
| **URL** | `https://artist-manager-dashboard.netlify.app/.netlify/functions/process-email-queue` |
| **Method** | `POST` |
| **Schedule** | Every **1 minute** (cron expression: `* * * * *`) |
| **Header** | `X-Queue-Secret` : (see below) |
| **Request body** | Empty / none |
| **Timeout** | 30 seconds (the function completes well within this) |

### The `X-Queue-Secret` header value

The function authenticates callers via the `X-Queue-Secret` header, matched against the `PROCESS_QUEUE_SECRET` environment variable in Netlify.

**Check if `PROCESS_QUEUE_SECRET` already exists:**
- Netlify dashboard -> Site configuration -> Environment variables
- Look for `PROCESS_QUEUE_SECRET`

**If it exists:** Use that value as the `X-Queue-Secret` header in the cron job.

**If it does NOT exist:**
1. Generate a random secret (e.g. 32+ character alphanumeric string)
2. Set it as the `X-Queue-Secret` header value in the cron job
3. Tell the user to add it as `PROCESS_QUEUE_SECRET` in Netlify env vars (Site configuration -> Environment variables), then trigger a redeploy

---

## How to verify it works

After the cron job is created:

1. **Wait 2-3 minutes**, then check the Netlify function logs for `process-email-queue`. You should see invocations appearing every minute.

2. **The response body** from the function looks like:
   ```json
   {"processed": 0, "sent": 0, "failed": 0, "results": [], "v": "2026-04-09-reminder-guard"}
   ```
   - `processed: 0` is normal when the queue is empty.
   - Optional `v` string is a deploy marker in code; if you see it, the latest worker bundle is live.
   - If you get `401 Unauthorized`, the secret doesn't match Netlify `PROCESS_QUEUE_SECRET`.

3. **End-to-end test:** Have the user book a gig in the app (Earnings page). Two emails will queue:
   - `gig_booked_ics` — should auto-send after the user's buffer time (5 min default)
   - `gig_reminder_24h` — should show "Scheduled" in the queue UI and only send ~24h before the show

---

## Architecture context (do not change any of this)

### Repo and deploy
- **Repo:** `https://github.com/Tonymadethatt/artist-manager-dashboard.git`
- **Local path:** `D:\Main Assets\Brands\Brand Powr\ARTIST MANAGER WEBSITE`
- **Hosting:** Netlify (free plan)
- **Branch:** `main` (auto-deploys on push)

### The function: `netlify/functions/process-email-queue.ts`
- **Trigger:** POST request with auth
- **Auth:** Accepts THREE methods (any one suffices):
  1. `X-Queue-Secret` header matching `PROCESS_QUEUE_SECRET` env var (**this is what the cron should use**)
  2. `netlify-scheduled-function: true` header (Netlify scheduled functions — not working)
  3. `Authorization: Bearer <supabase-jwt>` (client-side polling supplement)
- **What it does:** Reads pending `venue_emails` rows from Supabase, checks buffer times and `scheduled_send_at`, sends eligible ones via Resend API, marks rows as `sent` or `failed`.
- **Env vars it needs (already set in Netlify):**
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `PROCESS_QUEUE_SECRET` (may need to be created — see above)

### Email buffer system
- Users choose a buffer time: 5, 10, 15, 20, or 30 minutes (stored in `artist_profile.email_queue_buffer_minutes`)
- After an email is queued, the function waits until `created_at + buffer_minutes` has elapsed before sending
- Some email types (artist-facing, gig calendar) use buffer = 0, meaning they send on the next cron tick
- `gig_reminder_24h` emails have `scheduled_send_at` set to 24h before show time and use `shouldSendGigReminderNow()` — the function correctly skips them until they're due

### What NOT to touch
- Do not modify any application code
- Do not modify `netlify.toml`
- Do not modify any Netlify function files
- Do not change Supabase schema or tables
- The ONLY action needed is creating the external cron job

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Cron returns `401 Unauthorized` | `X-Queue-Secret` header doesn't match `PROCESS_QUEUE_SECRET` env var | Verify the secret value matches exactly; redeploy Netlify after adding/changing env var |
| Cron returns `405 Method not allowed` | Request method is GET instead of POST | Change cron method to POST |
| Cron returns `500` with Supabase error | `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` not set | Check Netlify env vars |
| Cron returns `500` with Resend error | `RESEND_API_KEY` not set | Check Netlify env vars |
| Cron succeeds but emails don't send | Buffer time hasn't elapsed, or `scheduled_send_at` is in the future | This is correct behavior — wait for the buffer, check the response JSON for details |
| Cron returns **500** | Unhandled exception in `process-email-queue`, or bad Supabase/Resend config | Turn on **Save responses** on the cron job; response body may be JSON with `error` / `code`. Check Netlify function logs. Common fixes: ensure **`URL`** / deploy URL env is present, or rely on deploy that includes **`resolveSiteUrl()`** fallback; ensure **`X-Queue-Secret`** matches **`PROCESS_QUEUE_SECRET`** full string (UI may truncate the display — compare character count). |
| Three duplicate jobs hitting the same URL | Accidental duplicates | Disable or delete extras; one POST/minute is enough. |
| Function logs still empty on Netlify | Netlify log retention is limited; check within minutes of a cron fire | Alternatively, check the cron-job.org dashboard for response codes |

---

## Summary

One cron job. POST to the URL. Every minute. With the secret header. That's it. Everything else is built and working.
