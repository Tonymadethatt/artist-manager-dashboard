-- Owner-only: undo public list confirmation so the artist can edit again on the client link.
-- Clears download tracking and the edit deadline so ensure_deadline can start a fresh 34h window.

create or replace function public.partnership_roll_clear_list_confirmation()
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
  set
    confirmed_at = null,
    confirmation_document_downloaded_at = null,
    edit_window_ends_at = null
  where id = 1
    and artist_user_id = auth.uid()
    and confirmed_at is not null;

  get diagnostics n = row_count;
  return n > 0;
end;
$$;

comment on function public.partnership_roll_clear_list_confirmation() is
  'Owner-only: clears public confirmation and re-opens the list for edits (fresh deadline on next public visit).';

grant execute on function public.partnership_roll_clear_list_confirmation() to authenticated;
