-- Google Calendar sync: OAuth credentials (service-role only) + user settings + per-event mapping.

-- Refresh/access tokens: never exposed to the browser. RLS enabled with no policies for authenticated role.
create table google_calendar_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table google_calendar_credentials enable row level security;

-- User-editable connection settings (no secrets).
create table google_calendar_connection (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text,
  source_calendar_id text not null default '',
  destination_calendar_id text not null default 'primary',
  sync_past_days int not null default 7 check (sync_past_days >= 0 and sync_past_days <= 365),
  sync_future_days int not null default 180 check (sync_future_days >= 0 and sync_future_days <= 730),
  last_sync_at timestamptz,
  last_sync_summary jsonb,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger google_calendar_connection_updated_at
  before update on google_calendar_connection
  for each row execute function update_updated_at();

alter table google_calendar_connection enable row level security;

create policy "google_calendar_connection: owner access"
  on google_calendar_connection
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- One row per source event copied to destination (idempotency + optional Gig Calendar merge).
create table calendar_sync_event (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_calendar_id text not null,
  source_event_id text not null,
  destination_calendar_id text not null,
  destination_event_id text not null,
  event_start_at timestamptz,
  event_end_at timestamptz,
  summary text,
  location text,
  matched_venue_id uuid references venues(id) on delete set null,
  follow_up_task_id uuid references tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_calendar_id, source_event_id)
);

create index calendar_sync_event_user_start_idx on calendar_sync_event (user_id, event_start_at);

create trigger calendar_sync_event_updated_at
  before update on calendar_sync_event
  for each row execute function update_updated_at();

alter table calendar_sync_event enable row level security;

create policy "calendar_sync_event: owner access"
  on calendar_sync_event
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
