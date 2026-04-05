-- Generated files: PDF metadata + optional deal link + Storage bucket for agreement PDFs

-- 1) Table columns (idempotent)
alter table generated_files add column if not exists output_format text default 'text';
alter table generated_files add column if not exists pdf_storage_path text;
alter table generated_files add column if not exists pdf_public_url text;
alter table generated_files add column if not exists deal_id uuid references deals(id) on delete set null;

update generated_files set output_format = 'text' where output_format is null;

alter table generated_files alter column output_format set default 'text';
alter table generated_files alter column output_format set not null;

alter table generated_files drop constraint if exists generated_files_output_format_check;
alter table generated_files add constraint generated_files_output_format_check check (output_format in ('text', 'pdf'));

-- 2) Indexes
create index if not exists generated_files_user_created_idx
  on generated_files(user_id, created_at desc);

create index if not exists generated_files_pdf_idx
  on generated_files(user_id, created_at desc)
  where output_format = 'pdf';

-- 3) Storage bucket (public read for shareable email links; object names are unguessable UUIDs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agreement-pdfs',
  'agreement-pdfs',
  true,
  52428800,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 4) Storage RLS policies (object path: {auth.uid()}/{file_id}.pdf)
drop policy if exists "agreement_pdfs_insert_own" on storage.objects;
create policy "agreement_pdfs_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'agreement-pdfs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "agreement_pdfs_select_public" on storage.objects;
create policy "agreement_pdfs_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'agreement-pdfs');

drop policy if exists "agreement_pdfs_update_own" on storage.objects;
create policy "agreement_pdfs_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'agreement-pdfs'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'agreement-pdfs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "agreement_pdfs_delete_own" on storage.objects;
create policy "agreement_pdfs_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'agreement-pdfs'
    and split_part(name, '/', 1) = auth.uid()::text
  );
