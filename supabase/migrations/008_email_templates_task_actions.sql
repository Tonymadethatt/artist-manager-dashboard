-- Add email_type to task template items so tasks can trigger emails when completed
alter table task_template_items add column if not exists email_type text;

-- Add email_type to tasks so completed tasks know which email to queue
alter table tasks add column if not exists email_type text;

-- Store per-type custom subject/intro overrides for outgoing emails
create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null,
  custom_subject text,
  custom_intro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, email_type)
);
alter table email_templates enable row level security;
create policy "email_templates: owner" on email_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
