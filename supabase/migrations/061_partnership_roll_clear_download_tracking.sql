-- Allow the roll owner (logged-in artist/manager) to clear a mistaken .txt download timestamp
-- without unconfirming the public list.

create or replace function public.partnership_roll_clear_document_downloaded()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.partnership_roll_public_owner
  set confirmation_document_downloaded_at = null
  where id = 1
    and artist_user_id = auth.uid()
    and confirmation_document_downloaded_at is not null;

  get diagnostics n = row_count;
  return n > 0;
end;
$$;

comment on function public.partnership_roll_clear_document_downloaded() is
  'Owner-only: clears confirmation_document_downloaded_at so a new client download can be tracked.';

grant execute on function public.partnership_roll_clear_document_downloaded() to authenticated;
