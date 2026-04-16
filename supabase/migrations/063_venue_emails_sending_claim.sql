-- Allow process-email-queue to claim a row exclusively before calling Resend (avoids duplicate sends
-- when cron + browser poller + multiple tabs run concurrently).

alter table public.venue_emails
  add column if not exists processing_started_at timestamptz;

comment on column public.venue_emails.processing_started_at is
  'Set when a worker claims this row (status=sending); stale claims are reset to pending for retry.';
