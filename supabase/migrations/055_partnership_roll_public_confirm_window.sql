-- Public list: 24h edit window, optional final confirmation (locks anon adds).

alter table public.partnership_roll_public_owner
  add column if not exists edit_window_ends_at timestamptz,
  add column if not exists confirmed_at timestamptz;

create policy "partnership_roll_public_owner: anon select"
  on public.partnership_roll_public_owner
  for select
  to anon
  using (id = 1);

drop policy if exists "artist_partnership_roll_entries: anon public list insert"
  on public.artist_partnership_roll_entries;

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
    and (select p.confirmed_at from public.partnership_roll_public_owner p where p.id = 1) is null
    and (
      (select p.edit_window_ends_at from public.partnership_roll_public_owner p where p.id = 1) is null
      or now() <= (select p.edit_window_ends_at from public.partnership_roll_public_owner p where p.id = 1)
    )
  );

create or replace function public.partnership_roll_ensure_deadline()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  ends_at timestamptz;
  conf_at timestamptz;
begin
  update public.partnership_roll_public_owner
  set edit_window_ends_at = now() + interval '24 hours'
  where id = 1
    and confirmed_at is null
    and edit_window_ends_at is null;

  select p.edit_window_ends_at, p.confirmed_at
  into ends_at, conf_at
  from public.partnership_roll_public_owner p
  where p.id = 1;

  return json_build_object(
    'edit_window_ends_at', ends_at,
    'confirmed_at', conf_at
  );
end;
$$;

create or replace function public.partnership_roll_confirm_list()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.partnership_roll_public_owner
  set confirmed_at = now()
  where id = 1
    and confirmed_at is null
    and edit_window_ends_at is not null
    and now() <= edit_window_ends_at;

  get diagnostics n = row_count;
  return n > 0;
end;
$$;

grant execute on function public.partnership_roll_ensure_deadline() to anon;
grant execute on function public.partnership_roll_ensure_deadline() to authenticated;
grant execute on function public.partnership_roll_confirm_list() to anon;
grant execute on function public.partnership_roll_confirm_list() to authenticated;
