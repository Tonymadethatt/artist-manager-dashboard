-- User-scoped pricing catalog (JSON document) and deal pricing snapshot + deposit tracking.

create table if not exists public.user_pricing_catalog (
  user_id uuid primary key references auth.users (id) on delete cascade,
  doc jsonb not null default '{"v":1}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.user_pricing_catalog is 'One row per manager: reusable packages, services, add-ons, discounts, surcharges (see doc.v).';
comment on column public.user_pricing_catalog.doc is 'Versioned catalog JSON; v1 shape defined in app types.';

create trigger user_pricing_catalog_updated_at
  before update on public.user_pricing_catalog
  for each row execute function public.update_updated_at();

alter table public.user_pricing_catalog enable row level security;

create policy "user_pricing_catalog: owner select"
  on public.user_pricing_catalog for select
  using (auth.uid() = user_id);

create policy "user_pricing_catalog: owner insert"
  on public.user_pricing_catalog for insert
  with check (auth.uid() = user_id);

create policy "user_pricing_catalog: owner update"
  on public.user_pricing_catalog for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_pricing_catalog: owner delete"
  on public.user_pricing_catalog for delete
  using (auth.uid() = user_id);

-- Deal pricing: persisted calculator output + deposit progress (whole-dollar UX in app).
alter table public.deals
  add column if not exists pricing_snapshot jsonb,
  add column if not exists deposit_due_amount numeric(10, 2),
  add column if not exists deposit_paid_amount numeric(10, 2) not null default 0;

comment on column public.deals.pricing_snapshot is 'Nullable JSON: calculator inputs, line breakdown, finalSource, tax % snapshot, etc.';
comment on column public.deals.deposit_due_amount is 'Expected deposit (e.g. 50% of total); null if not set.';
comment on column public.deals.deposit_paid_amount is 'Amount paid toward deposit; balance is conceptual (gross - payments) in UI.';
