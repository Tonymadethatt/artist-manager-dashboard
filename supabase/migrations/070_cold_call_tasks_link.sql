-- Link tasks to cold calls for auto follow-up creation.

alter table public.tasks
  add column if not exists cold_call_id uuid references public.cold_calls(id) on delete set null;

create index if not exists tasks_cold_call_id_idx
  on public.tasks (cold_call_id)
  where cold_call_id is not null;

alter table public.cold_calls
  add column if not exists follow_up_task_id uuid references public.tasks(id) on delete set null;
