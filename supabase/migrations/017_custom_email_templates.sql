-- User-authored email templates (block-based), referenced as email_type `custom:<uuid>` from tasks, pipeline, and venue_emails.

create table if not exists custom_email_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audience text not null check (audience in ('venue', 'artist')),
  name text not null,
  subject_template text not null default '',
  blocks jsonb not null default '{"version":1,"blocks":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_email_templates_user_id_idx on custom_email_templates(user_id);

alter table custom_email_templates enable row level security;

create policy "custom_email_templates: owner"
  on custom_email_templates
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
