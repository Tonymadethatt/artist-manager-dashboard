-- Fold legacy booking_confirmed into booking_confirmation (single client template).

delete from email_templates a
where a.email_type = 'booking_confirmed'
  and exists (
    select 1 from email_templates b
    where b.user_id = a.user_id and b.email_type = 'booking_confirmation'
  );

update email_templates set email_type = 'booking_confirmation' where email_type = 'booking_confirmed';

update venue_emails set email_type = 'booking_confirmation' where email_type = 'booking_confirmed';

update task_template_items set email_type = 'booking_confirmation' where email_type = 'booking_confirmed';

update tasks set email_type = 'booking_confirmation' where email_type = 'booking_confirmed';
