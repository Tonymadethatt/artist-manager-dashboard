-- Structured address for venues: improves Google Calendar / Maps location field and ICS LOCATION.

alter table public.venues
  add column if not exists address_line2 text,
  add column if not exists region text,
  add column if not exists postal_code text,
  add column if not exists country text;

comment on column public.venues.location is
  'Street address line 1 (number and street). First line for Google Calendar location.';
comment on column public.venues.address_line2 is
  'Optional unit, suite, floor, or building name.';
comment on column public.venues.city is
  'City or locality.';
comment on column public.venues.region is
  'State, province, or region (e.g. FL, Ontario).';
comment on column public.venues.postal_code is
  'ZIP or postal code.';
comment on column public.venues.country is
  'Country (e.g. United States or US). Improves geocoding when included.';
