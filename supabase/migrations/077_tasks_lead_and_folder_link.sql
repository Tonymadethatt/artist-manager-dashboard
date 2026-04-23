-- Phase 5: link tasks to lead intake (optional lead + folder, composite keys on user_id).

alter table public.tasks
  add column if not exists lead_id uuid,
  add column if not exists lead_folder_id uuid;

comment on column public.tasks.lead_id is
  'Pre-pipeline lead this task is tied to; composite FK (user_id, lead_id) → public.leads.';

comment on column public.tasks.lead_folder_id is
  'Lead folder for denormalized filtering; composite FK (user_id, lead_folder_id) → public.lead_folders.';

alter table public.tasks
  add constraint tasks_lead_fkey
  foreign key (user_id, lead_id)
  references public.leads (user_id, id)
  on update cascade
  on delete set null;

alter table public.tasks
  add constraint tasks_lead_folder_fkey
  foreign key (user_id, lead_folder_id)
  references public.lead_folders (user_id, id)
  on update cascade
  on delete set null;

create index if not exists tasks_user_lead_id_idx
  on public.tasks (user_id, lead_id)
  where lead_id is not null;

create index if not exists tasks_user_lead_folder_id_idx
  on public.tasks (user_id, lead_folder_id)
  where lead_folder_id is not null;
