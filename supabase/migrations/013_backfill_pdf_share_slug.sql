-- Backfill pdf_share_slug from object path {user_id}/{stem}.pdf when stem is a readable slug (not UUID-only).

update generated_files
set pdf_share_slug = lower(
  regexp_replace(split_part(pdf_storage_path, '/', 2), '\.pdf$', '', 'i')
)
where output_format = 'pdf'
  and pdf_share_slug is null
  and pdf_storage_path is not null
  and split_part(pdf_storage_path, '/', 2) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  and lower(regexp_replace(split_part(pdf_storage_path, '/', 2), '\.pdf$', '', 'i'))
    ~ '^[a-z0-9]+(-[a-z0-9]+)*$';
