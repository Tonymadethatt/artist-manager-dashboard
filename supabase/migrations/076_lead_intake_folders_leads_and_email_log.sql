-- Lead intake: folders, leads, outbound email log, and custom_email_templates audience 'lead'.
-- Merge keys in app use lead.* namespace (e.g. lead.venue_name); no changes to tasks in this file.

-- ── 1) lead_folders ──────────────────────────────────────────────────────────

create table if not exists public.lead_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_folders_user_id_id_unique unique (user_id, id)
);

create index if not exists lead_folders_user_id_sort_idx
  on public.lead_folders (user_id, sort_order, name);

create trigger lead_folders_updated_at
  before update on public.lead_folders
  for each row execute function public.update_updated_at();

alter table public.lead_folders enable row level security;

create policy "lead_folders: owner access"
  on public.lead_folders
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 2) leads ───────────────────────────────────────────────────────────────

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid not null,
  venue_name text,
  instagram_handle text,
  genre text,
  event_name text,
  crowd_type text,
  resident_dj text,
  city text,
  contact_email text,
  contact_phone text,
  website text,
  research_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_user_folder_fkey
    foreign key (user_id, folder_id)
    references public.lead_folders (user_id, id)
    on update cascade
    on delete restrict
);

create index if not exists leads_user_id_folder_idx
  on public.leads (user_id, folder_id);

create index if not exists leads_user_id_created_at_idx
  on public.leads (user_id, created_at desc);

create index if not exists leads_user_id_city_idx
  on public.leads (user_id, city)
  where city is not null and city <> '';

create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.update_updated_at();

alter table public.leads enable row level security;

create policy "leads: owner access"
  on public.leads
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Required for lead_email_events (user_id, lead_id) → leads (user_id, id).
alter table public.leads
  add constraint leads_user_id_id_unique unique (user_id, id);

-- ── 3) lead_email_events (separate from venue_emails) ───────────────────────

create table if not exists public.lead_email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lead_id uuid not null,
  custom_email_template_id uuid references public.custom_email_templates (id) on delete set null,
  email_type text not null,
  recipient_email text not null,
  subject text not null,
  status text not null default 'pending',
  sent_at timestamptz,
  resend_message_id text,
  notes text,
  task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint lead_email_events_lead_fkey
    foreign key (user_id, lead_id)
    references public.leads (user_id, id)
    on update cascade
    on delete cascade,
  constraint lead_email_events_status_check
    check (status in ('pending', 'sending', 'sent', 'failed'))
);

create index if not exists lead_email_events_user_lead_idx
  on public.lead_email_events (user_id, lead_id, created_at desc);

create index if not exists lead_email_events_user_status_pending_idx
  on public.lead_email_events (user_id, status, created_at)
  where status = 'pending';

create index if not exists lead_email_events_template_idx
  on public.lead_email_events (custom_email_template_id)
  where custom_email_template_id is not null;

create index if not exists lead_email_events_task_idx
  on public.lead_email_events (task_id)
  where task_id is not null;

alter table public.lead_email_events enable row level security;

create policy "lead_email_events: owner access"
  on public.lead_email_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.lead_folders is 'User-scoped lead pipeline folders; independent of venues.outreach / OutreachStatus.';
comment on table public.leads is 'Pre-client lead records; merge namespace lead.*; promotion to venues is manual and out of scope for this table.';
comment on table public.lead_email_events is 'Outbound lead email log + send queue; does not use venue_emails.';

comment on column public.lead_folders.is_system is 'True for default seed folders (e.g. Not Contacted) — app-level; not enforced in DB.';

comment on column public.lead_email_events.email_type is 'e.g. custom:<uuid> for lead custom templates, consistent with tasks.email_type.';

-- ── 4) custom_email_templates: add audience value 'lead' ────────────────────
-- 017 created check (venue, artist) — default name in Postgres is custom_email_templates_audience_check.
alter table public.custom_email_templates
  drop constraint if exists custom_email_templates_audience_check;

alter table public.custom_email_templates
  add constraint custom_email_templates_audience_check
  check (audience in ('venue', 'artist', 'lead'));
