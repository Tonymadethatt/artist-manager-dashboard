-- Idempotent repair when a project never received 016 (schema cache: missing layout column).
alter table public.email_templates add column if not exists layout jsonb;
alter table public.email_templates add column if not exists layout_version smallint not null default 1;
