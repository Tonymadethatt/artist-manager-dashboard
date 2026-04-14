-- Single-section list: drop archived rows and legacy placeholder mock rows so clients can re-seed the official list.
delete from public.artist_partnership_roll_entries where cohort = 'older';
delete from public.artist_partnership_roll_entries where source = 'mock';
