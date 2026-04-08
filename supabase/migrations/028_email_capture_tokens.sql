-- Tokenized public responses for venue emails (logistics, outreach intent, acks, etc.).
-- Public access only via Netlify functions (service role); RLS allows owner read for dashboard.

create table if not exists public.email_capture_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  kind text not null,
  venue_id uuid references public.venues(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  venue_emails_id uuid references public.venue_emails(id) on delete set null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  response jsonb,
  created_at timestamptz not null default now(),
  constraint email_capture_tokens_kind_check check (kind in (
    'pre_event_checkin',
    'first_outreach',
    'follow_up',
    'show_cancelled_or_postponed',
    'agreement_followup',
    'booking_confirmation',
    'booking_confirmed',
    'invoice_sent',
    'post_show_thanks',
    'pass_for_now',
    'rebooking_inquiry',
    'agreement_ready',
    'payment_reminder_ack'
  ))
);

create index if not exists email_capture_tokens_user_id_idx on public.email_capture_tokens (user_id);
create index if not exists email_capture_tokens_venue_id_idx on public.email_capture_tokens (venue_id);
create index if not exists email_capture_tokens_deal_id_idx on public.email_capture_tokens (deal_id);
create index if not exists email_capture_tokens_venue_emails_id_idx on public.email_capture_tokens (venue_emails_id);

alter table public.email_capture_tokens enable row level security;

create policy "email_capture_tokens: owner read"
  on public.email_capture_tokens
  for select
  using (auth.uid() = user_id);
