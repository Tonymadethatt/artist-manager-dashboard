-- Live sync for partnership roll (Supabase Realtime). Idempotent.
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'artist_partnership_roll_entries')
     and not exists (
 select 1 from pg_publication_tables where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'artist_partnership_roll_entries'
     ) then
    alter publication supabase_realtime add table public.artist_partnership_roll_entries;
  end if;
end $$;
