-- Safe testing: when email_test_mode is true, outbound sends are redirected to
-- dedicated inboxes (configured in Settings). Enforced in Netlify send functions.

alter table public.artist_profile
  add column if not exists email_test_mode boolean not null default false;

alter table public.artist_profile
  add column if not exists email_test_artist_inbox text;

alter table public.artist_profile
  add column if not exists email_test_client_inbox text;

comment on column public.artist_profile.email_test_mode is
  'When true, all outbound email To addresses are replaced with test inboxes (see Netlify functions).';

comment on column public.artist_profile.email_test_artist_inbox is
  'Recipient for artist-facing sends (reports, reminders, gig calendar, etc.) while test mode is on.';

comment on column public.artist_profile.email_test_client_inbox is
  'Recipient for venue/contact-facing sends while test mode is on.';
