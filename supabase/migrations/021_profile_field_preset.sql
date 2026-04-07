-- Saved preset strings per settings field (Supabase-backed, not localStorage)

create table public.profile_field_preset (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  field_key text not null,
  value text not null,
  created_at timestamptz not null default now(),
  constraint profile_field_preset_field_key_check check (
    field_key in (
      'artist_name',
      'artist_email',
      'manager_name',
      'manager_email',
      'from_email',
      'company_name',
      'website',
      'phone',
      'social_handle',
      'tagline',
      'reply_to_email'
    )
  ),
  constraint profile_field_preset_user_field_value_unique unique (user_id, field_key, value)
);

create index profile_field_preset_user_field_idx on public.profile_field_preset (user_id, field_key);

alter table public.profile_field_preset enable row level security;

create policy "profile_field_preset: owner access" on public.profile_field_preset
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Seed presets from existing profile rows (non-empty trimmed values only)

insert into public.profile_field_preset (user_id, field_key, value)
select user_id, 'artist_name', trim(artist_name)
from public.artist_profile
where trim(artist_name) <> ''
on conflict (user_id, field_key, value) do nothing;

insert into public.profile_field_preset (user_id, field_key, value)
select user_id, 'artist_email', trim(artist_email)
from public.artist_profile
where trim(artist_email) <> ''
on conflict (user_id, field_key, value) do nothing;

insert into public.profile_field_preset (user_id, field_key, value)
select user_id, 'manager_name', trim(manager_name)
from public.artist_profile
where manager_name is not null and trim(manager_name) <> ''
on conflict (user_id, field_key, value) do nothing;

insert into public.profile_field_preset (user_id, field_key, value)
select user_id, 'manager_email', trim(manager_email)
from public.artist_profile
where manager_email is not null and trim(manager_email) <> ''
on conflict (user_id, field_key, value) do nothing;

insert into public.profile_field_preset (user_id, field_key, value)
select user_id, 'from_email', trim(from_email)
from public.artist_profile
where trim(from_email) <> ''
on conflict (user_id, field_key, value) do nothing;

insert into public.profile_field_preset (user_id, field_key, value)
select user_id, 'company_name', trim(company_name)
from public.artist_profile
where company_name is not null and trim(company_name) <> ''
on conflict (user_id, field_key, value) do nothing;

insert into public.profile_field_preset (user_id, field_key, value)
select user_id, 'website', trim(website)
from public.artist_profile
where website is not null and trim(website) <> ''
on conflict (user_id, field_key, value) do nothing;

insert into public.profile_field_preset (user_id, field_key, value)
select user_id, 'phone', trim(phone)
from public.artist_profile
where phone is not null and trim(phone) <> ''
on conflict (user_id, field_key, value) do nothing;

insert into public.profile_field_preset (user_id, field_key, value)
select user_id, 'social_handle', trim(social_handle)
from public.artist_profile
where social_handle is not null and trim(social_handle) <> ''
on conflict (user_id, field_key, value) do nothing;

insert into public.profile_field_preset (user_id, field_key, value)
select user_id, 'tagline', trim(tagline)
from public.artist_profile
where tagline is not null and trim(tagline) <> ''
on conflict (user_id, field_key, value) do nothing;

insert into public.profile_field_preset (user_id, field_key, value)
select user_id, 'reply_to_email', trim(reply_to_email)
from public.artist_profile
where reply_to_email is not null and trim(reply_to_email) <> ''
on conflict (user_id, field_key, value) do nothing;
