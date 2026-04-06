-- Optional organization/company per venue contact (templates: {{contact_company}})
alter table public.contacts add column if not exists company text;

comment on column public.contacts.company is 'Venue/promoter company name for agreements and correspondence';
