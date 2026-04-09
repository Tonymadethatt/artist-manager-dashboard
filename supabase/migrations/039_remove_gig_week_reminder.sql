-- Deprecate task-based gig_week_reminder (replaced by weekly digest + calendar automations)

update public.tasks
set email_type = null
where email_type = 'gig_week_reminder';

update public.task_template_items
set email_type = null
where email_type = 'gig_week_reminder';

delete from public.email_templates
where email_type = 'gig_week_reminder';

update public.venue_emails
set status = 'failed',
    notes = 'Removed: gig_week_reminder deprecated'
where status = 'pending'
  and email_type = 'gig_week_reminder';
