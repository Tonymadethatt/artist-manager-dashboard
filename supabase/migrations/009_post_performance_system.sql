-- Add new outreach statuses to the existing enum
-- ALTER TYPE ADD VALUE cannot run inside a transaction in Postgres, which is fine here
alter type outreach_status add value if not exists 'performed';
alter type outreach_status add value if not exists 'post_follow_up';
alter type outreach_status add value if not exists 'rebooking';
alter type outreach_status add value if not exists 'closed_won';
alter type outreach_status add value if not exists 'closed_lost';

-- Performance reports table
create table if not exists performance_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  venue_id uuid not null references venues(id) on delete cascade,
  deal_id uuid references deals(id) on delete set null,
  token uuid not null unique default gen_random_uuid(),
  token_used boolean not null default false,
  event_happened text check (event_happened in ('yes','no','postponed')),
  event_rating integer check (event_rating between 1 and 5),
  attendance integer,
  artist_paid_status text check (artist_paid_status in ('yes','no','partial')),
  payment_amount numeric(10,2),
  venue_interest text check (venue_interest in ('yes','no','unsure')),
  relationship_quality text check (relationship_quality in ('good','neutral','poor')),
  notes text,
  media_links text,
  commission_flagged boolean not null default false,
  submitted boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table performance_reports enable row level security;

create policy "owner_all" on performance_reports
  for all using (auth.uid() = user_id);

-- Indexes for efficient dashboard queries
create index if not exists performance_reports_user_id_idx on performance_reports(user_id);
create index if not exists performance_reports_venue_id_idx on performance_reports(venue_id);
