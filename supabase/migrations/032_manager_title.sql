-- Role/title line for email footers (e.g. "Artist Manager"), paired with manager_name.

alter table public.artist_profile
  add column if not exists manager_title text;

alter table public.profile_field_preset drop constraint if exists profile_field_preset_field_key_check;

alter table public.profile_field_preset
  add constraint profile_field_preset_field_key_check check (
    field_key in (
      'artist_name',
      'artist_email',
      'manager_name',
      'manager_title',
      'manager_email',
      'from_email',
      'company_name',
      'website',
      'phone',
      'social_handle',
      'tagline',
      'reply_to_email'
    )
  );

comment on column public.artist_profile.manager_title is
  'Optional job title shown with manager_name in outbound email footers.';
