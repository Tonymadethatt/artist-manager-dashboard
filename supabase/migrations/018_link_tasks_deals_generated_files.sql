-- Link generated PDFs to tasks, template items, and deals (canonical agreement file).
-- ON DELETE SET NULL: deleting a file unlinks rows; pending emails fall back to deal.agreement_url or skip via app logic.

alter table tasks
  add column if not exists generated_file_id uuid references generated_files(id) on delete set null;

alter table task_template_items
  add column if not exists generated_file_id uuid references generated_files(id) on delete set null;

alter table deals
  add column if not exists agreement_generated_file_id uuid references generated_files(id) on delete set null;

create index if not exists tasks_generated_file_id_idx on tasks(generated_file_id);
create index if not exists task_template_items_generated_file_id_idx on task_template_items(generated_file_id);
create index if not exists deals_agreement_generated_file_id_idx on deals(agreement_generated_file_id);
