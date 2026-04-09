-- Smart show report: deal promise lines + report extras

alter table deals
  add column if not exists promise_lines jsonb;

comment on column deals.promise_lines is 'Show report recap lines: { "lines": [ { "id", "label", "presetKey?", "major?" } ] }';

alter table performance_reports
  add column if not exists promise_results jsonb,
  add column if not exists night_mood text,
  add column if not exists rescheduled_to_date date,
  add column if not exists rebooking_specific_date date,
  add column if not exists cancellation_freeform text;

comment on column performance_reports.promise_results is 'Per-line Yes/No from artist: [ { "id", "met": bool } ]';
comment on column performance_reports.night_mood is 'Artist mood key: crushed|great|solid|meh|rough|disaster';
comment on column performance_reports.rescheduled_to_date is 'When show moved to another date (short path)';
comment on column performance_reports.rebooking_specific_date is 'Venue hinted rebook by this exact date';
comment on column performance_reports.cancellation_freeform is 'Free-text what happened when show did not run as scheduled';

alter table performance_reports drop constraint if exists performance_reports_rebooking_timeline_check;

alter table performance_reports add constraint performance_reports_rebooking_timeline_check
  check (rebooking_timeline is null or rebooking_timeline in (
    'this_week',
    'next_week',
    'this_month',
    'this_quarter',
    'later',
    'not_discussed',
    'custom_date'
  ));
