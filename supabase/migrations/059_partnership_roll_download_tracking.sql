-- Track when the artist downloads the confirmation .txt from the public page.
-- Clear download timestamp whenever a new public confirmation is recorded.

alter table public.partnership_roll_public_owner
  add column if not exists confirmation_document_downloaded_at timestamptz;

comment on column public.partnership_roll_public_owner.confirmation_document_downloaded_at is
  'Set when the artist downloads the official list .txt after confirming on the public page.';

create or replace function public.partnership_roll_confirm_list()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.partnership_roll_public_owner
  set
    confirmed_at = now(),
    confirmation_document_downloaded_at = null
  where id = 1
    and confirmed_at is null
    and edit_window_ends_at is not null
    and now() <= edit_window_ends_at;

  get diagnostics n = row_count;
  return n > 0;
end;
$$;

create or replace function public.partnership_roll_mark_document_downloaded()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.partnership_roll_public_owner
  set confirmation_document_downloaded_at = now()
  where id = 1
    and confirmed_at is not null;

  get diagnostics n = row_count;
  return n > 0;
end;
$$;

grant execute on function public.partnership_roll_mark_document_downloaded() to anon;
grant execute on function public.partnership_roll_mark_document_downloaded() to authenticated;
