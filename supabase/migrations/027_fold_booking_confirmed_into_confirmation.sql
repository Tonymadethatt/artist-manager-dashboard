-- Idempotent data fold: app only exposes booking_confirmation; rewrite any legacy rows.
update email_templates set email_type = 'booking_confirmation' where email_type = 'booking_confirmed';
update venue_emails set email_type = 'booking_confirmation' where email_type = 'booking_confirmed';
update task_template_items set email_type = 'booking_confirmation' where email_type = 'booking_confirmed';
update tasks set email_type = 'booking_confirmation' where email_type = 'booking_confirmed';
