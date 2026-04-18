-- Optional Resend plan caps (Email Queue); when null, app uses VITE_* or built-in defaults.

alter table public.artist_profile
  add column if not exists resend_daily_email_cap integer null,
  add column if not exists resend_monthly_email_cap integer null;

comment on column public.artist_profile.resend_daily_email_cap is
  'When set (>=1), Email Queue daily denominator; else VITE_RESEND_DAILY_EMAIL_CAP or app default.';
comment on column public.artist_profile.resend_monthly_email_cap is
  'When set (>=1), Email Queue monthly denominator; else env or app default.';

alter table public.artist_profile
  add constraint artist_profile_resend_daily_cap_positive
  check (resend_daily_email_cap is null or resend_daily_email_cap >= 1);
alter table public.artist_profile
  add constraint artist_profile_resend_monthly_cap_positive
  check (resend_monthly_email_cap is null or resend_monthly_email_cap >= 1);
