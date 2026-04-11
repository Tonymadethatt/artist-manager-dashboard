-- Deal events published to shared Google calendar + dedup metadata on imported rows.

alter table public.deals
  add column if not exists google_shared_calendar_event_id text,
  add column if not exists google_shared_calendar_event_etag text;

comment on column public.deals.google_shared_calendar_event_id is 'Google Calendar event id on the user shared (DJ) calendar; written by server only.';
comment on column public.deals.google_shared_calendar_event_etag is 'Optional etag for Calendar API If-Match on patch.';

alter table public.calendar_sync_event
  add column if not exists display_status text not null default 'visible'
    check (display_status in ('visible', 'hidden_duplicate', 'needs_review')),
  add column if not exists dedup_pair_deal_id uuid references public.deals(id) on delete set null,
  add column if not exists dedup_rule text,
  add column if not exists dedup_score numeric;

comment on column public.calendar_sync_event.display_status is 'visible = show on Gig calendar; hidden_duplicate = suppressed as duplicate; needs_review = ambiguous overlap.';
comment on column public.calendar_sync_event.dedup_pair_deal_id is 'Related deal when flagged as duplicate or needs review.';

alter table public.google_calendar_connection
  add column if not exists last_deal_push_at timestamptz,
  add column if not exists last_deal_push_error text;

comment on column public.google_calendar_connection.last_deal_push_error is 'Last Google Calendar deal-push failure message for Settings.';
