-- Extend deals with payment due date and agreement URL
alter table deals add column if not exists payment_due_date date;
alter table deals add column if not exists agreement_url text;

-- Extend artist_profile with DJ Luijay brand identity fields
alter table artist_profile add column if not exists company_name text;
alter table artist_profile add column if not exists website text;
alter table artist_profile add column if not exists phone text;
alter table artist_profile add column if not exists social_handle text;
alter table artist_profile add column if not exists tagline text;
alter table artist_profile add column if not exists reply_to_email text;

-- Email log and queue for venue-facing emails
create table if not exists venue_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid references venues(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  email_type text not null,
  recipient_email text not null,
  subject text not null,
  status text not null default 'pending',
  sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
alter table venue_emails enable row level security;
create policy "venue_emails: owner access" on venue_emails
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists venue_emails_user_id_idx on venue_emails(user_id);
create index if not exists venue_emails_deal_id_idx on venue_emails(deal_id);
create index if not exists venue_emails_venue_id_idx on venue_emails(venue_id);
