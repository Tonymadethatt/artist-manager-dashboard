-- Lead intake Phase 6: link a lead to a client-pipeline venue after promotion.

alter table public.leads
  add column if not exists promoted_venue_id uuid,
  add column if not exists promoted_at timestamptz;

comment on column public.leads.promoted_venue_id is 'Outreach / client venue created from or linked to this lead.';
comment on column public.leads.promoted_at is 'When the lead was promoted into the main pipeline.';

create index if not exists leads_user_promoted_venue_idx
  on public.leads (user_id, promoted_venue_id)
  where promoted_venue_id is not null;

alter table public.leads
  add constraint leads_promoted_venue_fkey
  foreign key (promoted_venue_id)
  references public.venues (id)
  on delete set null;
