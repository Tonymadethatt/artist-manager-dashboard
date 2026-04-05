create table task_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  trigger_status text, -- outreach_status value; auto-applies when venue reaches this status
  created_at timestamptz not null default now()
);
alter table task_templates enable row level security;
create policy "task_templates: owner access" on task_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index task_templates_user_id_idx on task_templates(user_id);

create table task_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references task_templates(id) on delete cascade,
  title text not null,
  notes text,
  days_offset int not null default 0,
  priority task_priority not null default 'medium',
  recurrence task_recurrence not null default 'none',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table task_template_items enable row level security;
create policy "task_template_items: owner via template" on task_template_items
  for all using (
    exists (select 1 from task_templates t where t.id = template_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from task_templates t where t.id = template_id and t.user_id = auth.uid())
  );
create index task_template_items_template_id_idx on task_template_items(template_id);
