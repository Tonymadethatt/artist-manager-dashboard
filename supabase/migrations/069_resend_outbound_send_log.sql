-- Successful Resend /emails calls (incl. template tests with no venue_emails row).
-- Usage meter unions this with venue_emails.resend_message_id (deduped per message id).

create table public.resend_outbound_send_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  resend_message_id text not null,
  sent_at timestamptz not null default now(),
  source text not null
);

create unique index resend_outbound_send_log_resend_message_id_key
  on public.resend_outbound_send_log (resend_message_id);

create index resend_outbound_send_log_user_sent_at_idx
  on public.resend_outbound_send_log (user_id, sent_at);

comment on table public.resend_outbound_send_log is
  'Append-only log of successful Resend API sends; Email Queue usage = distinct ids (this table ∪ venue_emails).';

alter table public.resend_outbound_send_log enable row level security;

create policy resend_outbound_send_log_select_own
  on public.resend_outbound_send_log
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Count distinct Resend message ids for the signed-in user in [p_start, p_end_exclusive).
create or replace function public.count_distinct_resend_sends(
  p_start timestamptz,
  p_end_exclusive timestamptz
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint from (
    select l.resend_message_id
    from public.resend_outbound_send_log l
    where l.user_id = (select auth.uid())
      and l.sent_at >= p_start
      and l.sent_at < p_end_exclusive
    union
    select v.resend_message_id
    from public.venue_emails v
    where v.user_id = (select auth.uid())
      and v.status = 'sent'
      and v.resend_message_id is not null
      and v.sent_at is not null
      and v.sent_at >= p_start
      and v.sent_at < p_end_exclusive
  ) s;
$$;

revoke all on function public.count_distinct_resend_sends(timestamptz, timestamptz) from public;
grant execute on function public.count_distinct_resend_sends(timestamptz, timestamptz) to authenticated;
