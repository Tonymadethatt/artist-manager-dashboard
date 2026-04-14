-- Public previous-clients page: anonymous read + insert into one designated user's list.
-- After applying: insert the row (once) in SQL editor — use the same UUID as VITE_PARTNERSHIP_ROLL_OWNER_ID:
--   insert into public.partnership_roll_public_owner (id, artist_user_id)
--   values (1, 'YOUR_AUTH_USER_UUID_HERE')
--   on conflict (id) do update set artist_user_id = excluded.artist_user_id;

create table if not exists public.partnership_roll_public_owner (
  id smallint primary key default 1 check (id = 1),
  artist_user_id uuid not null references auth.users (id) on delete cascade
);

comment on table public.partnership_roll_public_owner is
  'Single row: auth.users.id for the partnership roll that anonymous visitors may read and append to.';

alter table public.partnership_roll_public_owner enable row level security;

create policy "artist_partnership_roll_entries: anon public list select"
  on public.artist_partnership_roll_entries  for select
  to anon
  using (
    user_id = (select p.artist_user_id from public.partnership_roll_public_owner p where p.id = 1)
  );

create policy "artist_partnership_roll_entries: anon public list insert"
  on public.artist_partnership_roll_entries
  for insert
  to anon
  with check (
    user_id = (select p.artist_user_id from public.partnership_roll_public_owner p where p.id = 1)
    and cohort = 'recent'
    and source in ('dj', 'system')
    and is_confirmed = false
    and length(btrim(name)) between 1 and 400
  );
