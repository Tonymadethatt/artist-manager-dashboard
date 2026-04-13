-- Structured contact titles (dropdown keys). Legacy free-text titles stay in `role` until migrated.
alter table public.contacts
  add column if not exists title_key text;

comment on column public.contacts.title_key is
  'Canonical title from app catalog (snake_case). When set, `role` should be null. Legacy rows use `role` only until the user picks a catalog title.';
