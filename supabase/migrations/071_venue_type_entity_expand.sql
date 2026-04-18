-- Expand venue_type enum for spaces beyond classic venues plus partners / org types.
-- Application labels this "Entity type" in the UI.

alter type public.venue_type add value 'arena';
alter type public.venue_type add value 'stadium';
alter type public.venue_type add value 'outdoor_space';
alter type public.venue_type add value 'restaurant';
alter type public.venue_type add value 'hotel';
alter type public.venue_type add value 'resort';
alter type public.venue_type add value 'casino';
alter type public.venue_type add value 'convention_center';
alter type public.venue_type add value 'gallery';
alter type public.venue_type add value 'museum';
alter type public.venue_type add value 'brewery';
alter type public.venue_type add value 'winery';
alter type public.venue_type add value 'cafe';
alter type public.venue_type add value 'warehouse';
alter type public.venue_type add value 'rooftop';
alter type public.venue_type add value 'country_club';
alter type public.venue_type add value 'yacht_boat';
alter type public.venue_type add value 'private_estate';
alter type public.venue_type add value 'retail_popup';
alter type public.venue_type add value 'park_public_space';
alter type public.venue_type add value 'university';
alter type public.venue_type add value 'office_coworking';
alter type public.venue_type add value 'sponsor_brand';
alter type public.venue_type add value 'promoter';
alter type public.venue_type add value 'talent_buyer';
alter type public.venue_type add value 'booking_agency';
alter type public.venue_type add value 'management_company';
alter type public.venue_type add value 'record_label';
alter type public.venue_type add value 'pr_agency';
alter type public.venue_type add value 'media_outlet';
alter type public.venue_type add value 'nonprofit';
alter type public.venue_type add value 'corporate_client';
alter type public.venue_type add value 'streaming_platform';
alter type public.venue_type add value 'production_company';
