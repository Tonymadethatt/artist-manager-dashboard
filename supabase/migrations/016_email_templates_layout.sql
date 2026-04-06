-- Rich per-type email customization (subject, copy, optional blocks, footer options)
alter table email_templates add column if not exists layout jsonb;
alter table email_templates add column if not exists layout_version smallint not null default 1;
