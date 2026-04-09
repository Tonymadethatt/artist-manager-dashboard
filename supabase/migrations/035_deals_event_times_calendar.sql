-- Gig calendar: start/end instants (California-oriented backfill), ICS + reminder bookkeeping, scheduled queue sends.

alter table public.deals
  add column if not exists event_start_at timestamptz,
  add column if not exists event_end_at timestamptz,
  add column if not exists ics_invite_sent_at timestamptz,
  add column if not exists reminder_24h_queued_at timestamptz;

comment on column public.deals.event_start_at is 'Show start (stored as timestamptz UTC; UI defaults America/Los_Angeles for v1)';
comment on column public.deals.event_end_at is 'Show end';
comment on column public.deals.ics_invite_sent_at is 'When automatic .ics invite email was first sent for this deal';
comment on column public.deals.reminder_24h_queued_at is 'When 24h reminder row was last queued (idempotency)';

-- Backfill from legacy event_date: default 8pm–11pm America/Los_Angeles on that calendar date (3h block).
update public.deals d
set
  event_start_at = ((d.event_date + time '20:00:00') at time zone 'America/Los_Angeles'),
  event_end_at = ((d.event_date + time '23:00:00') at time zone 'America/Los_Angeles')
where d.event_date is not null
  and d.event_start_at is null;

alter table public.venue_emails
  add column if not exists scheduled_send_at timestamptz;

comment on column public.venue_emails.scheduled_send_at is 'If set, process-email-queue only sends when now() >= this instant (for delayed reminders). NULL = legacy immediate-after-buffer behavior';

create index if not exists deals_event_start_at_idx on public.deals (event_start_at);
create index if not exists venue_emails_scheduled_send_at_idx on public.venue_emails (scheduled_send_at) where status = 'pending';
