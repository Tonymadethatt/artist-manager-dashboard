-- Per-user baselines for Email Queue usage vs Resend (added to id-backed DB counts + optional VITE_* env).

alter table public.artist_profile
  add column if not exists email_usage_day_offset integer not null default 0,
  add column if not exists email_usage_month_offset integer not null default 0;

comment on column public.artist_profile.email_usage_day_offset is
  'Non-negative; added to today''s Resend usage counter on Email Queue (Pacific).';
comment on column public.artist_profile.email_usage_month_offset is
  'Non-negative; added to this month''s Resend usage counter on Email Queue (Pacific).';

alter table public.artist_profile
  add constraint artist_profile_email_usage_day_offset_nonneg
  check (email_usage_day_offset >= 0);
alter table public.artist_profile
  add constraint artist_profile_email_usage_month_offset_nonneg
  check (email_usage_month_offset >= 0);
