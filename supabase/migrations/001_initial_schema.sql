-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Outreach status enum
create type outreach_status as enum (
  'not_contacted',
  'reached_out',
  'in_discussion',
  'agreement_sent',
  'booked',
  'rejected',
  'archived'
);

-- Venue type enum
create type venue_type as enum (
  'bar',
  'club',
  'festival',
  'theater',
  'lounge',
  'other'
);

-- Template type enum
create type template_type as enum (
  'agreement',
  'invoice'
);

-- Expense category enum
create type expense_category as enum (
  'travel',
  'equipment',
  'promotion',
  'accommodation',
  'food',
  'misc'
);

-- venues
create table venues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location text,
  city text,
  venue_type venue_type not null default 'other',
  priority int not null default 3 check (priority between 1 and 5),
  status outreach_status not null default 'not_contacted',
  follow_up_date date,
  deal_terms jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- contacts (per venue)
create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

-- outreach notes (conversation log per venue)
create table outreach_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

-- templates
create table templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type template_type not null default 'agreement',
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- generated files
create table generated_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  template_id uuid references templates(id) on delete set null,
  venue_id uuid references venues(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

-- expenses
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(10, 2) not null,
  category expense_category not null default 'misc',
  description text,
  date date not null default current_date,
  venue_id uuid references venues(id) on delete set null,
  created_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger venues_updated_at before update on venues
  for each row execute function update_updated_at();

create trigger templates_updated_at before update on templates
  for each row execute function update_updated_at();

-- Indexes for common queries
create index venues_user_id_idx on venues(user_id);
create index venues_status_idx on venues(status);
create index venues_follow_up_date_idx on venues(follow_up_date);
create index contacts_venue_id_idx on contacts(venue_id);
create index outreach_notes_venue_id_idx on outreach_notes(venue_id);
create index generated_files_venue_id_idx on generated_files(venue_id);
create index expenses_user_id_idx on expenses(user_id);
create index expenses_date_idx on expenses(date);

-- Row Level Security
alter table venues enable row level security;
alter table contacts enable row level security;
alter table outreach_notes enable row level security;
alter table templates enable row level security;
alter table generated_files enable row level security;
alter table expenses enable row level security;

-- RLS policies — all tables locked to authenticated owner
create policy "venues: owner access" on venues
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "contacts: owner access" on contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "outreach_notes: owner access" on outreach_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "templates: owner access" on templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "generated_files: owner access" on generated_files
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "expenses: owner access" on expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
