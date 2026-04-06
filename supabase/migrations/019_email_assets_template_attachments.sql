-- User-uploaded email assets + optional attachment on custom_email_templates

-- generated_files: distinguish builder vs upload; storage for email-assets bucket
alter table generated_files add column if not exists file_source text not null default 'generated';

alter table generated_files drop constraint if exists generated_files_file_source_check;
alter table generated_files add constraint generated_files_file_source_check
  check (file_source in ('generated', 'upload'));

alter table generated_files add column if not exists upload_storage_path text;
alter table generated_files add column if not exists upload_public_url text;
alter table generated_files add column if not exists upload_mime_type text;

alter table generated_files alter column content set default '';

-- custom template optional attachment
alter table custom_email_templates add column if not exists attachment_generated_file_id uuid
  references generated_files(id) on delete set null;

create index if not exists custom_email_templates_attachment_file_idx
  on custom_email_templates(attachment_generated_file_id)
  where attachment_generated_file_id is not null;

-- Public read bucket for attachment links (unguessable paths)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-assets',
  'email-assets',
  true,
  26214400,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "email_assets_insert_own" on storage.objects;
create policy "email_assets_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'email-assets'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "email_assets_select_public" on storage.objects;
create policy "email_assets_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'email-assets');

drop policy if exists "email_assets_update_own" on storage.objects;
create policy "email_assets_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'email-assets'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'email-assets'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "email_assets_delete_own" on storage.objects;
create policy "email_assets_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'email-assets'
    and split_part(name, '/', 1) = auth.uid()::text
  );
