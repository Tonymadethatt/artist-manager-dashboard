-- Cold call workspace + booking intake provenance from cold call conversion.

create table if not exists public.cold_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null default '',
  call_date timestamptz,
  temperature text not null default '',
  outcome text not null default '',
  call_purpose text not null default '',
  duration_feel text not null default '',
  who_answered text not null default '',
  rejection_reason text,
  save_to_pipeline boolean not null default true,
  converted_to_intake_id uuid references public.booking_intakes(id) on delete set null,
  previous_call_id uuid references public.cold_calls(id) on delete set null,
  call_data jsonb not null default '{}'::jsonb,
  notes text,
  follow_up_date date,
  next_actions jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cold_calls_user_updated_idx
  on public.cold_calls (user_id, updated_at desc);

create index if not exists cold_calls_venue_id_idx
  on public.cold_calls (venue_id)
  where venue_id is not null;

create index if not exists cold_calls_temperature_idx
  on public.cold_calls (user_id, temperature);

create trigger cold_calls_updated_at
  before update on public.cold_calls
  for each row execute function public.update_updated_at();

alter table public.cold_calls enable row level security;

create policy "cold_calls: owner select"
  on public.cold_calls for select
  using (auth.uid() = user_id);

create policy "cold_calls: owner insert"
  on public.cold_calls for insert
  with check (auth.uid() = user_id);

create policy "cold_calls: owner update"
  on public.cold_calls for update
  using (auth.uid() = user_id);

create policy "cold_calls: owner delete"
  on public.cold_calls for delete
  using (auth.uid() = user_id);

alter table public.booking_intakes
  add column if not exists source_type text not null default 'booking',
  add column if not exists source_cold_call_id uuid references public.cold_calls(id) on delete set null;

create index if not exists booking_intakes_source_cold_call_idx
  on public.booking_intakes (source_cold_call_id)
  where source_cold_call_id is not null;
