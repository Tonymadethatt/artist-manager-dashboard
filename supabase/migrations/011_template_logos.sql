-- Template logo storage bucket for uploaded logo images (PNG/JPG/WebP)
-- Object paths: {auth.uid()}/{uuid}.{ext}
-- Public read so the logo URL can be embedded in the agreement HTML/PDF.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'template-logos',
  'template-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Authenticated users may upload to their own path
drop policy if exists "template_logos_insert_own" on storage.objects;
create policy "template_logos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'template-logos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Public can read any logo (needed for PDF generation and email rendering)
drop policy if exists "template_logos_select_public" on storage.objects;
create policy "template_logos_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'template-logos');

-- Users may update their own objects
drop policy if exists "template_logos_update_own" on storage.objects;
create policy "template_logos_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'template-logos'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'template-logos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Users may delete their own objects
drop policy if exists "template_logos_delete_own" on storage.objects;
create policy "template_logos_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'template-logos'
    and split_part(name, '/', 1) = auth.uid()::text
  );
