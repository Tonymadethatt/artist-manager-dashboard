-- DJ / artist partnership roll: past clients & brands for agreement + outreach clarity.
-- One row per partner name; cohort splits "past year" vs older archive.

create table if not exists public.artist_partnership_roll_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  cohort text not null default 'older' check (cohort in ('recent', 'older')),
  is_confirmed boolean not null default false,
  confirmed_at timestamptz,
  source text not null default 'system' check (source in ('system', 'dj', 'admin', 'mock')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artist_partnership_roll_entries_user_cohort_idx
  on public.artist_partnership_roll_entries (user_id, cohort, sort_order);

create index if not exists artist_partnership_roll_entries_user_updated_idx
  on public.artist_partnership_roll_entries (user_id, updated_at desc);

create trigger artist_partnership_roll_entries_updated_at
  before update on public.artist_partnership_roll_entries
  for each row execute function public.update_updated_at();

alter table public.artist_partnership_roll_entries enable row level security;

create policy "artist_partnership_roll_entries: owner select"
  on public.artist_partnership_roll_entries for select
  using (auth.uid() = user_id);

create policy "artist_partnership_roll_entries: owner insert"
  on public.artist_partnership_roll_entries for insert
  with check (auth.uid() = user_id);

create policy "artist_partnership_roll_entries: owner update"
  on public.artist_partnership_roll_entries for update
  using (auth.uid() = user_id);

create policy "artist_partnership_roll_entries: owner delete"
  on public.artist_partnership_roll_entries for delete
  using (auth.uid() = user_id);
