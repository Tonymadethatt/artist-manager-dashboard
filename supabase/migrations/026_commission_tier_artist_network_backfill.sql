-- Backfill after 025 is applied (enum value committed).

update public.deals d
set
  commission_tier = 'artist_network',
  commission_rate = 0,
  commission_amount = 0
from public.venues v
where d.venue_id = v.id
  and v.outreach_track = 'community';

update public.performance_reports pr
set commission_flagged = false
from public.venues v
where pr.venue_id = v.id
  and v.outreach_track = 'community'
  and pr.commission_flagged = true;
