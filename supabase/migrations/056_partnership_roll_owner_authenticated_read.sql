-- Logged-in visitors use role "authenticated"; they could not read partnership_roll_public_owner (only "anon" had SELECT).
-- Without this, the countdown stayed on "Starting timer…" when testing while signed into the dashboard.

create policy "partnership_roll_public_owner: authenticated select"
  on public.partnership_roll_public_owner
  for select
  to authenticated
  using (id = 1);
