-- Public previous-clients: anon + authenticated may update or delete rows during the open review window (before list is confirmed).

create policy "artist_partnership_roll_entries: anon public list update"
  on public.artist_partnership_roll_entries
  for update
  to anon
  using (
    user_id = (select p.artist_user_id from public.partnership_roll_public_owner p where p.id = 1)
    and cohort = 'recent'
    and (select p.confirmed_at from public.partnership_roll_public_owner p where p.id = 1) is null
    and (
      (select p.edit_window_ends_at from public.partnership_roll_public_owner p where p.id = 1) is null
      or now() <= (select p.edit_window_ends_at from public.partnership_roll_public_owner p where p.id = 1)
    )
  )
  with check (
    user_id = (select p.artist_user_id from public.partnership_roll_public_owner p where p.id = 1)
    and cohort = 'recent'
    and is_confirmed = false
    and source in ('system', 'dj')
    and length(btrim(name)) between 1 and 400
    and (select p.confirmed_at from public.partnership_roll_public_owner p where p.id = 1) is null
    and (
      (select p.edit_window_ends_at from public.partnership_roll_public_owner p where p.id = 1) is null
      or now() <= (select p.edit_window_ends_at from public.partnership_roll_public_owner p where p.id = 1)
    )
  );

create policy "artist_partnership_roll_entries: anon public list delete"
  on public.artist_partnership_roll_entries
  for delete
  to anon
  using (
    user_id = (select p.artist_user_id from public.partnership_roll_public_owner p where p.id = 1)
    and cohort = 'recent'
    and (select p.confirmed_at from public.partnership_roll_public_owner p where p.id = 1) is null
    and (
      (select p.edit_window_ends_at from public.partnership_roll_public_owner p where p.id = 1) is null
      or now() <= (select p.edit_window_ends_at from public.partnership_roll_public_owner p where p.id = 1)
    )
  );

create policy "artist_partnership_roll_entries: authenticated public list update"
  on public.artist_partnership_roll_entries
  for update
  to authenticated
  using (
    user_id = (select p.artist_user_id from public.partnership_roll_public_owner p where p.id = 1)
    and cohort = 'recent'
    and (select p.confirmed_at from public.partnership_roll_public_owner p where p.id = 1) is null
    and (
      (select p.edit_window_ends_at from public.partnership_roll_public_owner p where p.id = 1) is null
      or now() <= (select p.edit_window_ends_at from public.partnership_roll_public_owner p where p.id = 1)
    )
  )
  with check (
    user_id = (select p.artist_user_id from public.partnership_roll_public_owner p where p.id = 1)
    and cohort = 'recent'
    and is_confirmed = false
    and source in ('system', 'dj')
    and length(btrim(name)) between 1 and 400
    and (select p.confirmed_at from public.partnership_roll_public_owner p where p.id = 1) is null
    and (
      (select p.edit_window_ends_at from public.partnership_roll_public_owner p where p.id = 1) is null
      or now() <= (select p.edit_window_ends_at from public.partnership_roll_public_owner p where p.id = 1)
    )
  );

create policy "artist_partnership_roll_entries: authenticated public list delete"
  on public.artist_partnership_roll_entries
  for delete
  to authenticated
  using (
    user_id = (select p.artist_user_id from public.partnership_roll_public_owner p where p.id = 1)
    and cohort = 'recent'
    and (select p.confirmed_at from public.partnership_roll_public_owner p where p.id = 1) is null
    and (
      (select p.edit_window_ends_at from public.partnership_roll_public_owner p where p.id = 1) is null
      or now() <= (select p.edit_window_ends_at from public.partnership_roll_public_owner p where p.id = 1)
    )
  );
