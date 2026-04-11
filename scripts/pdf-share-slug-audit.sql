-- Read-only audit: PDF rows whose share slug would fail public-agreement-pdf validation
-- (length > 220 or not ^[a-z0-9]+(-[a-z0-9]+)*$).

-- Invalid or oversized pdf_share_slug
SELECT id,
       user_id,
       name,
       pdf_storage_path,
       pdf_share_slug,
       pdf_public_url
FROM generated_files
WHERE output_format = 'pdf'
  AND pdf_share_slug IS NOT NULL
  AND (
    length(pdf_share_slug) > 220
    OR lower(trim(pdf_share_slug)) !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  );

-- Path stem differs from column (path stem is canonical) — Case A repair candidates
SELECT id,
       user_id,
       name,
       pdf_storage_path,
       pdf_share_slug,
       lower(regexp_replace(split_part(pdf_storage_path, '/', 2), '\.pdf$', '', 'i')) AS path_stem
FROM generated_files
WHERE output_format = 'pdf'
  AND pdf_storage_path IS NOT NULL
  AND split_part(pdf_storage_path, '/', 2) <> ''
  AND lower(regexp_replace(split_part(pdf_storage_path, '/', 2), '\.pdf$', '', 'i'))
    ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  AND length(
 lower(regexp_replace(split_part(pdf_storage_path, '/', 2), '\.pdf$', '', 'i'))
  ) <= 220
  AND (
    pdf_share_slug IS NULL
    OR lower(trim(pdf_share_slug)) <> lower(
      regexp_replace(split_part(pdf_storage_path, '/', 2), '\.pdf$', '', 'i')
    )
  );
