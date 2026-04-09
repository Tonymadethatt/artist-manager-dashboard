-- Idempotent stamp for sidebar calendar badge when a deal qualifies but calendar_first_listed_at
-- is still null (e.g. pre-migration rows, or completing a verification task without a deal UPDATE).
-- Invoked from the app after task completion; RLS applies via security invoker + user_id match.

create or replace function public.ensure_deal_calendar_listing_stamp(p_deal_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.deals d
  set calendar_first_listed_at = now()
  from public.venues v
  where d.id = p_deal_id
    and d.user_id = auth.uid()
    and d.venue_id = v.id
    and v.user_id = auth.uid()
    and d.calendar_first_listed_at is null
    and d.event_cancelled_at is null
    and d.event_start_at is not null
    and d.event_end_at is not null
    and d.venue_id is not null
    and v.status in (
      'booked'::outreach_status,
      'performed'::outreach_status,
      'post_follow_up'::outreach_status,
      'rebooking'::outreach_status,
      'closed_won'::outreach_status
    );
end;
$$;

create or replace function public.ensure_calendar_listing_stamps_for_venue(p_venue_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.deals d
  set calendar_first_listed_at = now()
  from public.venues v
  where d.venue_id = p_venue_id
    and d.venue_id = v.id
    and d.user_id = auth.uid()
    and v.user_id = auth.uid()
    and d.calendar_first_listed_at is null
    and d.event_cancelled_at is null
    and d.event_start_at is not null
    and d.event_end_at is not null
    and v.status in (
      'booked'::outreach_status,
      'performed'::outreach_status,
      'post_follow_up'::outreach_status,
      'rebooking'::outreach_status,
      'closed_won'::outreach_status
    );
end;
$$;

grant execute on function public.ensure_deal_calendar_listing_stamp(uuid) to authenticated;
grant execute on function public.ensure_calendar_listing_stamps_for_venue(uuid) to authenticated;
