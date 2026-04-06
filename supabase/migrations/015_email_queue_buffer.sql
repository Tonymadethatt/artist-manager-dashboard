-- Per-user delay before pending venue_emails become eligible for process-email-queue auto-send
alter table public.artist_profile
  add column if not exists email_queue_buffer_minutes integer not null default 10;

alter table public.artist_profile drop constraint if exists artist_profile_email_queue_buffer_minutes_check;

alter table public.artist_profile
  add constraint artist_profile_email_queue_buffer_minutes_check
  check (email_queue_buffer_minutes in (5, 10, 15, 20, 30));

comment on column public.artist_profile.email_queue_buffer_minutes is
  'Minutes after queue before process-email-queue cron may auto-send; must match app presets.';
