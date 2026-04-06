-- Clean share URLs: lookup key for first-party /agreements/{slug} routes

alter table generated_files add column if not exists pdf_share_slug text;

create unique index if not exists generated_files_pdf_share_slug_key
  on generated_files(pdf_share_slug)
  where pdf_share_slug is not null;
