-- Drop expenses table and enum
drop table if exists expenses cascade;
drop type if exists expense_category cascade;

-- Commission tier enum
create type commission_tier as enum ('new_doors', 'kept_doors', 'bigger_doors');

-- Deals table
create table deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  venue_id uuid references venues(id) on delete set null,
  event_date date,
  gross_amount numeric(10,2) not null,
  commission_tier commission_tier not null,
  commission_rate numeric(5,4) not null,
  commission_amount numeric(10,2) not null,
  artist_paid boolean not null default false,
  artist_paid_date date,
  manager_paid boolean not null default false,
  manager_paid_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger
create trigger deals_updated_at before update on deals
  for each row execute function update_updated_at();

-- Indexes
create index deals_user_id_idx on deals(user_id);
create index deals_venue_id_idx on deals(venue_id);
create index deals_event_date_idx on deals(event_date);
create index deals_artist_paid_idx on deals(artist_paid);
create index deals_manager_paid_idx on deals(manager_paid);

-- RLS
alter table deals enable row level security;
create policy "deals: owner access" on deals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
