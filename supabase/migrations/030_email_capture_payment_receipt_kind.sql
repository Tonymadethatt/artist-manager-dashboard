-- Add 'payment_receipt' to the email_capture_tokens kind check constraint.
-- payment_receipt capture: venue replies with rebooking interest after payment confirmed.

alter table public.email_capture_tokens
  drop constraint email_capture_tokens_kind_check;

alter table public.email_capture_tokens
  add constraint email_capture_tokens_kind_check check (kind in (
    'pre_event_checkin',
    'first_outreach',
    'follow_up',
    'show_cancelled_or_postponed',
    'agreement_followup',
    'booking_confirmation',
    'booking_confirmed',
    'invoice_sent',
    'post_show_thanks',
    'pass_for_now',
    'rebooking_inquiry',
    'agreement_ready',
    'payment_reminder_ack',
    'payment_receipt'
  ));
