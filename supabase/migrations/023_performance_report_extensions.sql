-- Extended show report answers (tap-first fields + automation triggers)

alter table performance_reports
  add column if not exists chase_payment_followup text
    check (chase_payment_followup is null or chase_payment_followup in ('no', 'unsure', 'yes')),
  add column if not exists payment_dispute text
    check (payment_dispute is null or payment_dispute in ('no', 'yes')),
  add column if not exists production_issue_level text
    check (production_issue_level is null or production_issue_level in ('none', 'minor', 'serious')),
  add column if not exists production_friction_tags jsonb not null default '[]'::jsonb,
  add column if not exists rebooking_timeline text
    check (rebooking_timeline is null or rebooking_timeline in ('this_month', 'this_quarter', 'later', 'not_discussed')),
  add column if not exists wants_booking_call text
    check (wants_booking_call is null or wants_booking_call in ('no', 'yes')),
  add column if not exists wants_manager_venue_contact text
    check (wants_manager_venue_contact is null or wants_manager_venue_contact in ('no', 'yes')),
  add column if not exists would_play_again text
    check (would_play_again is null or would_play_again in ('yes', 'maybe', 'no')),
  add column if not exists cancellation_reason text
    check (cancellation_reason is null or cancellation_reason in (
      'venue_cancelled', 'weather', 'low_turnout', 'illness', 'logistics', 'other'
    )),
  add column if not exists referral_lead text
    check (referral_lead is null or referral_lead in ('no', 'yes'));

comment on column performance_reports.chase_payment_followup is 'Artist asked manager to chase payment (automation: task)';
comment on column performance_reports.payment_dispute is 'Disagreement on amount owed (automation: task + note)';
comment on column performance_reports.production_issue_level is 'Production/safety signal (serious => high task)';
comment on column performance_reports.production_friction_tags is 'JSON array of friction tag ids for notes/dashboard';
comment on column performance_reports.rebooking_timeline is 'When venue hinted at rebooking (adjusts re-engage due date)';
comment on column performance_reports.wants_booking_call is 'Manager to schedule next conversation';
comment on column performance_reports.wants_manager_venue_contact is 'Manager should contact venue on behalf of artist';
comment on column performance_reports.would_play_again is 'Play this venue again';
comment on column performance_reports.cancellation_reason is 'Structured reason when show did not happen';
comment on column performance_reports.referral_lead is 'Another buyer/booker introduced';
