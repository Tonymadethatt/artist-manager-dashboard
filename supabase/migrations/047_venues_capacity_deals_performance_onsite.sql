-- Venue capacity for agreement variables; deal performance window + onsite contact

alter table public.venues
  add column if not exists capacity text;

comment on column public.venues.capacity is 'Capacity for agreements (flexible text, e.g. 500, ~200).';

alter table public.deals
  add column if not exists performance_genre text,
  add column if not exists performance_start_at timestamptz,
  add column if not exists performance_end_at timestamptz,
  add column if not exists onsite_contact_id uuid references public.contacts (id) on delete set null;

create index if not exists deals_onsite_contact_id_idx on public.deals (onsite_contact_id);

comment on column public.deals.performance_genre is 'Performance/set genre for agreements.';
comment on column public.deals.performance_start_at is 'DJ or performance set start (UTC); separate from event_start_at.';
comment on column public.deals.performance_end_at is 'DJ or performance set end (UTC).';
comment on column public.deals.onsite_contact_id is 'On-site contact for this deal; app validates contact.venue_id = deal.venue_id.';
