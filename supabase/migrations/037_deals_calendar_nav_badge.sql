-- Gig calendar sidebar badge: stamp when a deal first becomes calendar-visible (matches TS dealQualifiesForCalendar + venue status).
-- We intentionally do not backfill existing qualifying deals (avoids a one-time badge flood); only transitions after this migration stamp the column.

alter table public.deals
  add column if not exists calendar_first_listed_at timestamptz null;

comment on column public.deals.calendar_first_listed_at is 'First moment this deal became eligible for the gig calendar; used with nav_badges.seen_at.calendar for the sidebar count.';

-- Calendar-eligible venue statuses (keep aligned with src/lib/calendar/gigCalendarRules.ts CALENDAR_VENUE_STATUSES).

create or replace function public.deals_stamp_calendar_first_listed_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cal_statuses text[] := array['booked','performed','post_follow_up','rebooking','closed_won'];
  st_new outreach_status;
  st_old outreach_status;
  qualifies_new boolean;
  qualifies_old boolean;
begin
  if TG_OP = 'INSERT' then
    if NEW.venue_id is not null then
      select v.status into st_new from public.venues v where v.id = NEW.venue_id;
    end if;
    qualifies_new := NEW.event_start_at is not null
      and NEW.event_end_at is not null
      and NEW.event_cancelled_at is null
      and NEW.venue_id is not null
      and st_new is not null
      and st_new::text = any (cal_statuses);
    if qualifies_new then
      NEW.calendar_first_listed_at := now();
    end if;
    return NEW;
  end if;

  -- UPDATE
  if OLD.venue_id is not null then
    select v.status into st_old from public.venues v where v.id = OLD.venue_id;
  end if;
  if NEW.venue_id is not null then
    select v.status into st_new from public.venues v where v.id = NEW.venue_id;
  end if;

  qualifies_old := OLD.event_start_at is not null
    and OLD.event_end_at is not null
    and OLD.event_cancelled_at is null
    and OLD.venue_id is not null
    and st_old is not null
    and st_old::text = any (cal_statuses);

  qualifies_new := NEW.event_start_at is not null
    and NEW.event_end_at is not null
    and NEW.event_cancelled_at is null
    and NEW.venue_id is not null
    and st_new is not null
    and st_new::text = any (cal_statuses);

  if qualifies_new and (
    not qualifies_old
    or (OLD.event_cancelled_at is not null and NEW.event_cancelled_at is null)
  ) then
    NEW.calendar_first_listed_at := now();
  end if;

  return NEW;
end;
$$;

drop trigger if exists deals_calendar_listing_stamp on public.deals;
create trigger deals_calendar_listing_stamp
  before insert or update on public.deals
  for each row execute function public.deals_stamp_calendar_first_listed_at();

-- When a venue moves into a calendar-eligible status, stamp qualifying deals (deal row may not change).
create or replace function public.venues_stamp_deal_calendar_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cal_statuses text[] := array['booked','performed','post_follow_up','rebooking','closed_won'];
  was_cal boolean;
  now_cal boolean;
begin
  if NEW.status is not distinct from OLD.status then
    return NEW;
  end if;
  was_cal := OLD.status::text = any (cal_statuses);
  now_cal := NEW.status::text = any (cal_statuses);
  if now_cal and not was_cal then
    update public.deals d
    set calendar_first_listed_at = now()
    where d.venue_id = NEW.id
      and d.event_start_at is not null
      and d.event_end_at is not null
      and d.event_cancelled_at is null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists venues_calendar_listing_stamp on public.venues;
create trigger venues_calendar_listing_stamp
  after update of status on public.venues
  for each row execute function public.venues_stamp_deal_calendar_listing();

-- Count deals newly listed on the calendar since last Calendar page visit (nav_badges.seen_at.calendar).
create or replace function public.nav_calendar_badge_count(p_since timestamptz)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
  from public.deals d
  inner join public.venues v on v.id = d.venue_id
  where d.user_id = auth.uid()
    and d.calendar_first_listed_at is not null
    and d.calendar_first_listed_at > p_since
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
$$;

grant execute on function public.nav_calendar_badge_count(timestamptz) to authenticated;
