-- Outreach track: separates manager-sourced pipeline work (commission-relevant)
-- from artist existing network / community nurture (base-fee coverage).
--
-- Backfill default: 'pipeline' — preserves commission math for all existing venues.
-- Manager can reclassify any venue to 'community' for artist pre-existing relationships.

create type outreach_track as enum ('pipeline', 'community');

alter table public.venues
  add column if not exists outreach_track outreach_track not null default 'pipeline';

-- Backfill all existing rows to pipeline (safe default; manager reclassifies as needed)
update public.venues set outreach_track = 'pipeline' where outreach_track is null;

comment on column public.venues.outreach_track is
  'pipeline = manager-sourced opportunity (commission applies); community = artist existing network (nurture / base fee).';
