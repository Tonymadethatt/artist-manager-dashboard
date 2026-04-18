-- Align commission_rate and commission_amount with commission_tier for all deals.
-- Fixes rows where tier was updated but commission_rate was not persisted (e.g. Bigger Doors still at 20%).

UPDATE public.deals
SET commission_rate = CASE commission_tier::text
  WHEN 'new_doors' THEN 0.20
  WHEN 'kept_doors' THEN 0.20
  WHEN 'bigger_doors' THEN 0.10
  WHEN 'artist_network' THEN 0
  ELSE commission_rate
END;

UPDATE public.deals
SET commission_amount = round((gross_amount * commission_rate)::numeric, 2);
