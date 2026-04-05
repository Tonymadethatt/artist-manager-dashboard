-- artist_profile
create table artist_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  artist_name text not null default 'DJ Luijay',
  artist_email text not null default 'Djluijay3@gmail.com',
  manager_name text,
  from_email text not null default 'management@djluijay.live',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger artist_profile_updated_at before update on artist_profile
  for each row execute function update_updated_at();
alter table artist_profile enable row level security;
create policy "artist_profile: owner access" on artist_profile
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- metrics
create type metric_category as enum ('brand_partnership', 'event_attendance', 'press_mention');
create table metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  category metric_category not null,
  title text not null,
  numeric_value numeric(10,2),
  description text,
  deal_id uuid references deals(id) on delete set null,
  created_at timestamptz not null default now()
);
create index metrics_user_id_idx on metrics(user_id);
create index metrics_category_idx on metrics(category);
create index metrics_date_idx on metrics(date);
alter table metrics enable row level security;
create policy "metrics: owner access" on metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- monthly_fees
create table monthly_fees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  amount numeric(10,2) not null default 350,
  paid boolean not null default false,
  paid_date date,
  notes text,
  created_at timestamptz not null default now()
);
create index monthly_fees_user_id_idx on monthly_fees(user_id);
create index monthly_fees_month_idx on monthly_fees(month);
alter table monthly_fees enable row level security;
create policy "monthly_fees: owner access" on monthly_fees
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- tasks
create type task_priority as enum ('low', 'medium', 'high');
create type task_recurrence as enum ('none', 'daily', 'weekly', 'monthly');
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  due_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  priority task_priority not null default 'medium',
  recurrence task_recurrence not null default 'none',
  venue_id uuid references venues(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  created_at timestamptz not null default now()
);
create index tasks_user_id_idx on tasks(user_id);
create index tasks_due_date_idx on tasks(due_date);
create index tasks_completed_idx on tasks(completed);
alter table tasks enable row level security;
create policy "tasks: owner access" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
