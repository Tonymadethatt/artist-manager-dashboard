-- Call intake workspace: one venue-shaped JSON per intake, N show drafts per intake.
-- Owner-only via RLS; child rows gated by parent intake ownership.

create table if not exists public.booking_intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  venue_data jsonb not null default '{}'::jsonb,
  schema_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_intake_shows (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.booking_intakes(id) on delete cascade,
  label text not null default '',
  show_data jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  imported_deal_id uuid references public.deals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_intakes_user_updated_idx
  on public.booking_intakes (user_id, updated_at desc);

create index if not exists booking_intake_shows_intake_sort_idx
  on public.booking_intake_shows (intake_id, sort_order);

create trigger booking_intakes_updated_at
  before update on public.booking_intakes
  for each row execute function public.update_updated_at();

create trigger booking_intake_shows_updated_at
  before update on public.booking_intake_shows
  for each row execute function public.update_updated_at();

alter table public.booking_intakes enable row level security;
alter table public.booking_intake_shows enable row level security;

create policy "booking_intakes: owner select"
  on public.booking_intakes for select
  using (auth.uid() = user_id);

create policy "booking_intakes: owner insert"
  on public.booking_intakes for insert
  with check (auth.uid() = user_id);

create policy "booking_intakes: owner update"
  on public.booking_intakes for update
  using (auth.uid() = user_id);

create policy "booking_intakes: owner delete"
  on public.booking_intakes for delete
  using (auth.uid() = user_id);

create policy "booking_intake_shows: owner via intake select"
  on public.booking_intake_shows for select
  using (
    exists (
      select 1 from public.booking_intakes bi
      where bi.id = intake_id and bi.user_id = auth.uid()
    )
  );

create policy "booking_intake_shows: owner via intake insert"
  on public.booking_intake_shows for insert
  with check (
    exists (
      select 1 from public.booking_intakes bi
      where bi.id = intake_id and bi.user_id = auth.uid()
    )
  );

create policy "booking_intake_shows: owner via intake update"
  on public.booking_intake_shows for update
  using (
    exists (
      select 1 from public.booking_intakes bi
      where bi.id = intake_id and bi.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.booking_intakes bi
      where bi.id = intake_id and bi.user_id = auth.uid()
    )
  );

create policy "booking_intake_shows: owner via intake delete"
  on public.booking_intake_shows for delete
  using (
    exists (
      select 1 from public.booking_intakes bi
      where bi.id = intake_id and bi.user_id = auth.uid()
    )
  );
