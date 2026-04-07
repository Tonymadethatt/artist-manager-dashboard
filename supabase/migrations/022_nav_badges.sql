-- Navigation badge persistence.
-- Tracks when the user last "saw" each section (model A: pipeline, show-reports)
-- and provides an atomic key-merge RPC so JS never does fetch-merge-write.
-- Email Queue uses a live pending count and needs no seen_at entry.

create table public.nav_badges (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  seen_at  jsonb not null default '{}'::jsonb
);

alter table public.nav_badges enable row level security;

create policy "nav_badges: owner access" on public.nav_badges
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Atomically sets seen_at[p_section] = now() without overwriting other keys.
-- Uses jsonb || merge so concurrent updates to different sections are safe.
create or replace function public.update_nav_badge_seen(p_section text)
returns void
language sql
security invoker
as $$
  insert into public.nav_badges (user_id, seen_at)
  values (
    auth.uid(),
    jsonb_build_object(p_section, now())
  )
  on conflict (user_id) do update
  set seen_at = nav_badges.seen_at || jsonb_build_object(p_section, now());
$$;
