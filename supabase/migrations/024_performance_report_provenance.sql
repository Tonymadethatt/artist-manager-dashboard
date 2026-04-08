-- Provenance: which automation created the row, and who actually submitted (artist link vs manager dashboard).

alter table performance_reports
  add column if not exists creation_source text
    check (creation_source is null or creation_source in ('task_automation', 'artist_email', 'manager_dashboard')),
  add column if not exists submitted_by text
    check (submitted_by is null or submitted_by in ('artist_link', 'manager_dashboard'));

comment on column performance_reports.creation_source is 'How the pending row was created; task_automation rows may be deleted when uncompleting the perf-report task.';
comment on column performance_reports.submitted_by is 'Who submitted the form: public link vs manager manual entry.';
