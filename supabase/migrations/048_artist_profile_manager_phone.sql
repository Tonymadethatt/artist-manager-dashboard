-- Manager phone for agreements and settings

alter table public.artist_profile
  add column if not exists manager_phone text;

comment on column public.artist_profile.manager_phone is 'Manager phone; used in agreements and templates.';

alter table public.profile_field_preset
  drop constraint if exists profile_field_preset_field_key_check;

alter table public.profile_field_preset
  add constraint profile_field_preset_field_key_check check (
    field_key in (
      'artist_name',
      'artist_email',
      'manager_name',
      'manager_title',
      'manager_email',
      'manager_phone',
      'from_email',
      'company_name',
      'website',
      'phone',
      'social_handle',
      'tagline',
      'reply_to_email'
    )
  );
