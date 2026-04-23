-- Lead intake: bulk lead task target (5B), template→folder automation (6A), movement + email log (6B/6D).

-- ── 1) tasks: bulk "all leads" send mode (mutually exclusive with lead_id / lead_folder_id) ──
alter table public.tasks
  add column if not exists lead_send_all boolean not null default false;

comment on column public.tasks.lead_send_all is
  'When true, task completion bulk-sends the lead custom template to every lead with a contact email. At most one of (lead_id, lead_folder_id, lead_send_all) is set.';

alter table public.tasks
  drop constraint if exists tasks_lead_link_at_most_one;

alter table public.tasks
  add constraint tasks_lead_link_at_most_one
  check (
    (case when coalesce(lead_send_all, false) then 1 else 0 end)
    + (case when lead_id is not null then 1 else 0 end)
    + (case when lead_folder_id is not null then 1 else 0 end)
    <= 1
  );

-- ── 2) custom_email_templates: optional folder to move lead into after this template is sent (6A) ──
alter table public.custom_email_templates
  add column if not exists move_to_folder_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'custom_email_templates_move_to_folder_fkey'
  ) then
    alter table public.custom_email_templates
      add constraint custom_email_templates_move_to_folder_fkey
      foreign key (user_id, move_to_folder_id)
      references public.lead_folders (user_id, id)
      on delete set null;
  end if;
end $$;

create index if not exists custom_email_templates_user_move_to_folder_idx
  on public.custom_email_templates (user_id, move_to_folder_id)
  where move_to_folder_id is not null;

comment on column public.custom_email_templates.move_to_folder_id is
  'Lead templates only: after a successful send, move the lead into this folder (automation; user can still override manually).';

-- ── 3) lead_email_events: folder context for the send (6B / 6C) ──
alter table public.lead_email_events
  add column if not exists folder_id_before uuid,
  add column if not exists moved_to_folder_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lead_email_events_folder_before_fkey'
  ) then
    alter table public.lead_email_events
      add constraint lead_email_events_folder_before_fkey
      foreign key (user_id, folder_id_before)
      references public.lead_folders (user_id, id)
      on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'lead_email_events_moved_to_folder_fkey'
  ) then
    alter table public.lead_email_events
      add constraint lead_email_events_moved_to_folder_fkey
      foreign key (user_id, moved_to_folder_id)
      references public.lead_folders (user_id, id)
      on delete set null;
  end if;
end $$;

-- ── 4) lead_folder_movements: manual + template-driven folder changes (6D) ──
create table if not exists public.lead_folder_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lead_id uuid not null,
  from_folder_id uuid,
  to_folder_id uuid not null,
  source text not null
    constraint lead_folder_movements_source_check
    check (source in ('manual', 'email_template_send')),
  custom_email_template_id uuid references public.custom_email_templates (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  lead_email_event_id uuid references public.lead_email_events (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint lead_folder_movements_lead_fkey
    foreign key (user_id, lead_id)
    references public.leads (user_id, id)
    on delete cascade,
  constraint lead_folder_movements_from_fkey
    foreign key (user_id, from_folder_id)
    references public.lead_folders (user_id, id)
    on delete set null,
  constraint lead_folder_movements_to_fkey
    foreign key (user_id, to_folder_id)
    references public.lead_folders (user_id, id)
    on delete cascade
);

create index if not exists lead_folder_movements_user_lead_idx
  on public.lead_folder_movements (user_id, lead_id, created_at desc);

comment on table public.lead_folder_movements is
  'Audit of lead folder changes: manual (Lead Intake) or after a lead template send (6D).';

alter table public.lead_folder_movements enable row level security;

create policy "lead_folder_movements: owner"
  on public.lead_folder_movements
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
