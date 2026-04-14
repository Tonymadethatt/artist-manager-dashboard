-- Extend public edit window: 24h → 34h for new timers; +10h for any still-open (unconfirmed) deadline.

update public.partnership_roll_public_owner
set edit_window_ends_at = edit_window_ends_at + interval '10 hours'
where id = 1
  and confirmed_at is null
  and edit_window_ends_at is not null
  and edit_window_ends_at > now();

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
  set edit_window_ends_at = now() + interval '34 hours'
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
