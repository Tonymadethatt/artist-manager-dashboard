-- Provider id when Resend accepts the message (usage meter counts only rows with this set).

alter table public.venue_emails
  add column if not exists resend_message_id text null;

comment on column public.venue_emails.resend_message_id is
  'Resend API email id after successful POST /emails; Email Queue usage counts only sent rows with this set.';

create index if not exists venue_emails_user_sent_resend_id_idx
  on public.venue_emails (user_id, sent_at)
  where status = 'sent' and resend_message_id is not null;
