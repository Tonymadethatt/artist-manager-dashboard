-- User-owned folder tree for Documents; files reference folder (null = root).

create table if not exists public.document_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_id uuid references public.document_folders(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists document_folders_user_parent_idx
  on public.document_folders(user_id, parent_id);

-- Root-level sibling names unique per user
create unique index if not exists document_folders_user_root_name_uidx
  on public.document_folders(user_id, name)
  where parent_id is null;

-- Nested sibling names unique per user + parent
create unique index if not exists document_folders_user_parent_name_uidx
  on public.document_folders(user_id, parent_id, name)
  where parent_id is not null;

alter table public.generated_files
  add column if not exists folder_id uuid references public.document_folders(id) on delete set null;

create index if not exists generated_files_user_folder_idx
  on public.generated_files(user_id, folder_id);

alter table public.document_folders enable row level security;

create policy "document_folders: owner access" on public.document_folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
