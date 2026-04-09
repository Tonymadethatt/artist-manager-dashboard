-- When set, the deal is excluded from the gig calendar (show cancelled) but remains in Earnings for history.
alter table public.deals
  add column if not exists event_cancelled_at timestamptz null;

comment on column public.deals.event_cancelled_at is 'Pacific-aware cancellation timestamp; when non-null, deal does not appear on calendar or calendar automations.';
