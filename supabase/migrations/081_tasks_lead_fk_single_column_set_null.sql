-- tasks had composite FK (user_id, lead_id) → public.leads (user_id, id) with ON DELETE SET NULL.
-- On lead delete, Postgres nulls referencing columns; for this composite, user_id (NOT NULL) is part of
-- the FK, which can yield: null value in column "user_id" of relation "tasks" violates not-null constraint.
-- Replace with single-column FKs so only lead_id and lead_folder_id are nulled.

alter table public.tasks drop constraint if exists tasks_lead_fkey;

alter table public.tasks
  add constraint tasks_lead_fkey
  foreign key (lead_id)
  references public.leads (id)
  on delete set null;

alter table public.tasks drop constraint if exists tasks_lead_folder_fkey;

alter table public.tasks
  add constraint tasks_lead_folder_fkey
  foreign key (lead_folder_id)
  references public.lead_folders (id)
  on delete set null;
